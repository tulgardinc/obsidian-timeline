/**
 * SelectionManager - manages card selection state.
 *
 * Tracks which cards are selected (multi-select via Shift+click),
 * the active (most recently selected) card, and the display data
 * for the selected card overlay.
 */

import type { TimelineItem, NoteTimelineItem, CardHoverData } from "../types/timelineTypes";
import { TimeScaleManager } from "../utils/TimeScaleManager";

export class SelectionManager {
	selectedIndices: Set<number> = new Set();
	activeIndex: number | null = null;
	selectedCardData: CardHoverData | null = null;

	/**
	 * Select only the given card, clearing all others.
	 */
	select(index: number, items: TimelineItem[], timeScale: number): void {
		this.selectedIndices.clear();
		this.selectedIndices.add(index);
		this.activeIndex = index;
		this.updateCardData(index, items, timeScale);
	}

	/**
	 * Toggle a card in/out of the multi-selection.
	 */
	toggle(index: number, items: TimelineItem[], timeScale: number): void {
		if (this.selectedIndices.has(index)) {
			this.selectedIndices.delete(index);
			if (this.activeIndex === index) {
				const lastSelected = Array.from(this.selectedIndices).pop();
				this.activeIndex = lastSelected ?? null;
			}
		} else {
			this.selectedIndices.add(index);
			this.activeIndex = index;
		}

		if (this.activeIndex !== null) {
			this.updateCardData(this.activeIndex, items, timeScale);
		} else {
			this.selectedCardData = null;
		}
	}

	/**
	 * Clear all selections.
	 */
	clear(): void {
		this.selectedIndices.clear();
		this.activeIndex = null;
		this.selectedCardData = null;
	}

	/**
	 * Get all selected items, filtering to valid indices.
	 */
	getSelectedItems(items: TimelineItem[]): TimelineItem[] {
		return Array.from(this.selectedIndices)
			.filter(i => i >= 0 && i < items.length)
			.map(i => items[i]!);
	}

	/**
	 * Get selected items that are note cards.
	 */
	getSelectedNoteItems(items: TimelineItem[]): NoteTimelineItem[] {
		return this.getSelectedItems(items)
			.filter((item): item is NoteTimelineItem => item.type === 'note');
	}

	/**
	 * Recalculate the overlay data for the active card.
	 */
	updateCardData(index: number, items: TimelineItem[], timeScale: number): void {
		if (index < 0 || index >= items.length) return;
		const item = items[index]!;
		const scaleLevel = TimeScaleManager.getScaleLevel(timeScale);
		const daysStart = Math.round(TimeScaleManager.worldXToDay(item.x, timeScale));
		const daysEnd = Math.round(TimeScaleManager.worldXToDay(item.x + item.width, timeScale));

		this.selectedCardData = {
			startX: item.x,
			endX: item.x + item.width,
			startDate: TimeScaleManager.formatDateForLevel(daysStart, scaleLevel),
			endDate: TimeScaleManager.formatDateForLevel(daysEnd, scaleLevel),
			title: item.title,
		};
	}
}
