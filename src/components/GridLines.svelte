<script lang="ts">
	import { GRID_SPACING } from "../utils/LayerManager";

	interface Props {
		scale: number;
		translateX: number;
		translateY: number;
		viewportWidth: number;
		viewportHeight: number;
	}

	let { scale, translateX, translateY, viewportWidth, viewportHeight }: Props = $props();

	// Calculate visible horizontal grid lines (Y axis) with proper viewport culling
	let visibleLines = $derived(() => {
		const lines: Array<{ screenY: number; index: number }> = [];
		
		// Calculate the world Y coordinate range that could be visible
		const worldTop = -translateY / scale;
		const worldBottom = (-translateY + viewportHeight) / scale;
		
		// Find the first and last line indices
		const firstLine = Math.floor(worldTop / GRID_SPACING);
		const lastLine = Math.ceil(worldBottom / GRID_SPACING);
		
		for (let i = firstLine; i <= lastLine; i++) {
			// Calculate screen position
			const worldY = i * GRID_SPACING;
			const screenY = worldY * scale + translateY;
			
			// Cull lines outside viewport
			if (screenY >= -1 && screenY <= viewportHeight + 1) {
				lines.push({
					screenY,
					index: i
				});
			}
		}
		
		return lines;
	});
</script>

<div class="grid-container">
	{#each visibleLines() as line (line.index)}
		<div
			class="grid-line"
			style="top: {Math.round(line.screenY)}px; left: 0; width: {viewportWidth}px;"
		></div>
	{/each}
</div>

<style>
	.grid-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 0;
	}

	.grid-line {
		position: absolute;
		background-color: var(--background-modifier-border-hover);
		opacity: 0.6;
		height: 1px;
	}
</style>
