import type { ViewportState } from './CameraSystem';

export interface CardWorldData {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CardRenderData {
  x: number;
  y: number;
  width: number;
  visible: boolean;
  clampedLeft: boolean;
  clampedRight: boolean;
}

/**
 * CardCameraRenderer handles the transformation of card world coordinates
 * to viewport-relative render coordinates.
 * 
 * This is the key to the camera system - instead of positioning cards at their
 * absolute world coordinates (which can be in the billions), we calculate their
 * position relative to the camera/viewport. This keeps all DOM coordinates within
 * the browser's safe range (0 to ~16 million pixels).
 */
export class CardCameraRenderer {
  /**
   * Calculate render data for a card given the current viewport state
   * 
   * The algorithm:
   * 1. Calculate where the card would appear in screen coordinates
   * 2. Check if it's visible within the viewport
   * 3. Clamp edges if the card extends beyond viewport boundaries
   * 4. Return safe viewport-relative coordinates
   */
  static calculateRenderData(
    card: CardWorldData,
    viewport: ViewportState
  ): CardRenderData {
    // Handle zero scale to avoid division by zero issues
    if (viewport.scale === 0) {
      return {
        x: 0,
        y: 0,
        width: 0,
        visible: false,
        clampedLeft: false,
        clampedRight: false
      };
    }

    // Calculate screen coordinates using the standard transformation
    // screenX = worldX * scale + translateX
    const screenX = card.x * viewport.scale + viewport.translateX;
    const screenY = card.y * viewport.scale + viewport.translateY;
    const screenWidth = card.width * viewport.scale;
    const screenRight = screenX + screenWidth;

    // Check visibility - card is visible if any part overlaps with viewport
    const isVisible = !(
      screenRight < 0 ||
      screenX > viewport.width ||
      screenY + card.height * viewport.scale < 0 ||
      screenY > viewport.height
    );

    if (!isVisible) {
      return {
        x: screenX,
        y: screenY,
        width: screenWidth,
        visible: false,
        clampedLeft: false,
        clampedRight: false
      };
    }

    // Determine clamping
    const isClampedLeft = screenX < 0;
    const isClampedRight = screenRight > viewport.width;

    // Calculate visual bounds
    let visualX = screenX;
    let visualWidth = screenWidth;

    if (isClampedLeft && isClampedRight) {
      // Card spans entire viewport
      visualX = 0;
      visualWidth = viewport.width;
    } else if (isClampedLeft) {
      // Card extends beyond left edge
      visualX = 0;
      visualWidth = screenRight;
    } else if (isClampedRight) {
      // Card extends beyond right edge
      visualWidth = viewport.width - screenX;
    }

    return {
      x: visualX,
      y: screenY,
      width: visualWidth,
      visible: true,
      clampedLeft: isClampedLeft,
      clampedRight: isClampedRight
    };
  }

  /**
   * Batch process multiple cards for efficient rendering
   * Useful when rendering many cards at once
   */
  static calculateRenderDataBatch(
    cards: CardWorldData[],
    viewport: ViewportState
  ): CardRenderData[] {
    return cards.map(card => this.calculateRenderData(card, viewport));
  }

  /**
   * Get only the visible cards from a batch
   * Useful for filtering before rendering
   */
  static filterVisible(
    renderData: CardRenderData[]
  ): CardRenderData[] {
    return renderData.filter(data => data.visible);
  }
}
