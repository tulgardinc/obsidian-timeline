/**
 * ViewportStateManager - pure functions for viewport clamping,
 * zoom-toward-point calculations, and viewport persistence.
 *
 * Extracted from InfiniteCanvas.svelte to centralise the repeated
 * zoom-toward-point and clamping patterns.
 *
 * COORDINATE SYSTEM:
 *   X-axis: screenX = worldX + translateX  (NO scale)
 *   Y-axis: screenY = worldY * scale + translateY
 */

import { TimeScaleManager } from "./TimeScaleManager";

// ── Constants ────────────────────────────────────────────────

/** Viewport cannot show beyond ±20 billion years. */
const MAX_YEAR = 20_000_000_000;
const DAYS_PER_YEAR = 365.2425;
export const MAX_DAYS_FROM_EPOCH = MAX_YEAR * DAYS_PER_YEAR;

/** Y-axis zoom limits. */
export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2.0;

// ── Clamping ─────────────────────────────────────────────────

/**
 * Minimum timeScale to keep the viewport within ±20B years.
 */
export function getMinTimeScale(viewportWidth: number): number {
	if (viewportWidth <= 0) return 0.001;
	return viewportWidth / (2 * MAX_DAYS_FROM_EPOCH);
}

export function clampTimeScale(ts: number, viewportWidth: number): number {
	return Math.max(getMinTimeScale(viewportWidth), ts);
}

export function clampScale(s: number): number {
	return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
}

export function clampTranslateX(
	translateX: number,
	timeScale: number,
	viewportWidth: number,
): number {
	const maxTX = MAX_DAYS_FROM_EPOCH * timeScale;
	const minTX = viewportWidth - MAX_DAYS_FROM_EPOCH * timeScale;
	return Math.max(minTX, Math.min(maxTX, translateX));
}

// ── Zoom-toward-point (unified) ─────────────────────────────

export interface ZoomResult {
	scale: number;
	timeScale: number;
	translateX: number;
	translateY: number;
}

/**
 * Zoom both axes toward a screen-space anchor point.
 * Used by: pinch gesture, mouse-wheel (no modifier), touch-pinch.
 */
export function zoomUnified(
	anchorScreenX: number,
	anchorScreenY: number,
	zoomMultiplier: number,
	current: { scale: number; timeScale: number; translateX: number; translateY: number },
	viewportWidth: number,
): ZoomResult {
	const newScale = clampScale(current.scale * zoomMultiplier);
	const newTimeScale = clampTimeScale(current.timeScale * zoomMultiplier, viewportWidth);

	const worldTime = TimeScaleManager.screenXToDay(anchorScreenX, current.timeScale, current.translateX);
	const worldY = (anchorScreenY - current.translateY) / current.scale;

	let translateX = anchorScreenX - TimeScaleManager.dayToWorldX(worldTime, newTimeScale);
	translateX = clampTranslateX(translateX, newTimeScale, viewportWidth);
	const translateY = anchorScreenY - worldY * newScale;

	return { scale: newScale, timeScale: newTimeScale, translateX, translateY };
}

/**
 * Zoom X-axis only toward a screen-space anchor point.
 * Used by: Ctrl/Cmd + wheel, Cmd + trackpad scroll.
 */
export function zoomTimeScaleOnly(
	anchorScreenX: number,
	zoomMultiplier: number,
	current: { timeScale: number; translateX: number },
	viewportWidth: number,
): { timeScale: number; translateX: number } {
	const newTimeScale = clampTimeScale(current.timeScale * zoomMultiplier, viewportWidth);
	const worldTime = TimeScaleManager.screenXToDay(anchorScreenX, current.timeScale, current.translateX);

	let translateX = anchorScreenX - TimeScaleManager.dayToWorldX(worldTime, newTimeScale);
	translateX = clampTranslateX(translateX, newTimeScale, viewportWidth);

	return { timeScale: newTimeScale, translateX };
}
