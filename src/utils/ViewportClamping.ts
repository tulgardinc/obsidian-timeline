export interface ClampedBounds {
	visualX: number;
	visualWidth: number;
	isClampedLeft: boolean;
	isClampedRight: boolean;
	isClampedBoth: boolean;
	isCompletelyOutside: boolean;
}

/**
 * Calculate viewport-clamped bounds for timeline cards.
 * When cards extend beyond the viewport edges, they are visually clamped
 * while maintaining their actual world coordinates for interactions.
 * 
 * This implementation performs visibility checks using relative coordinates
 * from viewport center to minimize floating-point precision errors when
 * worldX is very large (billions of pixels from origin).
 */
export function calculateClampedBounds(
	worldX: number,
	worldWidth: number,
	scale: number,
	translateX: number,
	viewportWidth: number
): ClampedBounds {
	// Handle edge cases
	if (scale === 0) {
		return {
			visualX: worldX,
			visualWidth: 0,
			isClampedLeft: false,
			isClampedRight: false,
			isClampedBoth: false,
			isCompletelyOutside: true
		};
	}

	// Calculate viewport center in world coordinates
	// This gives us a reference point close to both the viewport and card
	const viewportCenterWorld = -(translateX - viewportWidth / 2) / scale;
	
	// Calculate card position relative to viewport center
	// This keeps numbers small and preserves precision
	const cardLeftRel = worldX - viewportCenterWorld;
	const cardRightRel = cardLeftRel + worldWidth;
	
	// Viewport half-width in world coordinates
	const viewportHalfWidthWorld = (viewportWidth / 2) / scale;
	
	// Viewport edges relative to center
	const viewportLeftRel = -viewportHalfWidthWorld;
	const viewportRightRel = viewportHalfWidthWorld;

	// Visibility checks using RELATIVE coordinates
	const isClampedLeft = cardLeftRel < viewportLeftRel;
	const isClampedRight = cardRightRel > viewportRightRel;
	const isClampedBoth = isClampedLeft && isClampedRight;
	const isCompletelyOutside = cardRightRel < viewportLeftRel || cardLeftRel > viewportRightRel;

	// Calculate visual bounds in WORLD coordinates
	let visualX: number;
	let visualWidth: number;

	if (isCompletelyOutside) {
		visualX = worldX;
		visualWidth = 0;
	} else if (isClampedBoth) {
		visualX = viewportCenterWorld + viewportLeftRel;
		visualWidth = viewportRightRel - viewportLeftRel;
	} else if (isClampedRight) {
		visualX = worldX;
		visualWidth = (viewportCenterWorld + viewportRightRel) - worldX;
	} else if (isClampedLeft) {
		visualX = viewportCenterWorld + viewportLeftRel;
		visualWidth = cardRightRel - viewportLeftRel;
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
		isCompletelyOutside
	};
}

/**
 * Convert screen coordinates to world coordinates
 */
export function screenToWorld(
	screenX: number,
	screenY: number,
	scale: number,
	translateX: number,
	translateY: number
): { worldX: number; worldY: number } {
	return {
		worldX: (screenX - translateX) / scale,
		worldY: (screenY - translateY) / scale
	};
}

/**
 * Convert world coordinates to screen coordinates
 * 
 * Note: This function may suffer from floating-point precision loss
 * when worldX is very large and scale is high. Use sparingly for
 * coordinate conversion, and prefer world-coordinate calculations
 * for visibility/clamping logic.
 */
export function worldToScreen(
	worldX: number,
	worldY: number,
	scale: number,
	translateX: number,
	translateY: number
): { screenX: number; screenY: number } {
	return {
		screenX: worldX * scale + translateX,
		screenY: worldY * scale + translateY
	};
}
