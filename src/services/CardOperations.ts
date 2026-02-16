/**
 * CardOperations - handles move, resize, layer-change and color
 * mutations on timeline cards.
 *
 * All file writes go through FileService.updateFileDates() to
 * avoid duplicated regex-based frontmatter replacement.
 */

import { type App, type TFile, Notice } from "obsidian";
import type { TimelineItem } from "../types/timelineTypes";
import type { TimelineCacheService } from "./TimelineCacheService";
import type { TimelineColor } from "../utils/LayerManager";
import { LayerManager } from "../utils/LayerManager";
import { TimeScaleManager } from "../utils/TimeScaleManager";
import { TimelineDate } from "../utils/TimelineDate";
import { FileService } from "./FileService";

/**
 * Convert a world-X pixel position to a date string.
 */
function pixelsToDate(pixels: number, timeScale: number): string {
	const days = Math.round(TimeScaleManager.worldXToDay(pixels, timeScale));
	return TimelineDate.fromDaysFromEpoch(days).toISOString();
}

// ── Resize ──────────────────────────────────────────────────

export async function resizeItem(
	items: TimelineItem[],
	index: number,
	edge: 'left' | 'right',
	deltaX: number,
	timeScale: number,
	app: App,
	cacheService: TimelineCacheService | null,
): Promise<void> {
	const item = items[index];
	if (!item || item.type !== 'note') return;

	let newX = item.x;
	let newWidth = item.width;

	if (edge === 'left') {
		newX = item.x + deltaX;
		newWidth = item.width - deltaX;
	} else {
		newWidth = item.width + deltaX;
	}

	const newDateStart = pixelsToDate(newX, timeScale);
	const newDateEnd = pixelsToDate(newX + newWidth, timeScale);

	items[index] = { ...item, x: newX, width: newWidth, dateStart: newDateStart, dateEnd: newDateEnd };

	try {
		await FileService.updateFileDatesStatic(app, item.file, newDateStart, newDateEnd);
	} catch (error) {
		console.error(`Timeline: Failed to update dates for ${item.file.basename}:`, error);
	}
}

// ── Move ────────────────────────────────────────────────────

export async function moveItem(
	items: TimelineItem[],
	index: number,
	deltaX: number,
	deltaY: number,
	timeScale: number,
	timelineId: string,
	app: App,
	cacheService: TimelineCacheService | null,
): Promise<void> {
	const item = items[index];
	if (!item) return;

	const newX = item.x + deltaX;
	const newY = item.y + deltaY;
	const newDateStart = pixelsToDate(newX, timeScale);
	const newDateEnd = pixelsToDate(newX + item.width, timeScale);
	const newLayer = LayerManager.yToLayer(newY);
	const snappedY = LayerManager.layerToY(newLayer);

	items[index] = { ...item, x: newX, y: snappedY, dateStart: newDateStart, dateEnd: newDateEnd, layer: newLayer };

	if (item.type === 'note') {
		try {
			await FileService.updateFileDatesStatic(app, item.file, newDateStart, newDateEnd);
		} catch (error) {
			console.error(`Timeline: Failed to update dates for ${item.file.basename}:`, error);
		}
		if (cacheService) {
			const noteId = cacheService.getNoteId(item.file);
			if (noteId) {
				cacheService.setNoteLayer(timelineId, noteId, newLayer, item.file.path);
			}
		}
	}
}

// ── Layer change ────────────────────────────────────────────

export async function changeItemLayer(
	items: TimelineItem[],
	index: number,
	newLayer: number,
	newX: number,
	newWidth: number,
	timeScale: number,
	timelineId: string,
	app: App,
	cacheService: TimelineCacheService | null,
): Promise<void> {
	const item = items[index];
	if (!item) return;

	const newY = LayerManager.layerToY(newLayer);
	const newDateStart = pixelsToDate(newX, timeScale);
	const newDateEnd = pixelsToDate(newX + newWidth, timeScale);

	items[index] = { ...item, x: newX, y: newY, width: newWidth, dateStart: newDateStart, dateEnd: newDateEnd, layer: newLayer };

	if (item.type === 'note' && cacheService) {
		const noteId = cacheService.getNoteId(item.file);
		if (noteId) {
			cacheService.setNoteLayer(timelineId, noteId, newLayer, item.file.path);
		}
		try {
			await FileService.updateFileDatesStatic(app, item.file, newDateStart, newDateEnd);
		} catch (error) {
			console.error(`Timeline: Failed to update dates for ${item.file.basename}:`, error);
		}
	} else if (item.type === 'timeline' && cacheService) {
		cacheService.setTimelineCardLayer(timelineId, item.timelineId, newLayer);
	}
}

// ── Color ───────────────────────────────────────────────────

export async function applyColorToItems(
	selectedItems: TimelineItem[],
	color: TimelineColor | null,
	timelineId: string,
	app: App,
	cacheService: TimelineCacheService | null,
): Promise<{ successCount: number; failCount: number }> {
	let successCount = 0;
	let failCount = 0;

	for (const item of selectedItems) {
		if (item.type === 'note') {
			try {
				await app.fileManager.processFrontMatter(item.file, (fm) => {
					if (color) {
						fm['color'] = color;
					} else {
						delete fm['color'];
					}
				});
				item.color = color ?? undefined;
				successCount++;
			} catch (error) {
				console.error(`Timeline: Failed to apply color to ${item.file.basename}:`, error);
				failCount++;
			}
		} else if (item.type === 'timeline' && cacheService) {
			cacheService.setTimelineCardColor(timelineId, item.timelineId, color);
			item.color = color ?? undefined;
			successCount++;
		}
	}

	if (successCount > 0) {
		const label = color ? color.charAt(0).toUpperCase() + color.slice(1) : 'cleared';
		new Notice(`Applied ${label} color to ${successCount} card${successCount > 1 ? 's' : ''}`);
	}
	if (failCount > 0) {
		new Notice(`Failed to apply color to ${failCount} card${failCount > 1 ? 's' : ''}`);
	}

	return { successCount, failCount };
}
