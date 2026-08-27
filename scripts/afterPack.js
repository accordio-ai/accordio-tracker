/**
 * Electron Fuses - afterPack Hook
 *
 * Configures Electron fuses to disable dangerous runtime features in production builds.
 * This runs after electron-builder packs the app but before creating the DMG/installer.
 *
 * Fuses are compile-time toggles baked into the Electron binary. They cannot be
 * changed at runtime, making them the strongest form of Electron security hardening.
 *
 * @see https://www.electronjs.org/docs/latest/tutorial/fuses
 */

const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Strip unused Chromium locale packs from the Electron framework.
 *
 * electron-builder's `mac.electronLanguages` only prunes `Contents/Resources/*.lproj`,
 * which on modern Electron are empty marker directories. The real payload —
 * 220 `<lang>.lproj/locale.pak` files, ~46 MB — lives inside
 * `Electron Framework.framework/Versions/A/Resources` and electron-builder never
 * touches it. Removing them here (afterPack runs BEFORE code signing, so the
 * framework is signed in its trimmed state) is the only place this can happen.
 *
 * Chromium falls back to `en.lproj` for any locale whose pack is absent, so the
 * app still launches in every system language, it just renders its (English-only)
 * UI strings in English.
 */
function pruneFrameworkLocales(context, appBundlePath) {
  const wanted = context.packager.platformSpecificBuildOptions.electronLanguages;
  const keep = Array.isArray(wanted) ? wanted : wanted ? [wanted] : [];
  if (keep.length === 0) {
    console.log('[Locales] Skipping - mac.electronLanguages is not set');
    return;
  }

  const localesDir = path.join(
    appBundlePath,
    'Contents', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Resources'
  );
  if (!fs.existsSync(localesDir)) {
    console.warn(`[Locales] Skipping - framework Resources not found at ${localesDir}`);
    return;
  }

  const all = fs.readdirSync(localesDir).filter((f) => f.endsWith('.lproj'));
  const keepSet = new Set(keep.map((l) => `${l}.lproj`));

  // Guard: never strip the fallback locale. If it is missing from the keep list
  // the config is wrong, and shipping without it would leave Chromium with no
  // string table at all.
  if (!keepSet.has('en.lproj')) {
    throw new Error("[Locales] mac.electronLanguages must include 'en' — it is Chromium's fallback locale");
  }

  let removed = 0;
  let freedBytes = 0;
  for (const entry of all) {
    if (keepSet.has(entry)) continue;
    const target = path.join(localesDir, entry);
    try {
      const pak = path.join(target, 'locale.pak');
      if (fs.existsSync(pak)) freedBytes += fs.statSync(pak).size;
      fs.rmSync(target, { recursive: true, force: true });
      removed++;
    } catch (err) {
      console.warn(`[Locales] Could not remove ${entry}: ${err.message}`);
    }
  }

  console.log(
    `[Locales] Removed ${removed} of ${all.length} locale packs ` +
    `(~${(freedBytes / 1024 / 1024).toFixed(1)} MB), kept: ${[...keepSet].join(', ')}`
  );
}

module.exports = async function afterPack(context) {
  const appPath = context.appOutDir;
  const productName = context.packager.appInfo.productFilename;

  if (context.electronPlatformName === 'darwin') {
    pruneFrameworkLocales(context, path.join(appPath, `${productName}.app`));
  }

  // Determine the electron binary path based on platform
  let electronBinaryPath;
  if (context.electronPlatformName === 'darwin') {
    electronBinaryPath = path.join(appPath, `${productName}.app`, 'Contents', 'MacOS', productName);
  } else if (context.electronPlatformName === 'win32') {
    electronBinaryPath = path.join(appPath, `${productName}.exe`);
  } else {
    electronBinaryPath = path.join(appPath, productName);
  }

  console.log(`[Fuses] Flipping fuses for: ${electronBinaryPath}`);

  await flipFuses(electronBinaryPath, {
    version: FuseVersion.V1,

    // Disable ELECTRON_RUN_AS_NODE: prevents attackers from using the app binary
    // as a plain Node.js runtime, which would inherit all TCC permissions
    // (accessibility, screen recording, etc.) granted to the app
    [FuseV1Options.RunAsNode]: false,

    // Disable NODE_OPTIONS environment variable: prevents injecting arbitrary
    // Node.js flags that could load malicious modules or enable debugging
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,

    // Disable --inspect / --inspect-brk CLI arguments: prevents attaching
    // a remote debugger to the main process
    [FuseV1Options.EnableNodeCliInspectArguments]: false,

    // Disable cookie encryption: the app uses electron-store for auth tokens
    // (not Chromium cookies), so this adds no security value. Keeping it enabled
    // triggers a confusing macOS Keychain prompt on first launch.
    [FuseV1Options.EnableCookieEncryption]: false,

    // Enforce loading app code only from asar archive: prevents an attacker
    // from replacing the app's JS files on disk with malicious code
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });

  console.log('[Fuses] Successfully configured security fuses');

  // Ad-hoc sign on macOS ONLY when no Developer ID certificate is available.
  // When a real certificate is present, electron-builder handles signing automatically.
  // macOS requires all ARM64 (Apple Silicon) binaries to be signed — even ad-hoc.
  if (context.electronPlatformName === 'darwin') {
    // Check if electron-builder will handle signing (identity is not null in config)
    const identity = context.packager.platformSpecificBuildOptions.identity;
    if (identity === null || identity === undefined) {
      const appBundlePath = path.join(appPath, `${productName}.app`);
      console.log(`[Sign] No Developer ID configured — ad-hoc signing: ${appBundlePath}`);
      try {
        execSync(
          `codesign --force --deep --sign - "${appBundlePath}"`,
          { stdio: 'inherit' }
        );
        console.log('[Sign] Ad-hoc signing complete');
      } catch (err) {
        console.warn('[Sign] Ad-hoc signing failed:', err.message);
      }
    } else {
      console.log(`[Sign] Developer ID configured — skipping ad-hoc signing (electron-builder will sign)`);
    }
  }
};
