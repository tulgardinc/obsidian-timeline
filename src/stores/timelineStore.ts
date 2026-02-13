/**
 * Timeline item type definitions.
 *
 * These types are the core data model shared between the view layer
 * (TimelineView, Svelte components) and the service layer
 * (FileService, CardOperations, etc.).
 *
 * The Svelte writable store that previously lived here was unused -
 * all state flows through props from TimelineView to Svelte components.
 */

import type { TFile } from 'obsidian';
import type { TimelineColor } from '../utils/LayerManager';

export interface TimelineItemBase {
	title: string;
	x: number;
	y: number;
	width: number;
	dateStart: string;
	dateEnd: string;
	layer?: number;
	color?: TimelineColor;
}

export interface NoteTimelineItem extends TimelineItemBase {
	type: 'note';
	file: TFile;
}

export interface TimelineRefItem extends TimelineItemBase {
	type: 'timeline';
	timelineId: string;
	timelineName: string;
}

export type TimelineItem = NoteTimelineItem | TimelineRefItem;
