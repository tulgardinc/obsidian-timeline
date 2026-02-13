/**
 * Plugin context interface for dependency injection.
 * 
 * Instead of accessing the plugin via the undocumented
 * `(this.app as any).plugins.plugins['timeline']` path,
 * services receive a narrow interface describing only what
 * they actually need from the plugin.
 */

import type { TimelineViewConfig } from "../settings";

export interface TimelinePluginContext {
	/** All configured timeline views. */
	getTimelineViews(): TimelineViewConfig[];

	/** Look up a single timeline by ID. */
	findTimelineById(id: string): TimelineViewConfig | undefined;

	/** Open a timeline view in the workspace. */
	openTimelineView(config: TimelineViewConfig): Promise<void>;
}
