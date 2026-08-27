/**
 * Safe logger for Electron main process
 *
 * Wraps console methods to handle EPIPE errors that occur when
 * stdout/stderr pipes are closed (common in packaged Electron apps).
 */

const safeWrite = (fn: (...args: unknown[]) => void, ...args: unknown[]) => {
  try {
    fn(...args);
  } catch (error: unknown) {
    // Silently ignore EPIPE errors (broken pipe)
    if (error instanceof Error && 'code' in error && error.code === 'EPIPE') {
      return;
    }
    // Re-throw other errors
    throw error;
  }
};

export const logger = {
  log: (...args: unknown[]) => safeWrite(console.log.bind(console), ...args),
  error: (...args: unknown[]) => safeWrite(console.error.bind(console), ...args),
  warn: (...args: unknown[]) => safeWrite(console.warn.bind(console), ...args),
  info: (...args: unknown[]) => safeWrite(console.info.bind(console), ...args),
  debug: (...args: unknown[]) => safeWrite(console.debug.bind(console), ...args),
};

export default logger;