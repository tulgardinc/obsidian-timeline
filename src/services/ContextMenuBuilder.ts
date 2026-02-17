/**
 * ContextMenuBuilder - constructs the right-click context menu
 * for timeline cards using Obsidian's Menu API.
 */

import { Menu } from "obsidian";
import type { TimelineItem } from "../types/timelineTypes";
import type { TimelineColor } from "../utils/LayerManager";

export interface ContextMenuCallbacks {
	onFitToView: () => void;
	onApplyColor: (color: TimelineColor | null) => void;
	onDelete: () => void;
	onRemoveTimelineCard: (timelineId: string) => void;
}

export function showCardContextMenu(
	item: TimelineItem,
	event: MouseEvent,
	callbacks: ContextMenuCallbacks,
): void {
	event.preventDefault();
	event.stopPropagation();

	const menu = new Menu();
	menu.setUseNativeMenu(false);

	// Fit to View
	menu.addItem((mi) => {
		mi.setTitle("Fit to view")
			.setIcon("maximize")
			.onClick(() => callbacks.onFitToView());
	});

	menu.addSeparator();

	// Color submenu
	menu.addItem((mi) => {
		mi.setTitle("Color").setIcon("palette");
		const colorMenu = mi.setSubmenu();
		colorMenu.setUseNativeMenu(false);

		const colorOptions: Array<{ color: TimelineColor | null; label: string; cssClass: string }> = [
			{ color: 'red', label: 'Red', cssClass: 'timeline-color-red' },
			{ color: 'blue', label: 'Blue', cssClass: 'timeline-color-blue' },
			{ color: 'green', label: 'Green', cssClass: 'timeline-color-green' },
			{ color: 'yellow', label: 'Yellow', cssClass: 'timeline-color-yellow' },
			{ color: null, label: 'Clear color', cssClass: 'timeline-color-clear' },
		];

		for (const opt of colorOptions) {
			colorMenu.addItem((ci) => {
				ci.setTitle(opt.label)
					.onClick(() => callbacks.onApplyColor(opt.color));

				requestAnimationFrame(() => {
					if (ci.dom) {
						const iconSpan = ci.dom.querySelector('.menu-item-icon');
						if (iconSpan) {
							iconSpan.className = `menu-item-icon ${opt.cssClass}`;
							iconSpan.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>';
						}
					}
				});
			});
		}
	});

	menu.addSeparator();

	// Delete / Remove
	if (item.type === 'timeline') {
		menu.addItem((mi) => {
			mi.setTitle("Remove from view")
				.setIcon("trash")
				.onClick(() => callbacks.onRemoveTimelineCard(item.timelineId));
		});
	} else {
		menu.addItem((mi) => {
			mi.setTitle("Delete")
				.setIcon("trash")
				.onClick(() => callbacks.onDelete());
		});
	}

	menu.showAtMouseEvent(event);
}
