/**
 * CardDeletion - handles removing / trashing timeline cards.
 *
 * Consolidates the previously-duplicated single/batch patterns
 * into two batch-only functions.  Single-item calls just pass
 * a one-element array.
 */

import { type App, type TFile, Notice } from "obsidian";
import type { TimelineCacheService } from "./TimelineCacheService";

/**
 * Remove the `timeline: true` frontmatter key from each file,
 * effectively removing it from the timeline without deleting it.
 */
export async function removeCardsFromTimeline(
	files: TFile[],
	timelineId: string,
	app: App,
	cacheService: TimelineCacheService | null,
): Promise<void> {
	let successCount = 0;
	let failCount = 0;

	for (const file of files) {
		try {
			await app.fileManager.processFrontMatter(file, (fm) => {
				delete fm['timeline'];
			});
			successCount++;

			if (cacheService) {
				const noteId = cacheService.getNoteId(file);
				if (noteId) cacheService.removeNoteFromTimeline(timelineId, noteId);
			}
		} catch (error) {
			console.error(`Error removing "${file.basename}" from timeline:`, error);
			failCount++;
		}
	}

	if (successCount > 0) {
		new Notice(`Removed ${successCount} card${successCount > 1 ? 's' : ''} from timeline`);
	}
	if (failCount > 0) {
		new Notice(`Failed to remove ${failCount} card${failCount > 1 ? 's' : ''}`);
	}
}

/**
 * Move files to Obsidian's trash.
 */
export async function moveCardsToTrash(
	files: TFile[],
	timelineId: string,
	app: App,
	cacheService: TimelineCacheService | null,
): Promise<void> {
	let successCount = 0;
	let failCount = 0;

	for (const file of files) {
		try {
			await app.vault.trash(file, false);
			successCount++;

			if (cacheService) {
				const noteId = cacheService.getNoteId(file);
				if (noteId) cacheService.removeNoteFromTimeline(timelineId, noteId);
			}
		} catch (error) {
			console.error(`Error moving "${file.basename}" to trash:`, error);
			failCount++;
		}
	}

	if (successCount > 0) {
		new Notice(`Moved ${successCount} card${successCount > 1 ? 's' : ''} to trash`);
	}
	if (failCount > 0) {
		new Notice(`Failed to move ${failCount} card${failCount > 1 ? 's' : ''} to trash`);
	}
}
