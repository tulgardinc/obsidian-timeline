<script lang="ts">
	import type { TFile } from "obsidian";
	import type { TimelineItem } from "../stores/timelineStore";
	import InfiniteCanvas from "./InfiniteCanvas.svelte";
	import TimelineCard from "./TimelineCard.svelte";

	interface CardHoverData {
		startX: number;
		endX: number;
		startDate: string;
		endDate: string;
		title: string;
	}

	interface Props {
		items: TimelineItem[];
		selectedIndex?: number | null;
		selectedCard?: CardHoverData | null;
		onItemResize: (index: number, newX: number, newWidth: number) => void;
		onItemMove: (index: number, newX: number, newY: number) => void;
		onItemLayerChange: (index: number, newLayer: number, newX: number, newWidth: number) => void;
		onItemClick: (index: number, event: MouseEvent) => void;
		onItemSelect: (index: number) => void;
		onUpdateSelectionData: (startX: number, endX: number, startDate: string, endDate: string) => void;
		onTimeScaleChange: (timeScale: number) => void;
		onCanvasClick?: () => void;
		// Callback to refresh items from parent
		onRefreshItems?: () => TimelineItem[];
		// Callback for context menu - parent uses Obsidian Menu API
		onItemContextMenu?: (index: number, event: MouseEvent) => void;
	}

	let { items: initialItems, selectedIndex: initialSelectedIndex = null, selectedCard: initialSelectedCard = null, onItemResize, onItemMove, onItemLayerChange, onItemClick, onItemSelect, onUpdateSelectionData, onTimeScaleChange, onCanvasClick, onRefreshItems, onItemContextMenu }: Props = $props();

	// Create local reactive state from props for optimistic updates during drag/resize
	let items = $state<TimelineItem[]>([...initialItems]);
	
	// Local reactive state for selection (can be updated from parent via setSelection)
	let selectedIndex = $state<number | null>(initialSelectedIndex);
	let selectedCard = $state<CardHoverData | null>(initialSelectedCard);

	// Export a function that TimelineView can call to refresh items
	export function refreshItems(newItems: TimelineItem[]) {
		items = [...newItems];
	}
	
	// Export a function that TimelineView can call to update selection
	export function setSelection(index: number | null, cardData: CardHoverData | null) {
		selectedIndex = index;
		selectedCard = cardData;
	}

	// Export a function to center the viewport on a specific item
	export function centerOnItem(index: number) {
		if (index >= 0 && index < items.length) {
			const item = items[index];
			if (item && infiniteCanvasRef) {
				// Center on the middle of the card
				infiniteCanvasRef.centerOn(item.x + item.width / 2, item.y);
			}
		}
	}

	// Export a function to get the center time (days from epoch)
	export function getCenterTime(): number | null {
		return infiniteCanvasRef?.getCenterTime() ?? null;
	}

	// Export a function to center on a specific time (days from epoch)
	export function centerOnTime(days: number) {
		infiniteCanvasRef?.centerOnTime(days);
	}

	// Export a function to fit a card width to the viewport (edge-to-edge)
	export function fitCardWidth(cardStartX: number, cardWidth: number) {
		infiniteCanvasRef?.fitCardWidth(cardStartX, cardWidth);
	}

	// Track if any card is being dragged or resized
	let isAnyCardDragging = $state(false);
	let isAnyCardResizing = $state(false);
	let activeResizeEdge = $state<'left' | 'right' | null>(null);

	// Reference to InfiniteCanvas for viewport control
	let infiniteCanvasRef: InfiniteCanvas;

	function handleTimeScaleChange(timeScale: number) {
		// Notify parent to recalculate items with new time scale
		if (onTimeScaleChange) {
			onTimeScaleChange(timeScale);
		}
	}

	function handleCanvasClick() {
		// Call parent's onCanvasClick if provided
		if (onCanvasClick) {
			onCanvasClick();
		}
	}

	function handleResize(index: number, newX: number, newWidth: number, finished: boolean) {
		// Update the item optimistically by creating new object for reactivity
		if (index >= 0 && index < items.length) {
			items[index] = {
				...items[index],
				x: newX,
				width: newWidth
			};
			
			// If finished, notify parent to save
			if (finished) {
				onItemResize(index, newX, newWidth);
			}
		}
	}

	function handleResizeStart(edge: 'left' | 'right') {
		isAnyCardResizing = true;
		activeResizeEdge = edge;
	}

	function handleResizeEnd() {
		isAnyCardResizing = false;
		activeResizeEdge = null;
	}

	function handleMove(index: number, newX: number, newY: number, finished: boolean) {
		// Update the item optimistically by creating new object for reactivity
		if (index >= 0 && index < items.length) {
			items[index] = {
				...items[index],
				x: newX,
				y: newY
			};
			
			// If finished, notify parent to save
			if (finished) {
				onItemMove(index, newX, newY);
			}
		}
	}

	function handleDragStart() {
		isAnyCardDragging = true;
	}

	function handleDragEnd() {
		isAnyCardDragging = false;
	}

	function handleLayerChange(index: number, newLayer: number, newX: number, newWidth: number, finished: boolean) {
		// Update the layer optimistically
		if (index >= 0 && index < items.length && finished) {
			const newY = -newLayer * 50; // GRID_SPACING = 50
			items[index] = {
				...items[index],
				x: newX,
				width: newWidth,
				layer: newLayer,
				y: newY
			};
			
			onItemLayerChange(index, newLayer, newX, newWidth);
		}
	}

	/**
	 * Handle context menu on card
	 * Passes event to parent which uses Obsidian Menu API
	 */
	function handleContextMenu(index: number, event: MouseEvent) {
		onItemContextMenu?.(index, event);
	}
</script>

<div class="timeline-view" tabindex="-1">
		<InfiniteCanvas
			bind:this={infiniteCanvasRef}
			onTimeScaleChange={handleTimeScaleChange}
			selectedCard={selectedCard}
			onCanvasClick={handleCanvasClick}
			isAnyCardDragging={isAnyCardDragging}
			isAnyCardResizing={isAnyCardResizing}
			activeResizeEdge={activeResizeEdge}
		>
			{#each items as item, index (item.file.path)}
				{@const isCardSelected = selectedIndex === index}
				<TimelineCard 
					x={item.x} 
					y={item.y} 
					width={item.width}
					title={item.title}
					layer={item.layer ?? 0}
					color={item.color}
					isSelected={isCardSelected}
				onResize={(newX, newWidth, finished) => handleResize(index, newX, newWidth, finished)}
				onMove={(newX, newY, finished) => handleMove(index, newX, newY, finished)}
				onLayerChange={(newLayer, newX, newWidth, finished) => handleLayerChange(index, newLayer, newX, newWidth, finished)}
				onClick={(event) => onItemClick(index, event)}
				onSelect={() => onItemSelect(index)}
				onUpdateSelection={(startX, endX, startDate, endDate) => onUpdateSelectionData(startX, endX, startDate, endDate)}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				onResizeStart={handleResizeStart}
				onResizeEnd={handleResizeEnd}
				onContextMenu={(event) => handleContextMenu(index, event)}
			/>
			{/each}
		</InfiniteCanvas>
</div>

<style>
	.timeline-view {
		width: 100%;
		height: 100%;
		overflow: hidden;
		position: relative;
	}
</style>
