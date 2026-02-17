import { Editor, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf, type MarkdownFileInfo } from 'obsidian';
import { DEFAULT_SETTINGS, type TimelinePluginSettings, TimelineSettingTab, type TimelineViewConfig, createDefaultAllTimeline } from "./settings";
import { TimelineDate } from "./utils/TimelineDate";
import { TimelineView, VIEW_TYPE_TIMELINE } from "./views/TimelineView";
import { TimelineSelectorModal } from "./modals/TimelineSelectorModal";
import { TimelineCacheService } from "./services/TimelineCacheService";
import type { TimelinePluginContext } from "./types/plugin-context";
import { debug } from "./utils/debug";

const TAG = "Plugin";

export default class TimelinePlugin extends Plugin {
	settings!: TimelinePluginSettings;
	cacheService!: TimelineCacheService;
	private fileCreateTimeout: ReturnType<typeof setTimeout> | null = null;

	// ── TimelinePluginContext implementation ─────────────────

	/**
	 * Create a narrow context object that services can use
	 * instead of reaching into the plugin via `(app as any).plugins`.
	 */
	createPluginContext(): TimelinePluginContext {
		return {
			getTimelineViews: () => this.settings.timelineViews,
			findTimelineById: (id: string) =>
				this.settings.timelineViews.find((t: TimelineViewConfig) => t.id === id),
			openTimelineView: (config: TimelineViewConfig) =>
				this.openTimelineView(config),
		};
	}

	// ── Lifecycle ────────────────────────────────────────────

	async onload() {
		await this.loadSettings();

		// Initialize cache service
		this.cacheService = new TimelineCacheService(this.app);
		await this.cacheService.initialize();

		// Register the Timeline view with cache service and plugin context
		this.registerView(
			VIEW_TYPE_TIMELINE,
			(leaf: WorkspaceLeaf) => {
				const view = new TimelineView(leaf);
				view.setCacheService(this.cacheService);
				view.setPluginContext(this.createPluginContext());
				return view;
			}
		);

		// Add ribbon icon to open Timeline view
		this.addRibbonIcon('calendar', 'Open timeline view', () => {
			this.openTimelineSelector();
		});

		// Add command to open Timeline view (fuzzy finder)
		this.addCommand({
			id: 'open-view',
			name: 'Open view',
			callback: () => {
				this.openTimelineSelector();
			}
		});

		// Add command to undo last timeline operation
		this.addCommand({
			id: 'undo',
			name: 'Undo last change',
			callback: () => {
				const view = this.app.workspace.getActiveViewOfType(TimelineView);
				if (view) {
					void view.undo();
				}
			}
		});

		// Add command to redo last undone timeline operation
		this.addCommand({
			id: 'redo',
			name: 'Redo last change',
			callback: () => {
				const view = this.app.workspace.getActiveViewOfType(TimelineView);
				if (view) {
					void view.redo();
				}
			}
		});

		// Add command to go to a specific note in the timeline
		this.addCommand({
			id: 'go-to-note',
			name: 'Go to note',
			callback: async () => {
				const view = this.app.workspace.getActiveViewOfType(TimelineView);
				if (!view || view.timelineItems.length === 0) {
					new Notice('No timeline items available');
					return;
				}
				try {
					const { TimelineItemSuggestModal } = await import('./modals/TimelineItemSuggestModal');
					new TimelineItemSuggestModal(
						this.app,
						view.timelineItems,
						(item) => view.goToItem(item)
					).open();
				} catch (error) {
					console.error('Timeline: Failed to load suggest modal:', error);
				}
			}
		});

		// Add command to view current note in timeline (fit to view)
		this.addCommand({
			id: 'view-current-note',
			name: 'View current note',
			editorCallback: async (_editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
				const file = ctx.file;
				if (!file) return;

				const timeline = this.findTimelineForFile(file.path);
				if (!timeline) return;

				await this.openTimelineView(timeline);

				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);
				const targetLeaf = leaves.find(leaf => {
					const view = leaf.view as TimelineView;
					return view.getTimelineId() === timeline.id;
				});
				if (!targetLeaf) return;

				const timelineView = targetLeaf.view as TimelineView;
				if (timelineView) {
					timelineView.fitToCardByPath(file.path);
				}
			}
		});

		// Add command to add a timeline card to the current timeline
		this.addCommand({
			id: 'add-card',
			name: 'Add card',
			callback: () => {
				const view = this.app.workspace.getActiveViewOfType(TimelineView);
				if (!view) {
					new Notice('No active timeline view');
					return;
				}

				const timelines = this.settings.timelineViews;
				if (timelines.length === 0) {
					new Notice('No timelines configured');
					return;
				}

				new TimelineSelectorModal(
					this.app,
					timelines,
					(timeline) => { void view.addTimelineCard(timeline.id, timeline.name); }
				).open();
			}
		});

		this.addSettingTab(new TimelineSettingTab(this.app, this));

		// Listen for view state restoration to configure timeline views
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.configureTimelineViews();
			})
		);

		// Listen for file rename events to update cache
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile) {
					this.cacheService.handleFileRename(oldPath, file.path);
				}
			})
		);

		// Listen for file delete events to remove from cache and refresh views
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					const removed = this.cacheService.handleFileDelete(file.path);
					if (removed) {
						this.refreshOpenTimelineViews();
					}
				}
			})
		);

		// Listen for file create events to auto-add timeline files
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					// Debounce to allow metadata cache to populate
					if (this.fileCreateTimeout) clearTimeout(this.fileCreateTimeout);
					this.fileCreateTimeout = setTimeout(() => {
						this.fileCreateTimeout = null;
						this.handleFileCreate(file);
					}, 100);
				}
			})
		);

		debug(TAG, "Timeline plugin loaded");
	}

	onunload() {
		if (this.fileCreateTimeout) {
			clearTimeout(this.fileCreateTimeout);
			this.fileCreateTimeout = null;
		}
		void this.cacheService.forceSave();
	}

	// ── Helpers ──────────────────────────────────────────────

	findTimelineForFile(filePath: string): TimelineViewConfig | null {
		const timelines = this.settings.timelineViews;
		if (timelines.length === 0) return null;

		const parts = filePath.split('/');
		parts.pop();

		const ancestorPaths: string[] = [];
		for (let i = parts.length; i >= 0; i--) {
			ancestorPaths.push(parts.slice(0, i).join('/'));
		}

		for (const ancestorPath of ancestorPaths) {
			const match = timelines.find((t: TimelineViewConfig) => t.rootPath === ancestorPath);
			if (match) return match;
		}

		return timelines.find((t: TimelineViewConfig) => t.rootPath === "") ?? null;
	}

	private configureTimelineViews(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof TimelineView && view.getTimelineId && view.getTimelineId()) {
				const config = this.settings.timelineViews.find((t: TimelineViewConfig) => t.id === view.getTimelineId());
				if (config) {
					view.setTimelineConfig(config);
				}
			}
		}
	}

	openTimelineSelector(): void {
		const timelines = this.settings.timelineViews;
		if (timelines.length === 0) {
			new Notice('No timelines configured. Open settings to create one.');
			return;
		}
		if (timelines.length === 1) {
			void this.openTimelineView(timelines[0]!);
			return;
		}
		new TimelineSelectorModal(
			this.app,
			timelines,
			(timeline) => void this.openTimelineView(timeline)
		).open();
	}

	async openTimelineView(config: TimelineViewConfig): Promise<void> {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof TimelineView && typeof view.getTimelineId === 'function' && view.getTimelineId() === config.id) {
				await workspace.revealLeaf(leaf);
				return;
			}
			const viewState = leaf.getViewState();
			if (viewState?.type === VIEW_TYPE_TIMELINE && viewState.state?.timelineId === config.id) {
				await workspace.revealLeaf(leaf);
				const revealedView = leaf.view;
				if (revealedView instanceof TimelineView) {
					revealedView.setTimelineConfig(config);
				}
				return;
			}
		}

		const leaf = workspace.getRightLeaf(false);
		if (!leaf) {
			new Notice("Could not create timeline view");
			return;
		}

		await leaf.setViewState({
			type: VIEW_TYPE_TIMELINE,
			active: true,
			state: { timelineId: config.id }
		});

		await workspace.revealLeaf(leaf);
		await new Promise(resolve => requestAnimationFrame(resolve));

		const view = leaf.view as TimelineView;
		if (view) {
			view.setTimelineConfig(config);
		}
	}

	/**
	 * Re-apply config to all open timeline views (e.g. after icon or name change in settings)
	 */
	updateOpenTimelineViews(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof TimelineView) {
				const config = this.settings.timelineViews.find(
					(t: TimelineViewConfig) => t.id === view.getTimelineId()
				);
				if (config) {
					view.setTimelineConfig(config);
				}
			}
		}
	}

	/**
	 * Refresh all open timeline views (e.g. after file deletion or creation)
	 */
	refreshOpenTimelineViews(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof TimelineView) {
				view.scheduleRefresh();
			}
		}
	}

	/**
	 * Handle new file creation - check if it's a timeline file and refresh relevant views
	 */
	private handleFileCreate(file: TFile): void {
		const metadata = this.app.metadataCache.getFileCache(file);
		const isTimelineFile = metadata?.frontmatter?.['timeline'] === true;
		
		if (!isTimelineFile) return;
		
		// Find which timeline(s) this file belongs to and refresh those views
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);
		for (const leaf of leaves) {
			const view = leaf.view;
			if (view instanceof TimelineView) {
				const rootPath = view.getRootPath();
				// Check if file is within this timeline's scope
				if (rootPath === "" || file.path.startsWith(rootPath + "/") || file.path === rootPath) {
					// Skip if the view already contains this file (e.g. created via canvas click)
					const alreadyPresent = view.timelineItems.some(
						i => i.type === 'note' && i.file.path === file.path
					);
					if (!alreadyPresent) {
						view.scheduleRefresh();
					}
				}
			}
		}
	}

	deleteTimelineCache(timelineId: string): void {
		this.cacheService.deleteTimeline(timelineId);
	}

	async loadSettings() {
		const savedData = await this.loadData() as Partial<TimelinePluginSettings> | null;

		if (!savedData || !savedData.timelineViews) {
			this.settings = { ...DEFAULT_SETTINGS };
		} else {
			this.settings = {
				timelineViews: savedData.timelineViews,
				dateFormat: savedData.dateFormat ?? DEFAULT_SETTINGS.dateFormat,
			};
		}

		// Apply date format globally
		TimelineDate.setDateFormat(this.settings.dateFormat);

		if (this.settings.timelineViews.length === 0) {
			this.settings.timelineViews.push(createDefaultAllTimeline());
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
