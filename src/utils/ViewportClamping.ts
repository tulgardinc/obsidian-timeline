/**
 * ViewportClamping - clamped bounds for timeline cards.
 *
 * COORDINATE SYSTEM (matches the rest of the codebase):
 *   X-axis: screenX = worldX + translateX       (NO scale)
 *   Y-axis: screenY = worldY * scale + translateY
 *
 * When a card extends beyond the viewport edges it is visually
 * clamped while its world coordinates stay intact for interactions.
 */

export interface ClampedBounds {
	visualX: number;
	visualWidth: number;
	isClampedLeft: boolean;
	isClampedRight: boolean;
	isClampedBoth: boolean;
	isCompletelyOutside: boolean;
}

/**
 * Calculate viewport-clamped bounds for a timeline card.
 *
 * `scale` is accepted for API compatibility but is NOT applied
 * to X-axis calculations (consistent with the project-wide rule
 * that scale only affects the Y axis).
 */
export function calculateClampedBounds(
	worldX: number,
	worldWidth: number,
	_scale: number,
	translateX: number,
	viewportWidth: number,
): ClampedBounds {
	// X-axis: screenX = worldX + translateX (no scale)
	const screenLeft = worldX + translateX;
	const screenRight = screenLeft + worldWidth;

	const isClampedLeft = screenLeft < 0;
	const isClampedRight = screenRight > viewportWidth;
	const isClampedBoth = isClampedLeft && isClampedRight;
	const isCompletelyOutside = screenRight < 0 || screenLeft > viewportWidth;

	let visualX: number;
	let visualWidth: number;

	if (isCompletelyOutside) {
		visualX = worldX;
		visualWidth = 0;
	} else if (isClampedBoth) {
		visualX = -translateX; // world X at screen-left edge
		visualWidth = viewportWidth;
	} else if (isClampedLeft) {
		visualX = -translateX;
		visualWidth = screenRight;
	} else if (isClampedRight) {
		visualX = worldX;
		visualWidth = viewportWidth - screenLeft;
	} else {
		visualX = worldX;
		visualWidth = worldWidth;
	}

	return {
		visualX,
		visualWidth,
		isClampedLeft,
		isClampedRight,
		isClampedBoth,
		isCompletelyOutside,
	};
}

/**
 * Convert screen coordinates to world coordinates.
 *
 * X: worldX = screenX - translateX        (no scale)
 * Y: worldY = (screenY - translateY) / scale
 */
export function screenToWorld(
	screenX: number,
	screenY: number,
	scale: number,
	translateX: number,
	translateY: number,
): { worldX: number; worldY: number } {
	return {
		worldX: screenX - translateX,
		worldY: scale === 0 ? 0 : (screenY - translateY) / scale,
	};
}

/**
 * Convert world coordinates to screen coordinates.
 *
 * X: screenX = worldX + translateX         (no scale)
 * Y: screenY = worldY * scale + translateY
 */
export function worldToScreen(
	worldX: number,
	worldY: number,
	scale: number,
	translateX: number,
	translateY: number,
): { screenX: number; screenY: number } {
	return {
		screenX: worldX + translateX,
		screenY: worldY * scale + translateY,
	};
}
