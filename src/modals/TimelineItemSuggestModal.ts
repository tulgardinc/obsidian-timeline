import { FuzzySuggestModal, App } from "obsidian";
import type { TimelineItem } from "../stores/timelineStore";

export class TimelineItemSuggestModal extends FuzzySuggestModal<TimelineItem> {
	private items: TimelineItem[];
	private onSelect: (item: TimelineItem) => void;

	constructor(app: App, items: TimelineItem[], onSelect: (item: TimelineItem) => void) {
		super(app);
		this.items = items;
		this.onSelect = onSelect;
		this.setPlaceholder("Search for a note in the timeline...");
	}

	getItems(): TimelineItem[] {
		return this.items;
	}

	getItemText(item: TimelineItem): string {
		return item.title;
	}

	onChooseItem(item: TimelineItem, evt: MouseEvent | KeyboardEvent): void {
		this.onSelect(item);
		this.close();
	}
}
