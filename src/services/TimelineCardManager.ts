/**
 * TimelineCardManager - collects and refreshes timeline-reference cards.
 *
 * A "timeline card" is a card on one timeline that represents the full
 * span of another timeline.  This module handles:
 *   - Building TimelineItem objects for referenced timelines
 *   - Calculating the time span of a referenced timeline
 *   - Async refresh when referenced timelines change
 *   - Adding / removing timeline cards from the cache
 */

import { type App, Notice } from "obsidian";
import type { TimelineItem } from "../types/timelineTypes";
import type { TimelineCacheService } from "./TimelineCacheService";
import type { TimelinePluginContext } from "../types/plugin-context";
import { FileService } from "./FileService";
import { LayerManager } from "../utils/LayerManager";
import { TimeScaleManager } from "../utils/TimeScaleManager";
import { TimelineDate } from "../utils/TimelineDate";
import { warn } from "../utils/debug";

const TAG = "TimelineCardMgr";

// ── Span calculation ────────────────────────────────────────

export async function calculateTimelineSpan(
	timelineId: string,
	rootPath: string,
	timeScale: number,
	app: App,
	cacheService: TimelineCacheService,
): Promise<{ startDay: number; endDay: number } | null> {
	const tempService = new FileService({
		app,
		timeScale,
		rootPath,
		timelineId,
		cacheService,
	});

	try {
		const items = await tempService.collectTimelineItems();
		if (items.length === 0) return null;

		let minStart = Infinity;
		let maxEnd = -Infinity;
		for (const item of items) {
			const s = TimelineDate.fromString(item.dateStart);
			const e = TimelineDate.fromString(item.dateEnd);
			if (!s || !e) continue;
			const sd = s.getDaysFromEpoch();
			const ed = e.getDaysFromEpoch();
			if (sd < minStart) minStart = sd;
			if (ed > maxEnd) maxEnd = ed;
		}
		if (minStart === Infinity || maxEnd === -Infinity) return null;
		return { startDay: minStart, endDay: maxEnd };
	} catch (error) {
		console.error(`Timeline: Error calculating span for ${timelineId}:`, error);
		return null;
	}
}

// ── Collect timeline cards ──────────────────────────────────

export async function collectTimelineCards(
	timelineId: string,
	timeScale: number,
	app: App,
	cacheService: TimelineCacheService,
	pluginCtx: TimelinePluginContext,
): Promise<TimelineItem[]> {
	const cards = cacheService.getTimelineCards(timelineId);
	if (!cards) return [];

	const items: TimelineItem[] = [];

	for (const [refId, cardData] of Object.entries(cards)) {
		const config = pluginCtx.findTimelineById(refId);
		if (!config) {
			warn(TAG, `Referenced timeline ${refId} not found, removing card`);
			cacheService.removeTimelineCard(timelineId, refId);
			continue;
		}

		const span = await calculateTimelineSpan(refId, config.rootPath, timeScale, app, cacheService);
		if (!span) {
			warn(TAG, `Could not calculate span for ${config.name}, skipping card`);
			continue;
		}

		const startX = TimeScaleManager.dayToWorldX(span.startDay, timeScale);
		const endX = TimeScaleManager.dayToWorldX(span.endDay, timeScale);
		const width = endX - startX;
		const y = LayerManager.layerToY(cardData.layer);

		const item: TimelineItem = {
			type: 'timeline',
			timelineId: refId,
			timelineName: config.name,
			title: `Timeline: ${config.name}`,
			x: startX,
			y,
			width,
			dateStart: TimelineDate.fromDaysFromEpoch(span.startDay).toISOString(),
			dateEnd: TimelineDate.fromDaysFromEpoch(span.endDay).toISOString(),
			layer: cardData.layer,
		};
		if (cardData.color) item.color = cardData.color;
		items.push(item);
	}

	return items;
}

// ── Async refresh ───────────────────────────────────────────

/**
 * Recalculate spans of all timeline cards and apply updates.
 * Returns true if any card was updated.
 */
export async function refreshTimelineCards(
	items: TimelineItem[],
	timelineId: string,
	timeScale: number,
	app: App,
	cacheService: TimelineCacheService,
	pluginCtx: TimelinePluginContext,
): Promise<boolean> {
	const tlCards = items.filter(i => i.type === 'timeline');
	if (tlCards.length === 0) return false;

	let anyUpdated = false;

	for (const card of tlCards) {
		if (card.type !== 'timeline') continue;

		const config = pluginCtx.findTimelineById(card.timelineId);
		if (!config) continue;

		const span = await calculateTimelineSpan(card.timelineId, config.rootPath, timeScale, app, cacheService);
		if (!span) continue;

		const oldStart = TimelineDate.fromString(card.dateStart)?.getDaysFromEpoch();
		const oldEnd = TimelineDate.fromString(card.dateEnd)?.getDaysFromEpoch();
		if (oldStart === span.startDay && oldEnd === span.endDay) continue;

		const startX = TimeScaleManager.dayToWorldX(span.startDay, timeScale);
		const endX = TimeScaleManager.dayToWorldX(span.endDay, timeScale);
		const idx = items.indexOf(card);
		if (idx !== -1) {
			items[idx] = {
				...card,
				x: startX,
				width: endX - startX,
				dateStart: TimelineDate.fromDaysFromEpoch(span.startDay).toISOString(),
				dateEnd: TimelineDate.fromDaysFromEpoch(span.endDay).toISOString(),
			};
			anyUpdated = true;
		}
	}
	return anyUpdated;
}

// ── Add / Remove ────────────────────────────────────────────

export async function addTimelineCard(
	items: TimelineItem[],
	timelineId: string,
	refTimelineId: string,
	timeScale: number,
	app: App,
	cacheService: TimelineCacheService,
	pluginCtx: TimelinePluginContext,
): Promise<boolean> {
	const existing = cacheService.getTimelineCards(timelineId);
	if (existing?.[refTimelineId]) {
		const config = pluginCtx.findTimelineById(refTimelineId);
		new Notice(`Timeline "${config?.name ?? refTimelineId}" is already added to this view`);
		return false;
	}

	const config = pluginCtx.findTimelineById(refTimelineId);
	if (!config) {
		new Notice(`Timeline configuration not found`);
		return false;
	}

	const span = await calculateTimelineSpan(refTimelineId, config.rootPath, timeScale, app, cacheService);
	if (!span) {
		new Notice(`Could not calculate span for timeline "${config.name}"`);
		return false;
	}

	// Find available layer using centralized alternating search
	const startDate = TimelineDate.fromDaysFromEpoch(span.startDay);
	const endDate = TimelineDate.fromDaysFromEpoch(span.endDay);
	const finalLayer = LayerManager.findAvailableLayerForItems(0, startDate, endDate, items);

	cacheService.addTimelineCard(timelineId, refTimelineId, finalLayer);
	new Notice(`Added timeline "${config.name}" to view`);
	return true;
}
