import { App, FuzzySuggestModal } from "obsidian";
import type { TimelineViewConfig } from "../settings";

/**
 * Fuzzy finder modal for selecting a timeline view to open
 */
export class TimelineSelectorModal extends FuzzySuggestModal<TimelineViewConfig> {
	private timelines: TimelineViewConfig[];
	private onSelect: (timeline: TimelineViewConfig) => void;

	constructor(
		app: App,
		timelines: TimelineViewConfig[],
		onSelect: (timeline: TimelineViewConfig) => void
	) {
		super(app);
		this.timelines = timelines;
		this.onSelect = onSelect;
		this.setPlaceholder("Select a timeline to open...");
	}

	getItems(): TimelineViewConfig[] {
		return this.timelines;
	}

	getItemText(timeline: TimelineViewConfig): string {
		// Show name with path hint
		if (timeline.rootPath === "") {
			return `${timeline.name} (Entire vault)`;
		}
		return `${timeline.name} (${timeline.rootPath})`;
	}

	onChooseItem(timeline: TimelineViewConfig, _evt: MouseEvent | KeyboardEvent): void {
		this.onSelect(timeline);
	}
}
