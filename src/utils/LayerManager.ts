import type { TFile } from "obsidian";
import { TimelineDate } from "./TimelineDate";
import type { TimelineItem } from "../types/timelineTypes";

export type TimelineColor = 'red' | 'blue' | 'green' | 'yellow';

export interface LayerableItem {
	file: TFile;
	dateStart: TimelineDate;
	dateEnd: TimelineDate;
	layer?: number;
	// Internal property used by cache service to pass preferred layer
	cachedLayer?: number;
	color?: TimelineColor;
}

export interface LayerAssignment {
	file: TFile;
	layer: number;
	previousLayer?: number;
}

export const GRID_SPACING = 50;

export class LayerManager {
	/**
	 * Check if two date ranges overlap
	 */
	static rangesOverlap(
		start1: TimelineDate,
		end1: TimelineDate,
		start2: TimelineDate,
		end2: TimelineDate
	): boolean {
		// Overlap occurs when one range starts before the other ends
		// and ends after the other starts
		// Using TimelineDate comparison methods
		return !start1.isAfter(end2) && !end1.isBefore(start2);
	}

	/**
	 * Check if a layer is busy (has overlapping events) at a specific time range
	 */
	static isLayerBusy(
		targetLayer: number,
		dateStart: TimelineDate,
		dateEnd: TimelineDate,
		items: LayerableItem[],
		excludeFile?: TFile
	): boolean {
		for (const item of items) {
			// Skip if it's the same file or not on the target layer
			if (item.file.path === excludeFile?.path) continue;
			if (item.layer !== targetLayer) continue;

			// Check for date overlap
			if (this.rangesOverlap(dateStart, dateEnd, item.dateStart, item.dateEnd)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Calculate Y position from layer number
	 * Layer 0 = Y = 0
	 * Positive layers: above (negative Y)
	 * Negative layers: below (positive Y)
	 */
	static layerToY(layer: number): number {
		return -layer * GRID_SPACING;
	}

	/**
	 * Calculate layer number from Y position.
	 *
	 * Each card's top edge sits at layerToY(layer), and the card extends
	 * downward by GRID_SPACING.  Using Math.floor ensures that any Y value
	 * within a card's visual bounds maps to the correct layer.
	 */
	static yToLayer(y: number): number {
		return -Math.floor(y / GRID_SPACING);
	}

	/**
	 * Assign layers to items using alternating search pattern:
	 * +1, -1, +2, -2, +3, -3, ...
	 * 
	 * Uses cachedLayer if available, otherwise defaults to 0
	 */
	static assignLayers(items: LayerableItem[]): LayerAssignment[] {
		const assignments: LayerAssignment[] = [];
		const processedItems: LayerableItem[] = [];

		for (const item of items) {
			// Use cached layer as preferred, default to 0
			const preferredLayer = item.cachedLayer ?? 0;
			const previousLayer = item.layer;

			// Try preferred layer first
			if (!this.isLayerBusy(preferredLayer, item.dateStart, item.dateEnd, processedItems)) {
				item.layer = preferredLayer;
			} else {
				// Alternating search: +1, -1, +2, -2, +3, -3...
				let assigned = false;
				const maxSearch = Math.max(items.length * 2, 100); // Reasonable upper bound

				for (let i = 1; i < maxSearch && !assigned; i++) {
					// Try +i (above)
					const layerAbove = preferredLayer + i;
					if (!this.isLayerBusy(layerAbove, item.dateStart, item.dateEnd, processedItems, item.file)) {
						item.layer = layerAbove;
						assigned = true;
						break;
					}

					// Try -i (below)
					const layerBelow = preferredLayer - i;
					if (!this.isLayerBusy(layerBelow, item.dateStart, item.dateEnd, processedItems, item.file)) {
						item.layer = layerBelow;
						assigned = true;
						break;
					}
				}

				// Fallback: if all layers are busy, use preferred and let it overlap
				if (!assigned) {
					item.layer = preferredLayer;
				}
			}

			// Record the assignment if layer changed
			if (item.layer !== previousLayer) {
				assignments.push({
					file: item.file,
					layer: item.layer!,
					previousLayer: previousLayer !== item.layer ? previousLayer : undefined
				});
			}

			// Add to processed items for overlap checking
			processedItems.push(item);
		}

		return assignments;
	}

	/**
	 * Check if a layer is busy within a list of TimelineItems.
	 * Converts date strings to TimelineDate on the fly.
	 * Use this when working with the runtime TimelineItem[] array
	 * (e.g. NoteCreator, TimelineCardManager).
	 */
	static isLayerBusyForItems(
		targetLayer: number,
		dateStart: TimelineDate,
		dateEnd: TimelineDate,
		items: TimelineItem[],
	): boolean {
		for (const item of items) {
			if (item.layer !== targetLayer) continue;
			const s = TimelineDate.fromString(item.dateStart);
			const e = TimelineDate.fromString(item.dateEnd);
			if (!s || !e) continue;
			if (this.rangesOverlap(dateStart, dateEnd, s, e)) return true;
		}
		return false;
	}

	/**
	 * Find an available layer using the standard alternating search
	 * (+1, -1, +2, -2, …) starting from `target`, checking against
	 * an existing TimelineItem[] array.
	 */
	static findAvailableLayerForItems(
		target: number,
		dateStart: TimelineDate,
		dateEnd: TimelineDate,
		items: TimelineItem[],
	): number {
		if (!this.isLayerBusyForItems(target, dateStart, dateEnd, items)) return target;

		const maxSearch = Math.max(items.length * 2, 100);
		for (let i = 1; i < maxSearch; i++) {
			if (!this.isLayerBusyForItems(target + i, dateStart, dateEnd, items)) return target + i;
			if (!this.isLayerBusyForItems(target - i, dateStart, dateEnd, items)) return target - i;
		}
		return target;
	}

	/**
	 * Sort items by date (start date, then end date) for consistent layer assignment
	 */
	static sortByDate(items: LayerableItem[]): LayerableItem[] {
		return [...items].sort((a, b) => {
			// Compare using TimelineDate comparison methods
			if (a.dateStart.isBefore(b.dateStart)) return -1;
			if (a.dateStart.isAfter(b.dateStart)) return 1;
			// If start dates are equal, compare end dates
			if (a.dateEnd.isBefore(b.dateEnd)) return -1;
			if (a.dateEnd.isAfter(b.dateEnd)) return 1;
			return 0;
		});
	}
}
