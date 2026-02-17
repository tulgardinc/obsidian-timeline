import { describe, it, expect } from 'vitest';
import { TimelineHistoryManager, type TimelineState, type HistoryEntry } from './TimelineHistoryManager';

function mockFile(path: string): import('obsidian').TFile {
	return { path, basename: path.split('/').pop() ?? path } as unknown as import('obsidian').TFile;
}

function state(dateStart: string, dateEnd: string, layer: number): TimelineState {
	return { dateStart, dateEnd, layer };
}

describe('TimelineHistoryManager', () => {
	// ── Initial state ──────────────────────────────────────

	it('starts empty', () => {
		const hm = new TimelineHistoryManager();
		expect(hm.canUndo()).toBe(false);
		expect(hm.canRedo()).toBe(false);
		expect(hm.undo()).toBeNull();
		expect(hm.redo()).toBeNull();
		expect(hm.peekUndo()).toBeNull();
		expect(hm.peekRedo()).toBeNull();
	});

	// ── Record & Undo ──────────────────────────────────────

	describe('record + undo', () => {
		it('records a single entry and can undo it', () => {
			const hm = new TimelineHistoryManager();
			const file = mockFile('a.md');
			const prev = state('2020-01-01', '2020-02-01', 0);
			const next = state('2020-01-15', '2020-02-15', 1);

			hm.record(file, prev, next, 'move');

			expect(hm.canUndo()).toBe(true);
			expect(hm.canRedo()).toBe(false);

			const entry = hm.undo();
			expect(entry).not.toBeNull();
			expect(entry!.file.path).toBe('a.md');
			expect(entry!.previousState).toEqual(prev);
			expect(entry!.newState).toEqual(next);
			expect(entry!.operationType).toBe('move');

			expect(hm.canUndo()).toBe(false);
			expect(hm.canRedo()).toBe(true);
		});

		it('records multiple entries and undoes in reverse order', () => {
			const hm = new TimelineHistoryManager();
			const f1 = mockFile('a.md');
			const f2 = mockFile('b.md');

			hm.record(f1, state('2020-01-01', '2020-02-01', 0), state('2020-03-01', '2020-04-01', 0), 'move');
			hm.record(f2, state('2021-01-01', '2021-06-01', 1), state('2021-01-01', '2021-06-01', 2), 'layer-change');

			const second = hm.undo();
			expect(second!.file.path).toBe('b.md');
			expect(second!.operationType).toBe('layer-change');

			const first = hm.undo();
			expect(first!.file.path).toBe('a.md');
			expect(first!.operationType).toBe('move');

			expect(hm.undo()).toBeNull();
		});
	});

	// ── Redo ───────────────────────────────────────────────

	describe('redo', () => {
		it('redo restores undone entry', () => {
			const hm = new TimelineHistoryManager();
			const file = mockFile('a.md');
			const prev = state('2020-01-01', '2020-02-01', 0);
			const next = state('2020-01-15', '2020-02-15', 0);

			hm.record(file, prev, next, 'resize');
			hm.undo();

			const entry = hm.redo();
			expect(entry).not.toBeNull();
			expect(entry!.newState).toEqual(next);
			expect(hm.canRedo()).toBe(false);
			expect(hm.canUndo()).toBe(true);
		});

		it('redo returns null when nothing to redo', () => {
			const hm = new TimelineHistoryManager();
			expect(hm.redo()).toBeNull();
		});

		it('undo-redo-undo roundtrip', () => {
			const hm = new TimelineHistoryManager();
			hm.record(mockFile('a.md'), state('2020-01-01', '2020-02-01', 0), state('2020-03-01', '2020-04-01', 0), 'move');

			hm.undo();
			expect(hm.canUndo()).toBe(false);
			expect(hm.canRedo()).toBe(true);

			hm.redo();
			expect(hm.canUndo()).toBe(true);
			expect(hm.canRedo()).toBe(false);

			const entry = hm.undo();
			expect(entry!.file.path).toBe('a.md');
		});
	});

	// ── Fork (new record after undo discards redo) ─────────

	describe('fork after undo', () => {
		it('recording after undo discards the redo future', () => {
			const hm = new TimelineHistoryManager();
			const f = mockFile('a.md');

			hm.record(f, state('2020-01-01', '2020-02-01', 0), state('2020-03-01', '2020-04-01', 0), 'move');
			hm.record(f, state('2020-03-01', '2020-04-01', 0), state('2020-05-01', '2020-06-01', 0), 'move');

			hm.undo(); // back to first
			expect(hm.canRedo()).toBe(true);

			// Record a different change - should discard the second entry
			hm.record(f, state('2020-03-01', '2020-04-01', 0), state('2021-01-01', '2021-02-01', 1), 'layer-change');

			expect(hm.canRedo()).toBe(false);

			const entry = hm.undo();
			expect(entry!.operationType).toBe('layer-change');
			expect(entry!.newState.dateStart).toBe('2021-01-01');
		});
	});

	// ── Peek ───────────────────────────────────────────────

	describe('peek', () => {
		it('peekUndo shows next undo entry without changing state', () => {
			const hm = new TimelineHistoryManager();
			hm.record(mockFile('a.md'), state('2020-01-01', '2020-02-01', 0), state('2020-03-01', '2020-04-01', 0), 'move');

			const peeked = hm.peekUndo();
			expect(peeked).not.toBeNull();
			expect(peeked!.file.path).toBe('a.md');
			// peek should not consume the entry
			expect(hm.canUndo()).toBe(true);
			expect(hm.peekUndo()).not.toBeNull();
		});

		it('peekRedo shows next redo entry without changing state', () => {
			const hm = new TimelineHistoryManager();
			hm.record(mockFile('a.md'), state('2020-01-01', '2020-02-01', 0), state('2020-03-01', '2020-04-01', 0), 'move');
			hm.undo();

			const peeked = hm.peekRedo();
			expect(peeked).not.toBeNull();
			expect(peeked!.file.path).toBe('a.md');
			expect(hm.canRedo()).toBe(true);
		});
	});

	// ── Max history limit ──────────────────────────────────

	describe('max history', () => {
		it('enforces max history (50 entries)', () => {
			const hm = new TimelineHistoryManager();

			for (let i = 0; i < 60; i++) {
				hm.record(
					mockFile(`f${i}.md`),
					state(`${2000 + i}-01-01`, `${2000 + i}-02-01`, 0),
					state(`${2000 + i}-03-01`, `${2000 + i}-04-01`, 0),
					'move',
				);
			}

			const stats = hm.getStats();
			expect(stats.size).toBe(50);

			// The first 10 entries should have been dropped
			// The oldest remaining entry should be for f10.md
			// Undo 50 times to get to the oldest
			let oldest: HistoryEntry | null = null;
			for (let i = 0; i < 50; i++) {
				const entry = hm.undo();
				if (entry) oldest = entry;
			}
			expect(oldest!.file.path).toBe('f10.md');
		});
	});

	// ── Clear ──────────────────────────────────────────────

	describe('clear', () => {
		it('resets all state', () => {
			const hm = new TimelineHistoryManager();
			hm.record(mockFile('a.md'), state('2020-01-01', '2020-02-01', 0), state('2020-03-01', '2020-04-01', 0), 'move');
			hm.record(mockFile('b.md'), state('2021-01-01', '2021-02-01', 0), state('2021-03-01', '2021-04-01', 0), 'resize');

			hm.clear();

			expect(hm.canUndo()).toBe(false);
			expect(hm.canRedo()).toBe(false);
			expect(hm.undo()).toBeNull();
			expect(hm.redo()).toBeNull();
			const stats = hm.getStats();
			expect(stats.size).toBe(0);
			expect(stats.currentIndex).toBe(-1);
		});
	});

	// ── getStats ───────────────────────────────────────────

	describe('getStats', () => {
		it('reflects current state', () => {
			const hm = new TimelineHistoryManager();

			let s = hm.getStats();
			expect(s).toEqual({ size: 0, currentIndex: -1, canUndo: false, canRedo: false });

			hm.record(mockFile('a.md'), state('2020-01-01', '2020-02-01', 0), state('2020-03-01', '2020-04-01', 0), 'move');
			s = hm.getStats();
			expect(s).toEqual({ size: 1, currentIndex: 0, canUndo: true, canRedo: false });

			hm.undo();
			s = hm.getStats();
			expect(s).toEqual({ size: 1, currentIndex: -1, canUndo: false, canRedo: true });

			hm.redo();
			s = hm.getStats();
			expect(s).toEqual({ size: 1, currentIndex: 0, canUndo: true, canRedo: false });
		});
	});

	// ── Operation types ────────────────────────────────────

	describe('operation types', () => {
		it('preserves all three operation types', () => {
			const hm = new TimelineHistoryManager();
			const f = mockFile('a.md');
			const s1 = state('2020-01-01', '2020-02-01', 0);
			const s2 = state('2020-03-01', '2020-04-01', 0);

			hm.record(f, s1, s2, 'resize');
			hm.record(f, s2, s1, 'move');
			hm.record(f, s1, s2, 'layer-change');

			expect(hm.undo()!.operationType).toBe('layer-change');
			expect(hm.undo()!.operationType).toBe('move');
			expect(hm.undo()!.operationType).toBe('resize');
		});
	});

	// ── Timestamp ──────────────────────────────────────────

	describe('timestamp', () => {
		it('records a valid timestamp', () => {
			const hm = new TimelineHistoryManager();
			const before = Date.now();
			hm.record(mockFile('a.md'), state('2020-01-01', '2020-02-01', 0), state('2020-03-01', '2020-04-01', 0), 'move');
			const after = Date.now();

			const entry = hm.peekUndo();
			expect(entry!.timestamp).toBeGreaterThanOrEqual(before);
			expect(entry!.timestamp).toBeLessThanOrEqual(after);
		});
	});
});
