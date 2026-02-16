import { describe, it, expect } from 'vitest';
import {
	MAX_DAYS_FROM_EPOCH,
	MIN_SCALE,
	MAX_SCALE,
	getMinTimeScale,
	clampTimeScale,
	clampScale,
	clampTranslateX,
	zoomUnified,
	zoomTimeScaleOnly,
} from './ViewportStateManager';

describe('ViewportStateManager', () => {
	// ── clampScale ─────────────────────────────────────────

	describe('clampScale', () => {
		it('clamps below MIN_SCALE', () => {
			expect(clampScale(0.1)).toBe(MIN_SCALE);
		});

		it('clamps above MAX_SCALE', () => {
			expect(clampScale(5)).toBe(MAX_SCALE);
		});

		it('passes through values in range', () => {
			expect(clampScale(1)).toBe(1);
			expect(clampScale(1.5)).toBe(1.5);
		});
	});

	// ── clampTimeScale ─────────────────────────────────────

	describe('clampTimeScale', () => {
		it('enforces minimum based on viewport width', () => {
			const vw = 1000;
			const min = getMinTimeScale(vw);
			expect(clampTimeScale(0, vw)).toBe(min);
			expect(clampTimeScale(min / 2, vw)).toBe(min);
		});

		it('passes through values above minimum', () => {
			expect(clampTimeScale(10, 1000)).toBe(10);
		});

		it('handles zero viewport width', () => {
			expect(clampTimeScale(0, 0)).toBe(0.001);
		});
	});

	// ── clampTranslateX ────────────────────────────────────

	describe('clampTranslateX', () => {
		it('clamps to keep viewport within ±20B years', () => {
			const ts = 10;
			const vw = 1000;
			const maxTX = MAX_DAYS_FROM_EPOCH * ts;

			// Very large positive translateX → clamped to max
			expect(clampTranslateX(maxTX * 2, ts, vw)).toBe(maxTX);

			// Very large negative translateX → clamped to min
			const minTX = vw - MAX_DAYS_FROM_EPOCH * ts;
			expect(clampTranslateX(minTX * 2, ts, vw)).toBe(minTX);
		});

		it('passes through values in range', () => {
			expect(clampTranslateX(0, 10, 1000)).toBe(0);
		});
	});

	// ── zoomUnified ────────────────────────────────────────

	describe('zoomUnified', () => {
		const current = { scale: 1, timeScale: 10, translateX: 500, translateY: 300 };
		const vw = 1000;

		it('zooming in increases scale and timeScale', () => {
			const r = zoomUnified(500, 300, 1.1, current, vw);
			expect(r.scale).toBeGreaterThan(1);
			expect(r.timeScale).toBeGreaterThan(10);
		});

		it('zooming out decreases scale and timeScale', () => {
			const r = zoomUnified(500, 300, 0.9, current, vw);
			expect(r.scale).toBeLessThan(1);
			expect(r.timeScale).toBeLessThan(10);
		});

		it('anchor point stays at the same world position', () => {
			// Calculate world position at anchor before zoom
			const anchorX = 400;
			const anchorY = 250;
			const worldTimeBefore = (anchorX - current.translateX) / current.timeScale;
			const worldYBefore = (anchorY - current.translateY) / current.scale;

			const r = zoomUnified(anchorX, anchorY, 1.2, current, vw);

			// After zoom, the same screen point should map to the same world position
			const worldTimeAfter = (anchorX - r.translateX) / r.timeScale;
			const worldYAfter = (anchorY - r.translateY) / r.scale;

			expect(worldTimeAfter).toBeCloseTo(worldTimeBefore, 5);
			expect(worldYAfter).toBeCloseTo(worldYBefore, 5);
		});

		it('clamps scale to MIN/MAX range', () => {
			// Zoom way in
			const rIn = zoomUnified(500, 300, 10, current, vw);
			expect(rIn.scale).toBe(MAX_SCALE);

			// Zoom way out
			const rOut = zoomUnified(500, 300, 0.1, current, vw);
			expect(rOut.scale).toBe(MIN_SCALE);
		});
	});

	// ── zoomTimeScaleOnly ──────────────────────────────────

	describe('zoomTimeScaleOnly', () => {
		const current = { timeScale: 10, translateX: 500 };
		const vw = 1000;

		it('zooming in increases timeScale', () => {
			const r = zoomTimeScaleOnly(500, 1.1, current, vw);
			expect(r.timeScale).toBeGreaterThan(10);
		});

		it('anchor X stays at the same world time', () => {
			const anchorX = 400;
			const worldTimeBefore = (anchorX - current.translateX) / current.timeScale;

			const r = zoomTimeScaleOnly(anchorX, 1.5, current, vw);

			const worldTimeAfter = (anchorX - r.translateX) / r.timeScale;
			expect(worldTimeAfter).toBeCloseTo(worldTimeBefore, 5);
		});

		it('does not change scale (Y-axis)', () => {
			// zoomTimeScaleOnly returns only timeScale + translateX, not scale
			const r = zoomTimeScaleOnly(500, 1.1, current, vw);
			expect(r).not.toHaveProperty('scale');
		});
	});
});
