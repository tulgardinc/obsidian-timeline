/**
 * NoteCreator - creates new timeline notes from canvas clicks.
 *
 * Handles filename generation, frontmatter creation, layer collision
 * detection, and cache registration for new notes.
 */

import { type App, Notice } from "obsidian";
import type { TimelineItem } from "../stores/timelineStore";
import type { TimelineCacheService } from "./TimelineCacheService";
import { LayerManager } from "../utils/LayerManager";
import { TimeScaleManager } from "../utils/TimeScaleManager";
import { TimelineDate } from "../utils/TimelineDate";

/**
 * Get the number of days per unit at a given scale level.
 */
function getDaysPerUnitAtLevel(level: number): number {
	switch (level) {
		case 0: return 1;
		case 1: return 30;
		case 2: return 365;
		case 3: return 3650;
		case 4: return 36500;
		default: return 365 * Math.pow(10, level - 2);
	}
}

/**
 * Check whether a layer is occupied at a given time range.
 */
function isLayerBusy(
	layer: number,
	dateStart: TimelineDate,
	dateEnd: TimelineDate,
	items: TimelineItem[],
): boolean {
	for (const item of items) {
		if (item.layer !== layer) continue;
		const s = TimelineDate.fromString(item.dateStart);
		const e = TimelineDate.fromString(item.dateEnd);
		if (!s || !e) continue;
		if (LayerManager.rangesOverlap(dateStart, dateEnd, s, e)) return true;
	}
	return false;
}

/**
 * Find an available layer using alternating search (+1, -1, +2, …).
 */
function findAvailableLayer(
	target: number,
	dateStart: TimelineDate,
	dateEnd: TimelineDate,
	items: TimelineItem[],
): number {
	if (!isLayerBusy(target, dateStart, dateEnd, items)) return target;

	const maxSearch = Math.max(items.length * 2, 100);
	for (let i = 1; i < maxSearch; i++) {
		if (!isLayerBusy(target + i, dateStart, dateEnd, items)) return target + i;
		if (!isLayerBusy(target - i, dateStart, dateEnd, items)) return target - i;
	}
	return target;
}

/**
 * Create a new timeline note at the given world position.
 *
 * Returns the created TimelineItem (already appended to `items`),
 * or null on failure.
 */
export async function createNoteFromClick(
	event: { worldX: number; worldY: number },
	items: TimelineItem[],
	timeScale: number,
	rootPath: string,
	timelineId: string,
	app: App,
	cacheService: TimelineCacheService,
): Promise<TimelineItem | null> {
	try {
		const scaleLevel = TimeScaleManager.getScaleLevel(timeScale);
		const dayAtClick = TimeScaleManager.worldXToDay(event.worldX, timeScale);
		const snappedStartDay = TimeScaleManager.snapToNearestMarker(Math.round(dayAtClick), scaleLevel);

		const daysPerUnit = getDaysPerUnitAtLevel(scaleLevel);
		const durationDays = daysPerUnit * 3;
		const endDay = snappedStartDay + durationDays;

		const startDate = TimelineDate.fromDaysFromEpoch(snappedStartDay);
		const endDate = TimelineDate.fromDaysFromEpoch(endDay);
		const startDateStr = startDate.toISOString();
		const endDateStr = endDate.toISOString();

		const targetLayer = LayerManager.yToLayer(event.worldY);
		const finalLayer = findAvailableLayer(targetLayer, startDate, endDate, items);

		const root = rootPath === '' ? '/' : rootPath;
		const prefix = root === '/' ? '' : rootPath;
		const ymd = startDate.getYMD();
		const baseName = `Timeline note ${ymd.year}-${String(ymd.month).padStart(2, '0')}-${String(ymd.day).padStart(2, '0')}`;
		let fileName = `${baseName}.md`;
		let filePath = `${prefix}/${fileName}`;
		let counter = 1;
		while (app.vault.getAbstractFileByPath(filePath)) {
			fileName = `${baseName} ${counter}.md`;
			filePath = `${prefix}/${fileName}`;
			counter++;
		}

		const content = `---
timeline: true
date-start: ${startDateStr}
date-end: ${endDateStr}
---

# Timeline Note

Created from timeline view.
`;
		const newFile = await app.vault.create(filePath, content);

		const noteId = await cacheService.getOrCreateNoteId(newFile);
		cacheService.setNoteLayer(timelineId, noteId, finalLayer, newFile.path);

		const startX = TimeScaleManager.dayToWorldX(snappedStartDay, timeScale);
		const width = Math.max(durationDays, 1) * timeScale;
		const y = LayerManager.layerToY(finalLayer);

		const newItem: TimelineItem = {
			type: 'note',
			file: newFile,
			title: newFile.basename,
			x: startX,
			y,
			width,
			dateStart: startDateStr,
			dateEnd: endDateStr,
			layer: finalLayer,
		};

		items.push(newItem);
		new Notice(`Created note: ${newFile.basename}`);
		return newItem;
	} catch (error) {
		console.error('Timeline: Failed to create note from click:', error);
		new Notice(`Failed to create note: ${error}`);
		return null;
	}
}
