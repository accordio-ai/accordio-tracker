/**
 * Minimal Electron stub so main-process modules can be exercised under plain
 * node. Only the surface the time-tracking modules actually touch.
 */
let idleSeconds = 0;
module.exports = {
  powerMonitor: {
    getSystemIdleTime: () => idleSeconds,
    on: () => {},
  },
  app: {
    getPath: () => '/tmp',
    getVersion: () => '0.0.0-test',
  },
};
