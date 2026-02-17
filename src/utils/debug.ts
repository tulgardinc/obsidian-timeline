/**
 * Debug logging utility.
 * 
 * All debug output routes through this module so it can be
 * silenced in production without touching call sites.
 * 
 * Set `DEBUG_ENABLED = true` during development, or call
 * `setDebug(true)` at runtime.
 */

let DEBUG_ENABLED = false;

export function setDebug(enabled: boolean): void {
	DEBUG_ENABLED = enabled;
}

export function isDebugEnabled(): boolean {
	return DEBUG_ENABLED;
}

/**
 * Log a debug message.  No-ops when debug is disabled.
 */
export function debug(prefix: string, ...args: unknown[]): void {
	if (DEBUG_ENABLED) {
		// eslint-disable-next-line no-console
		console.log(`[${prefix}]`, ...args);
	}
}

/**
 * Always-on warning (still goes through console.warn).
 */
export function warn(prefix: string, ...args: unknown[]): void {
	console.warn(`[${prefix}]`, ...args);
}
