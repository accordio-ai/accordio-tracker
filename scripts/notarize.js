/**
 * Notarize macOS App
 *
 * Runs after code signing to submit the app to Apple's notarization service.
 * This is required for apps distributed outside the Mac App Store on macOS 10.15+.
 *
 * Supported environment variables (choose one auth method):
 *   1) Apple ID + app-specific password
 *      - APPLE_ID              Your Apple ID email
 *      - APPLE_APP_PASSWORD    App-specific password (generate at appleid.apple.com)
 *        (also accepts APPLE_ID_PASSWORD)
 *      - APPLE_TEAM_ID         Your Apple Developer Team ID
 *   2) App Store Connect API key
 *      - APPLE_API_KEY         Absolute path to AuthKey_*.p8
 *      - APPLE_API_KEY_ID      10-character Key ID
 *      - APPLE_API_ISSUER      Issuer ID (UUID). Optional for individual keys on Xcode 26+
 *   3) Keychain profile
 *      - NOTARYTOOL_PROFILE    Name passed to `xcrun notarytool store-credentials`
 *        (also accepts APPLE_KEYCHAIN_PROFILE)
 *
 * @see https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
 */

require('dotenv').config();
const { notarize } = require('@electron/notarize');
const path = require('path');
const { execSync } = require('child_process');

module.exports = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    console.log('[Notarize] Skipping - not macOS');
    return;
  }

  if (process.env.SKIP_NOTARIZE === '1' || process.env.SKIP_NOTARIZE === 'true') {
    console.log('[Notarize] Skipping - SKIP_NOTARIZE is enabled');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  // Notarization requires a real Developer ID signature.
  // If the app is unsigned or ad-hoc signed (common in local/dev builds),
  // skip notarization rather than failing the entire build.
  try {
    const signInfo = execSync(`codesign -dv --verbose=4 "${appPath}" 2>&1`, { encoding: 'utf8' });
    const isAdhoc = /Signature=adhoc/i.test(signInfo);
    const hasTeamId = /TeamIdentifier=(?!not set)([A-Z0-9]+)/i.test(signInfo);
    if (isAdhoc || !hasTeamId) {
      console.log('[Notarize] Skipping - app is not signed with a valid Developer ID identity');
      return;
    }
  } catch (error) {
    console.log('[Notarize] Skipping - unable to verify code signature:', error.message);
    return;
  }

  console.log(`[Notarize] Submitting ${appPath} to Apple...`);
  console.log(`[Notarize] Started at ${new Date().toISOString()}`);

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_APP_PASSWORD || process.env.APPLE_ID_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  const appleApiKey = process.env.APPLE_API_KEY;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;
  const keychainProfile = process.env.NOTARYTOOL_PROFILE || process.env.APPLE_KEYCHAIN_PROFILE;

  const notarizeOptions = { appPath };

  if (keychainProfile) {
    notarizeOptions.keychainProfile = keychainProfile;
  } else if (appleApiKey || appleApiKeyId || appleApiIssuer) {
    if (!appleApiKey || !appleApiKeyId) {
      console.log('[Notarize] Skipping - APPLE_API_KEY and APPLE_API_KEY_ID are required for API key auth');
      return;
    }
    notarizeOptions.appleApiKey = appleApiKey;
    notarizeOptions.appleApiKeyId = appleApiKeyId;
    if (appleApiIssuer) {
      notarizeOptions.appleApiIssuer = appleApiIssuer;
    }
  } else if (appleId || appleIdPassword || teamId) {
    if (!appleId || !appleIdPassword || !teamId) {
      console.log('[Notarize] Skipping - incomplete Apple ID credentials:');
      console.log(`  APPLE_ID: ${appleId ? 'set' : 'MISSING'}`);
      console.log(`  Password: ${appleIdPassword ? 'set' : 'MISSING'} (checked APPLE_APP_SPECIFIC_PASSWORD, APPLE_APP_PASSWORD, APPLE_ID_PASSWORD)`);
      console.log(`  APPLE_TEAM_ID: ${teamId ? 'set' : 'MISSING'}`);
      return;
    }
    notarizeOptions.appleId = appleId;
    notarizeOptions.appleIdPassword = appleIdPassword;
    notarizeOptions.teamId = teamId;
  } else {
    console.log('[Notarize] Skipping - no notarization credentials found');
    return;
  }

  const timeoutMs = 10 * 60 * 1000; // 10 minutes
  const notarizePromise = notarize(notarizeOptions);

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('[Notarize] Timed out after 10 minutes')), timeoutMs)
  );

  await Promise.race([notarizePromise, timeoutPromise]);

  console.log(`[Notarize] Done - app notarized successfully at ${new Date().toISOString()}`);
};
