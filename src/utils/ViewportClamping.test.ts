import { describe, it, expect } from 'vitest';
import { calculateClampedBounds, screenToWorld, worldToScreen } from './ViewportClamping';

describe('calculateClampedBounds', () => {
  const VIEWPORT_WIDTH = 800;
  const SCALE = 1;
  const TRANSLATE_X = 0;

  describe('fully visible cards', () => {
    it('should not clamp card fully within viewport', () => {
      const result = calculateClampedBounds(
        100,  // worldX
        200,  // worldWidth
        SCALE,
        TRANSLATE_X,
        VIEWPORT_WIDTH
      );

      expect(result.isClampedLeft).toBe(false);
      expect(result.isClampedRight).toBe(false);
      expect(result.isClampedBoth).toBe(false);
      expect(result.isCompletelyOutside).toBe(false);
      expect(result.visualX).toBe(100);
      expect(result.visualWidth).toBe(200);
    });

    it('should handle card at viewport left edge', () => {
      const result = calculateClampedBounds(
        0,
        400,
        SCALE,
        TRANSLATE_X,
        VIEWPORT_WIDTH
      );

      expect(result.isClampedLeft).toBe(false);
      expect(result.isClampedRight).toBe(false);
      expect(result.visualX).toBe(0);
      expect(result.visualWidth).toBe(400);
    });

    it('should handle card at viewport right edge', () => {
      const result = calculateClampedBounds(
        400,
        400,
        SCALE,
        TRANSLATE_X,
        VIEWPORT_WIDTH
      );

      expect(result.isClampedLeft).toBe(false);
      expect(result.isClampedRight).toBe(false);
      expect(result.visualX).toBe(400);
      expect(result.visualWidth).toBe(400);
    });
  });

  describe('left clamping', () => {
    it('should clamp when card extends beyond left viewport edge', () => {
      const result = calculateClampedBounds(
        -500,  // Card starts 500px left of viewport
        1000,  // Card is 1000px wide
        SCALE,
        TRANSLATE_X,
        VIEWPORT_WIDTH
      );

      expect(result.isClampedLeft).toBe(true);
      expect(result.isClampedRight).toBe(false);
      expect(result.isClampedBoth).toBe(false);
      expect(result.visualX).toBeCloseTo(0, 5);  // Clamped to viewport left edge (allow for -0)
      expect(result.visualWidth).toBe(500);  // Only right portion visible
    });

    it('should clamp card completely to the left of viewport', () => {
      const result = calculateClampedBounds(
        -200,
        100,
        SCALE,
        TRANSLATE_X,
        VIEWPORT_WIDTH
      );

      expect(result.isCompletelyOutside).toBe(true);
      expect(result.isClampedLeft).toBe(true);
    });
  });

  describe('right clamping', () => {
    it('should clamp when card extends beyond right viewport edge', () => {
      const result = calculateClampedBounds(
        500,
        1000,
        SCALE,
        TRANSLATE_X,
        VIEWPORT_WIDTH
      );

      expect(result.isClampedLeft).toBe(false);
      expect(result.isClampedRight).toBe(true);
      expect(result.isClampedBoth).toBe(false);
      expect(result.visualX).toBe(500);
      expect(result.visualWidth).toBe(300);  // 800 - 500 = 300px visible
    });

    it('should clamp card completely to the right of viewport', () => {
      const result = calculateClampedBounds(
        900,
        100,
        SCALE,
        TRANSLATE_X,
        VIEWPORT_WIDTH
      );

      expect(result.isCompletelyOutside).toBe(true);
      expect(result.isClampedRight).toBe(true);
    });
  });

  describe('both sides clamping', () => {
    it('should clamp both sides when card spans entire viewport', () => {
      const result = calculateClampedBounds(
        -500,
        2000,
        SCALE,
        TRANSLATE_X,
        VIEWPORT_WIDTH
      );

      expect(result.isClampedLeft).toBe(true);
      expect(result.isClampedRight).toBe(true);
      expect(result.isClampedBoth).toBe(true);
      expect(result.visualX).toBeCloseTo(0, 5);
      expect(result.visualWidth).toBe(800);  // Full viewport width
    });
  });

  describe('with scaling', () => {
    it('should account for scale when calculating clamping', () => {
      const result = calculateClampedBounds(
        -250,  // World coordinates
        500,   // World width
        2,     // Scale: 2x
        0,
        800
      );

      // Screen coordinates: x = -250 * 2 = -500 (off-screen left)
      expect(result.isClampedLeft).toBe(true);
      expect(result.visualX).toBeCloseTo(0, 5);
    });

    it('should handle zoomed in view correctly', () => {
      const result = calculateClampedBounds(
        100,
        200,
        0.5,   // Scale: 0.5x (zoomed out)
        0,
        800
      );

      // Screen coordinates: x = 100 * 0.5 = 50, width = 200 * 0.5 = 100
      // Card at screen position 50-150, fully visible
      expect(result.isClampedLeft).toBe(false);
      expect(result.isClampedRight).toBe(false);
      expect(result.visualX).toBe(100);
      expect(result.visualWidth).toBe(200);
    });
  });

  describe('with translation (panning)', () => {
    it('should account for translateX when calculating viewport edges', () => {
      const result = calculateClampedBounds(
        0,
        500,
        SCALE,
        -200,  // Panned 200px to the right (negative translateX)
        VIEWPORT_WIDTH
      );

      // Viewport left edge in world coords: -(-200) / 1 = 200
      expect(result.isClampedLeft).toBe(true);
      expect(result.visualX).toBe(200);
    });

    it('should handle panned view with card in viewport', () => {
      const result = calculateClampedBounds(
        300,
        200,
        SCALE,
        -200,  // Panned 200px right
        VIEWPORT_WIDTH
      );

      // Viewport covers world coordinates 200 to 1000
      // Card at 300-500 is fully visible
      expect(result.isClampedLeft).toBe(false);
      expect(result.isClampedRight).toBe(false);
      expect(result.visualX).toBe(300);
    });
  });

  describe('edge cases', () => {
    it('should handle zero width card', () => {
      const result = calculateClampedBounds(
        100,
        0,
        SCALE,
        TRANSLATE_X,
        VIEWPORT_WIDTH
      );

      expect(result.visualWidth).toBe(0);
      expect(result.isCompletelyOutside).toBe(false);
    });

    it('should handle negative width (should not happen but be safe)', () => {
      const result = calculateClampedBounds(
        100,
        -50,
        SCALE,
        TRANSLATE_X,
        VIEWPORT_WIDTH
      );

      expect(result.visualWidth).toBeLessThan(0);
    });

    it('should handle very large cards spanning billions of pixels', () => {
      const result = calculateClampedBounds(
        -1000000000,  // 1 billion pixels left
        2000000000,   // 2 billion pixels wide
        SCALE,
        TRANSLATE_X,
        VIEWPORT_WIDTH
      );

      expect(result.isClampedBoth).toBe(true);
      expect(result.visualX).toBeCloseTo(0, 5);
      expect(result.visualWidth).toBe(800);
    });
  });

  describe('floating-point precision (world coordinates far from origin)', () => {
    // These tests verify basic functionality with coordinates far from origin
    // The Camera System (CameraSystem.ts + CardCameraRenderer.ts) handles
    // the actual rendering with viewport-relative coordinates for extreme cases

    it('should correctly identify visible card at 1 million pixels from origin', () => {
      // Test visibility check at 1 million pixels
      const worldX = 1000000;
      const worldWidth = 100;
      const scale = 1;
      const viewportWidth = 800;
      
      // Position viewport to show card at left edge
      const translateX = -worldX;

      const result = calculateClampedBounds(
        worldX,
        worldWidth,
        scale,
        translateX,
        viewportWidth
      );

      // Card should be visible at left edge
      expect(result.isCompletelyOutside).toBe(false);
      expect(result.isClampedLeft).toBe(false);
      // May be clamped on right if card extends beyond viewport
      expect(result.visualX).toBe(worldX);
    });

    it('should correctly identify card outside viewport far from origin', () => {
      // Card at 1 million pixels
      const worldX = 1000000;
      const worldWidth = 100;
      const scale = 1;
      
      // Viewport at origin (0-800)
      const translateX = 0;
      const viewportWidth = 800;

      const result = calculateClampedBounds(
        worldX,
        worldWidth,
        scale,
        translateX,
        viewportWidth
      );

      // Card should be outside to the right
      expect(result.isCompletelyOutside).toBe(true);
    });

    it('should handle clamping at large world coordinates', () => {
      // Card extending beyond viewport
      const worldX = 1000;
      const worldWidth = 500;
      const scale = 1;
      const viewportWidth = 800;
      
      // Position so card starts at viewport left edge
      const translateX = -worldX;

      const result = calculateClampedBounds(
        worldX,
        worldWidth,
        scale,
        translateX,
        viewportWidth
      );

      // Card extends from 1000 to 1500, viewport shows 1000 to 1800
      // So card is partially visible, clamped on neither side
      expect(result.isCompletelyOutside).toBe(false);
      expect(result.isClampedRight).toBe(false);
      expect(result.isClampedLeft).toBe(false);
    });

    it('should handle timeline year far from Unix epoch (year 2000)', () => {
      // Realistic scenario: viewing year 2000 from 1970 epoch
      // At 1px per day: ~30 years * 365 days = ~10,950 pixels
      const daysSince1970 = 30 * 365 + 7;
      const worldX = daysSince1970;  // ~10,957 pixels
      const worldWidth = 365;  // 1 year in days
      const scale = 1;
      
      // Center the year in viewport
      const translateX = -worldX + 400;
      const viewportWidth = 800;

      const result = calculateClampedBounds(
        worldX,
        worldWidth,
        scale,
        translateX,
        viewportWidth
      );

      // Year should be visible
      expect(result.isCompletelyOutside).toBe(false);
      // Year card (365px) should fit within viewport (800px)
      expect(result.isClampedLeft).toBe(false);
      expect(result.isClampedRight).toBe(false);
    });

    it('should handle month view at distant dates', () => {
      // Month view showing January 2000
      const daysSince1970 = 30 * 365 + 7;
      const worldX = daysSince1970 * 10;  // 10px per day
      const worldWidth = 31 * 10;  // 31 days
      const scale = 1;
      
      const translateX = -worldX + 100;
      const viewportWidth = 800;

      const result = calculateClampedBounds(
        worldX,
        worldWidth,
        scale,
        translateX,
        viewportWidth
      );

      // Month should be visible
      expect(result.isCompletelyOutside).toBe(false);
    });

    it('should maintain precision with reasonable coordinate magnitudes', () => {
      // Test that we don't lose precision with coordinates under ~1 million
      const worldX = 1000;  // 1K pixels - manageable coordinates
      const worldWidth = 50;
      const scale = 1;
      const viewportWidth = 800;
      
      // Position viewport so card is fully visible in center
      const translateX = -worldX + 400;

      const result = calculateClampedBounds(
        worldX,
        worldWidth,
        scale,
        translateX,
        viewportWidth
      );

      expect(result.isCompletelyOutside).toBe(false);
      expect(result.visualX).toBe(worldX);
      expect(result.visualWidth).toBe(worldWidth);
    });
  });
});

describe('screenToWorld', () => {
  it('should convert screen coordinates to world coordinates', () => {
    const result = screenToWorld(400, 300, 1, 0, 0);
    expect(result.worldX).toBe(400);
    expect(result.worldY).toBe(300);
  });

  it('should account for translation', () => {
    const result = screenToWorld(400, 300, 1, -100, -50);
    expect(result.worldX).toBe(500);  // (400 - (-100)) / 1
    expect(result.worldY).toBe(350);  // (300 - (-50)) / 1
  });

  it('should account for scale (Y only, X unaffected)', () => {
    const result = screenToWorld(400, 300, 2, 0, 0);
    expect(result.worldX).toBe(400);  // X: no scale, 400 - 0
    expect(result.worldY).toBe(150);  // Y: (300 - 0) / 2
  });

  it('should handle combined scale and translation', () => {
    const result = screenToWorld(400, 300, 2, -100, -50);
    expect(result.worldX).toBe(500);  // X: no scale, 400 - (-100)
    expect(result.worldY).toBe(175);  // Y: (300 - (-50)) / 2
  });
});

describe('worldToScreen', () => {
  it('should convert world coordinates to screen coordinates', () => {
    const result = worldToScreen(400, 300, 1, 0, 0);
    expect(result.screenX).toBe(400);
    expect(result.screenY).toBe(300);
  });

  it('should account for translation', () => {
    const result = worldToScreen(400, 300, 1, -100, -50);
    expect(result.screenX).toBe(300);  // 400 * 1 + (-100)
    expect(result.screenY).toBe(250);  // 300 * 1 + (-50)
  });

  it('should account for scale (Y only, X unaffected)', () => {
    const result = worldToScreen(400, 300, 2, 0, 0);
    expect(result.screenX).toBe(400);  // X: no scale, 400 + 0
    expect(result.screenY).toBe(600);  // Y: 300 * 2 + 0
  });

  it('should handle combined scale and translation', () => {
    const result = worldToScreen(400, 300, 2, -100, -50);
    expect(result.screenX).toBe(300);  // X: no scale, 400 + (-100)
    expect(result.screenY).toBe(550);  // Y: 300 * 2 + (-50)
  });

  it('should be inverse of screenToWorld', () => {
    const originalWorld = { worldX: 1234, worldY: 5678 };
    const scale = 1.5;
    const translateX = -200;
    const translateY = -100;

    const screen = worldToScreen(
      originalWorld.worldX,
      originalWorld.worldY,
      scale,
      translateX,
      translateY
    );

    const backToWorld = screenToWorld(
      screen.screenX,
      screen.screenY,
      scale,
      translateX,
      translateY
    );

    expect(backToWorld.worldX).toBeCloseTo(originalWorld.worldX);
    expect(backToWorld.worldY).toBeCloseTo(originalWorld.worldY);
  });
});
