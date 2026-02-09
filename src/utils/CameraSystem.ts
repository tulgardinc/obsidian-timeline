export interface ViewportState {
  width: number;
  height: number;
  translateX: number;
  translateY: number;
  scale: number;
}

export interface CameraOffset {
  x: number;
  y: number;
}

export interface RenderPosition {
  x: number;
  y: number;
  width: number;
}

export interface WorldBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class CameraSystem {
  /**
   * Convert world coordinates to viewport-relative coordinates
   * This is the core transformation that keeps cards near 0,0 in the DOM
   */
  static worldToViewport(
    worldX: number,
    worldY: number,
    viewport: ViewportState
  ): { x: number; y: number } {
    if (viewport.scale === 0) {
      return { x: 0, y: 0 };
    }

    // Standard screen coordinate calculation
    const screenX = worldX * viewport.scale + viewport.translateX;
    const screenY = worldY * viewport.scale + viewport.translateY;

    return {
      x: screenX,
      y: screenY
    };
  }

  /**
   * Convert viewport coordinates back to world coordinates
   */
  static viewportToWorld(
    viewportX: number,
    viewportY: number,
    viewport: ViewportState
  ): { x: number; y: number } {
    if (viewport.scale === 0) {
      return { x: 0, y: 0 };
    }

    const worldX = (viewportX - viewport.translateX) / viewport.scale;
    const worldY = (viewportY - viewport.translateY) / viewport.scale;

    return { x: worldX, y: worldY };
  }

  /**
   * Check if a card (in world coordinates) is visible in the viewport
   */
  static isInViewport(
    worldX: number,
    worldY: number,
    worldWidth: number,
    worldHeight: number,
    viewport: ViewportState
  ): boolean {
    // Convert card bounds to viewport coordinates
    const topLeft = this.worldToViewport(worldX, worldY, viewport);
    const bottomRight = this.worldToViewport(
      worldX + worldWidth,
      worldY + worldHeight,
      viewport
    );

    // Check for overlap with viewport
    return !(
      bottomRight.x < 0 ||
      topLeft.x > viewport.width ||
      bottomRight.y < 0 ||
      topLeft.y > viewport.height
    );
  }

  /**
   * Get the visible world bounds (what world coordinates are visible)
   */
  static getVisibleWorldBounds(viewport: ViewportState): WorldBounds {
    if (viewport.scale === 0) {
      return { left: 0, right: 0, top: 0, bottom: 0 };
    }

    // Convert viewport corners to world coordinates
    const topLeft = this.viewportToWorld(0, 0, viewport);
    const bottomRight = this.viewportToWorld(
      viewport.width,
      viewport.height,
      viewport
    );

    return {
      left: topLeft.x,
      right: bottomRight.x,
      top: topLeft.y,
      bottom: bottomRight.y
    };
  }

  /**
   * Calculate the render position for a card
   * Returns coordinates within safe pixel range (0 to viewport size)
   */
  static getCardRenderPosition(
    worldX: number,
    worldY: number,
    worldWidth: number,
    viewport: ViewportState
  ): RenderPosition {
    // Convert to viewport coordinates
    const pos = this.worldToViewport(worldX, worldY, viewport);
    const scaledWidth = worldWidth * viewport.scale;

    return {
      x: pos.x,
      y: pos.y,
      width: scaledWidth
    };
  }

  /**
   * Calculate camera offset to center on a specific world point
   */
  static centerOn(
    worldX: number,
    worldY: number,
    viewport: ViewportState
  ): CameraOffset {
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;

    return {
      x: centerX - worldX * viewport.scale,
      y: centerY - worldY * viewport.scale
    };
  }
}
