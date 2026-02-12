import { describe, it, expect } from 'vitest';
import { CameraSystem, type ViewportState } from './CameraSystem';

describe('CameraSystem', () => {
  const VIEWPORT_WIDTH = 800;
  const VIEWPORT_HEIGHT = 600;
  const SCALE = 1;

  describe('coordinate conversion', () => {
    it('should convert world coordinates to screen coordinates', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: 0,
        translateY: 0,
        scale: SCALE
      };

      // World point at (100, 100) at default position
      const result = CameraSystem.worldToViewport(100, 100, viewport);
      expect(result.x).toBe(100);
      expect(result.y).toBe(100);
    });

    it('should account for translation', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: -100, // Panned right by 100
        translateY: -50,
        scale: SCALE
      };

      // World origin now appears at screen (-100, -50)
      const result = CameraSystem.worldToViewport(0, 0, viewport);
      expect(result.x).toBe(-100);
      expect(result.y).toBe(-50);
    });

    it('should account for scale on Y axis only', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: 0,
        translateY: 0,
        scale: 2 // 2x zoom
      };

      // At 2x scale, only Y doubles. X is unaffected by scale.
      const result = CameraSystem.worldToViewport(100, 100, viewport);
      expect(result.x).toBe(100); // X: worldX + translateX = 100 + 0
      expect(result.y).toBe(200); // Y: worldY * scale + translateY = 100 * 2 + 0
    });

    it('should handle combined scale and translation', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: -100,
        translateY: -50,
        scale: 2
      };

      const result = CameraSystem.worldToViewport(100, 100, viewport);
      // screenX = worldX + translateX = 100 + (-100) = 0 (no scale on X)
      // screenY = worldY * scale + translateY = 100 * 2 + (-50) = 150
      expect(result.x).toBe(0);
      expect(result.y).toBe(150);
    });
  });

  describe('visibility testing', () => {
    it('should identify visible cards within viewport', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: 0,
        translateY: 0,
        scale: SCALE
      };

      // Card at 100, 100 with size 200x50 - fully visible
      const isVisible = CameraSystem.isInViewport(100, 100, 200, 50, viewport);
      expect(isVisible).toBe(true);
    });

    it('should identify cards outside viewport', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: 0,
        translateY: 0,
        scale: SCALE
      };

      // Card way to the right - not visible
      const isVisible = CameraSystem.isInViewport(10000, 100, 200, 50, viewport);
      expect(isVisible).toBe(false);
    });

    it('should handle cards partially visible at edges', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: 0,
        translateY: 0,
        scale: SCALE
      };

      // Card partially off right edge
      const isVisible = CameraSystem.isInViewport(700, 100, 200, 50, viewport);
      expect(isVisible).toBe(true); // Partially visible
    });

    it('should work with extreme coordinates when viewport is centered on them', () => {
      // Viewport centered at extreme coordinate
      const extremeX = 10000000;
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: -extremeX + 400, // Center viewport on extremeX
        translateY: 0,
        scale: SCALE
      };

      // Card at extreme coordinates should be visible
      const isVisible = CameraSystem.isInViewport(extremeX, 100, 200, 50, viewport);
      expect(isVisible).toBe(true);
    });
  });

  describe('camera bounds calculation', () => {
    it('should calculate visible world bounds', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: 0,
        translateY: 0,
        scale: SCALE
      };

      const bounds = CameraSystem.getVisibleWorldBounds(viewport);
      
      // At default position, viewport shows world (0,0) to (800, 600)
      expect(bounds.left).toBe(0);
      expect(bounds.right).toBe(800);
      expect(bounds.top).toBe(0);
      expect(bounds.bottom).toBe(600);
    });

    it('should calculate bounds with translation', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: -100, // Panned right by 100
        translateY: -50,
        scale: SCALE
      };

      const bounds = CameraSystem.getVisibleWorldBounds(viewport);
      
      // Viewport shows world from (100, 50) to (900, 650)
      expect(bounds.left).toBe(100);
      expect(bounds.right).toBe(900);
      expect(bounds.top).toBe(50);
      expect(bounds.bottom).toBe(650);
    });

    it('should calculate bounds with scale (Y only)', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: 0,
        translateY: 0,
        scale: 2 // 2x zoom
      };

      const bounds = CameraSystem.getVisibleWorldBounds(viewport);
      
      // Scale only affects Y, so X range stays the same
      expect(bounds.left).toBe(0);
      expect(bounds.right).toBe(800); // X unaffected by scale
      expect(bounds.top).toBe(0);
      expect(bounds.bottom).toBe(300); // 600 / 2 (Y divided by scale)
    });
  });

  describe('card positioning for rendering', () => {
    it('should calculate card render position', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: 0,
        translateY: 0,
        scale: SCALE
      };

      const renderPos = CameraSystem.getCardRenderPosition(100, 200, 150, viewport);
      
      expect(renderPos.x).toBe(100);
      expect(renderPos.y).toBe(200);
      expect(renderPos.width).toBe(150);
    });

    it('should handle large scale (Y only)', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: 0,
        translateY: 0,
        scale: 2
      };

      const renderPos = CameraSystem.getCardRenderPosition(100, 100, 50, viewport);
      
      // X: no scale, worldX + translateX = 100 + 0 = 100
      expect(renderPos.x).toBe(100);
      // Y: worldY * scale + translateY = 100 * 2 + 0 = 200
      expect(renderPos.y).toBe(200);
      // Width: no scale on X
      expect(renderPos.width).toBe(50);
    });

    it('should produce reasonable coordinates for extreme world positions', () => {
      // This test demonstrates the camera system keeping coords in safe range
      const extremeX = 10000000;
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: -extremeX + 100, // Position so card appears at x=100
        translateY: 0,
        scale: SCALE
      };

      const renderPos = CameraSystem.getCardRenderPosition(extremeX, 100, 200, viewport);
      
      // Card should appear at safe coordinate (100), not extreme coordinate
      expect(renderPos.x).toBe(100);
      expect(renderPos.x).toBeGreaterThanOrEqual(0);
      expect(renderPos.x).toBeLessThan(VIEWPORT_WIDTH);
    });
  });

  describe('centering camera', () => {
    it('should calculate offset to center on world point', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: 0,
        translateY: 0,
        scale: SCALE
      };

      const offset = CameraSystem.centerOn(500, 400, viewport);
      
      // To center (500, 400) in 800x600 viewport:
      // translateX = centerX - worldX = 400 - 500 = -100 (no scale on X)
      // translateY = centerY - worldY * scale = 300 - 400 = -100
      expect(offset.x).toBe(-100);
      expect(offset.y).toBe(-100);
    });

    it('should center extreme coordinates correctly', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: 0,
        translateY: 0,
        scale: SCALE
      };

      const extremeX = 10000000;
      const offset = CameraSystem.centerOn(extremeX, 0, viewport);
      
      // Should produce reasonable offset, not extreme
      // translateX = 400 - 10000000 = -9999600 (no scale on X)
      expect(offset.x).toBe(-9999600);
      // This is the expected behavior - viewport offset becomes extreme,
      // but individual card positions remain manageable via the camera system
    });
  });

  describe('edge cases', () => {
    it('should handle zero scale gracefully', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: 0,
        translateY: 0,
        scale: 0
      };

      const result = CameraSystem.worldToViewport(100, 100, viewport);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should handle negative scale', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: 0,
        translateY: 0,
        scale: -1 // Flipped
      };

      const result = CameraSystem.worldToViewport(100, 100, viewport);
      // X: no scale, worldX + translateX = 100
      expect(result.x).toBe(100);
      // Y: worldY * scale = 100 * -1 = -100
      expect(result.y).toBe(-100);
    });

    it('should handle reverse conversion', () => {
      const viewport: ViewportState = {
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
        translateX: -100,
        translateY: -50,
        scale: 2
      };

      // Convert world to screen and back
      const world = { x: 100, y: 100 };
      const screen = CameraSystem.worldToViewport(world.x, world.y, viewport);
      const backToWorld = CameraSystem.viewportToWorld(screen.x, screen.y, viewport);
      
      // Round trip should give back the same world coordinates
      expect(backToWorld.x).toBeCloseTo(world.x, 5);
      expect(backToWorld.y).toBeCloseTo(world.y, 5);
    });
  });
});
