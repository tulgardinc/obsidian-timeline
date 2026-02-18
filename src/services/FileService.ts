import { type App, TFile } from 'obsidian';
import { LayerManager, type LayerableItem } from '../utils/LayerManager';
import { debug } from '../utils/debug';
import { TimeScaleManager } from '../utils/TimeScaleManager';
import { TimelineDate } from '../utils/TimelineDate';
import type { TimelineItem } from '../types/timelineTypes';
import type { TimelineCacheService } from './TimelineCacheService';

export interface FileServiceDependencies {
	app: App;
	timeScale: number;
	rootPath?: string;  // Root directory path to filter files, "" = entire vault
	timelineId: string;
	cacheService: TimelineCacheService;
}

export class FileService {
	private app: App;
	private timeScale: number;
	private rootPath: string;
	private timelineId: string;
	private cacheService: TimelineCacheService;

	constructor(deps: FileServiceDependencies) {
		this.app = deps.app;
		this.timeScale = deps.timeScale;
		this.rootPath = deps.rootPath ?? "";
		this.timelineId = deps.timelineId;
		this.cacheService = deps.cacheService;
	}

	setTimeScale(timeScale: number): void {
		this.timeScale = timeScale;
	}

	setRootPath(rootPath: string): void {
		this.rootPath = rootPath;
	}

	/**
	 * Check if a file path is within the configured root path
	 */
	private isFileInScope(filePath: string): boolean {
		// Empty rootPath means entire vault
		if (this.rootPath === "") {
			return true;
		}
		// Check if file path starts with the root path
		return filePath === this.rootPath || filePath.startsWith(this.rootPath + "/");
	}

	/**
	 * Collect all timeline items from markdown files within the configured root path
	 */
	async collectTimelineItems(): Promise<TimelineItem[]> {
		const layerableItems: LayerableItem[] = [];
		const allFiles = this.app.vault.getMarkdownFiles();

		for (const file of allFiles) {
			// Filter by root path
			if (!this.isFileInScope(file.path)) {
				continue;
			}

			const metadata = this.app.metadataCache.getFileCache(file);

			if (metadata?.frontmatter?.timeline !== true) {
				continue;
			}

			const dateStartRaw = metadata.frontmatter['date-start'] as unknown;
			const dateEndRaw = metadata.frontmatter['date-end'] as unknown;

			if (!dateStartRaw || !dateEndRaw) {
				debug('FileService', `Skipping ${file.basename} - missing date-start or date-end`);
				continue;
			}

			const startStr = typeof dateStartRaw === 'string' ? dateStartRaw : String(dateStartRaw as string | number);
			const endStr = typeof dateEndRaw === 'string' ? dateEndRaw : String(dateEndRaw as string | number);
			const dateStart = TimelineDate.fromString(startStr);
			const dateEnd = TimelineDate.fromString(endStr);

			if (!dateStart || !dateEnd) {
				debug('FileService', `Skipping ${file.basename} - invalid date format`);
				continue;
			}

			const colorRaw = String(metadata.frontmatter['color'] ?? '');
			const validColors = ['red', 'blue', 'green', 'yellow'] as const;
			type ValidColor = typeof validColors[number];
			const color: ValidColor | undefined = validColors.includes(colorRaw as ValidColor) ? colorRaw as ValidColor : undefined;

			layerableItems.push({
				file,
				dateStart,
				dateEnd,
				color
			});
		}

		// Generate IDs for all files that don't have one
		for (const item of layerableItems) {
			await this.cacheService.getOrCreateNoteId(item.file);
		}

		// Use cache-aware layer assignment
		this.cacheService.assignLayersWithCache(
			this.timelineId,
			layerableItems,
			(file) => this.cacheService.getNoteId(file)
		);

		// Cleanup notes that are no longer in scope
		const validNoteIds = new Set(
			layerableItems
				.map(item => this.cacheService.getNoteId(item.file))
				.filter((id): id is string => id !== undefined)
		);
		this.cacheService.cleanupOutOfScopeNotes(this.timelineId, validNoteIds);

		return this.convertToTimelineItems(layerableItems);
	}

	/**
	 * Update file dates (instance method)
	 */
	async updateFileDates(file: TFile, dateStart: string, dateEnd: string): Promise<void> {
		await FileService.updateFileDatesStatic(this.app, file, dateStart, dateEnd);
	}

	/**
	 * Update file dates (static - usable without a FileService instance)
	 */
	static async updateFileDatesStatic(app: App, file: TFile, dateStart: string, dateEnd: string): Promise<void> {
		await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm['date-start'] = dateStart;
			fm['date-end'] = dateEnd;
		});
	}

	/**
	 * Update note layer in cache (no longer writes to file)
	 */
	updateNoteLayer(file: TFile, layer: number): void {
		const noteId = this.cacheService.getNoteId(file);
		if (noteId) {
			this.cacheService.setNoteLayer(this.timelineId, noteId, layer, file.path);
		}
	}

	/**
	 * Convert LayerableItems to TimelineItems with positions
	 */
	private convertToTimelineItems(items: LayerableItem[]): TimelineItem[] {
		return items.map(item => {
			const daysFromStart = item.dateStart.getDaysFromEpoch();
			const x = TimeScaleManager.dayToWorldX(daysFromStart, this.timeScale);

			const duration = item.dateEnd.getDaysFromEpoch() - item.dateStart.getDaysFromEpoch();
			const width = Math.max(duration, 1) * this.timeScale;

			const layer = item.layer ?? 0;
			const y = LayerManager.layerToY(layer);

			return {
				type: 'note' as const,
				file: item.file,
				title: item.file.basename,
				x,
				y,
				width,
				dateStart: item.dateStart.toISOString(),
				dateEnd: item.dateEnd.toISOString(),
				layer,
				color: item.color
			};
		});
	}
}
