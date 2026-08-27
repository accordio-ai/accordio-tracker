/**
 * Notarize DMG artifacts after they are built.
 *
 * electron-builder's built-in notarize only handles the .app bundle.
 * The DMG is created *after* that, so it needs a separate notarization
 * and stapling pass. Without this, macOS Gatekeeper will warn users
 * when they open the DMG.
 *
 * ZIPs are skipped — they can't be stapled, and the .app inside is
 * already notarized so Gatekeeper checks it online.
 *
 * This runs as the "afterAllArtifactBuild" hook.
 */

require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');

module.exports = async function afterAllArtifactBuild(buildResult) {
  if (process.platform !== 'darwin') {
    console.log('[NotarizeDMG] Skipping - not macOS');
    return;
  }

  if (process.env.SKIP_NOTARIZE === '1' || process.env.SKIP_NOTARIZE === 'true') {
    console.log('[NotarizeDMG] Skipping - SKIP_NOTARIZE is enabled');
    return;
  }

  const appleId = process.env.APPLE_ID;
  const password =
    process.env.APPLE_APP_SPECIFIC_PASSWORD || process.env.APPLE_APP_PASSWORD || process.env.APPLE_ID_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  const keychainProfile = process.env.NOTARYTOOL_PROFILE || process.env.APPLE_KEYCHAIN_PROFILE;

  if (!keychainProfile && (!appleId || !password || !teamId)) {
    console.log('[NotarizeDMG] Skipping - missing Apple notarization credentials');
    return;
  }

  // Only notarize DMGs — ZIPs can't be stapled and the .app inside is already notarized
  const allPaths = buildResult.artifactPaths || buildResult || [];
  const dmgs = allPaths.filter((f) => f.endsWith('.dmg'));

  if (dmgs.length === 0) {
    console.log('[NotarizeDMG] No DMG artifacts to notarize');
    return;
  }

  for (const dmg of dmgs) {
    const name = path.basename(dmg);
    console.log(`[NotarizeDMG] Submitting ${name}...`);

    try {
      const submitCmd = keychainProfile
        ? `xcrun notarytool submit "${dmg}" --keychain-profile "${keychainProfile}" --wait`
        : `xcrun notarytool submit "${dmg}" --apple-id "${appleId}" --password "${password}" --team-id "${teamId}" --wait`;
      execSync(submitCmd, { stdio: 'inherit', timeout: 10 * 60 * 1000 });

      console.log(`[NotarizeDMG] Stapling ${name}...`);
      execSync(`xcrun stapler staple "${dmg}"`, { stdio: 'inherit' });

      console.log(`[NotarizeDMG] ${name} done`);
    } catch (err) {
      console.error(`[NotarizeDMG] Failed for ${name}:`, err.message);
      throw err;
    }
  }
};
