<script lang="ts">
	/**
	 * הרשת — display:grid לפי page.columns/rows.
	 * 🛑 X=0 הוא התא הימני: direction:rtl על המכולה, בלי היפוך אינדקסים בקוד
	 * (ראו docs/plans/gridset-core-design.md §7 — נשבר על ColumnSpan).
	 */
	import type { Cell, Page, RuntimeContext } from '$lib/gridset/types';
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { isCellAvailable } from '$lib/gridset/commands';
	import type { SymbolResolver } from '$lib/gridset/symbols';
	import { sizeNameToFr } from '$lib/gridset/visualDefaults';
	import {
		gridColourToRgb,
		gutterRatioForCellSpacing,
		verticalFillGradient
	} from '$lib/gridset/visualMeasured';
	import {
		pageWordList,
		pagePrediction,
		displayWordList,
		hidesEmptyWordListSlot,
		isPredictionCell
	} from '$lib/gridset/wordListPager';
	import GridCell from './GridCell.svelte';
	import { cellLabel } from '../../../routes/grid/editor-messages';

	let {
		page,
		ctx,
		symbols = null,
		editing = false,
		selection = null,
		onSelectCell,
		pager,
		isCurrent
	}: {
		page: Page;
		ctx: RuntimeContext;
		symbols?: SymbolResolver | null;
		editing?: boolean;
		selection?: { page: string; x: number; y: number } | null;
		onSelectCell?: (page: Page, cell: Cell) => void;
		pager?: {
			readonly wordListPage: number;
			navigateWordList(action: 'next' | 'first'): void;
			readonly predictionPage?: number;
			navigatePrediction?(action: 'next' | 'first'): void;
		};
		isCurrent?: () => boolean;
	} = $props();

	// Hidden אינו מרונדר כלל — לא רק מוסתר חזותית.
	// ואחריו שער-הזמינות: תא שהצהרת-הדרישה שלו אינה מתקיימת אינו מצויר אך
	// שומר את משבצתו — המיקום ברשת מפורש, ולכן אין reflow. 🛑 בלי `report`
	// כאן: כתיבה ל-$state מתוך $derived אסורה ב-Svelte 5. הדיווח יושב ב-$effect.
	const visibleCells = $derived(
		page.cells.filter((cell) => cell.visibility !== 'Hidden' && isCellAvailable(cell, ctx.features))
	);

	// הצהרות-דרישה שלא ניתן היה להכריע נספרות פעם אחת לכל דף, לדוח-הכיסוי.
	$effect(() => {
		for (const cell of page.cells) {
			// מונה הדיווח אינו תלות של הדף: קריאתו וכתיבתו לא יריצו שוב את ה-effect.
			isCellAvailable(cell, ctx.features, (id) => untrack(() => ctx.reportUnimplemented(id)));
		}
	});

	// columnWidths/rowHeights (SizeName|null לכל עמודה/שורה) — null=רגיל=1fr.
	// Narrow boards can use the gutter for 44px edit targets without letting
	// their automatic minimum enlarge the tracks. Wider boards keep auto sizing.
	const columnTemplate = $derived(
		Array.from(
			{ length: page.columns },
			(_, i) => `minmax(var(--column-min, auto), ${sizeNameToFr(page.columnWidths[i])}fr)`
		).join(' ')
	);
	const rowTemplate = $derived(
		Array.from({ length: page.rows }, (_, i) => `${sizeNameToFr(page.rowHeights[i])}fr`).join(' ')
	);

	const backgroundFill = $derived(
		page.background.colour ? verticalFillGradient(page.background.colour) : 'transparent'
	);

	const gutterK = $derived(gutterRatioForCellSpacing(ctx.gridSet.cellSpacing));

	// The retained runtime owns the visible subpage. Standalone boards keep
	// their existing local pager and reset when the logical page changes.
	let wordListPage = $state(0);
	let predictionPage = $state(0);
	const pageName = $derived(page.name);
	$effect(() => {
		// Reading pageName tracks navigation while same-name preview keeps the pager.
		void pageName;
		if (!pager) {
			wordListPage = 0;
			predictionPage = 0;
		}
	});

	const displayedWordList = $derived(
		displayWordList(
			ctx.visibleWordList?.(page) ?? page.wordList,
			page.wordListSorting,
			ctx.gridSet.language
		)
	);
	const paged = $derived(
		pageWordList(page.cells, displayedWordList, pager?.wordListPage ?? wordListPage)
	);
	const predictionPaged = $derived(
		pagePrediction(page.cells, ctx.predictionList ?? [], pager?.predictionPage ?? predictionPage)
	);

	function navigate(action: 'next' | 'first') {
		if (pager) pager.navigateWordList(action);
		else wordListPage = action === 'next' ? wordListPage + 1 : 0;
	}

	function navigatePrediction(action: 'next' | 'first') {
		if (pager?.navigatePrediction) pager.navigatePrediction(action);
		else predictionPage = action === 'next' ? predictionPage + 1 : 0;
	}

	/**
	 * תא-`WordList` בלי פריט **אינו מצויר**. תא-`Prediction` בלי פריט **נשאר
	 * מסגרת גלויה** — לא מעתיקים את כלל WordList לחיזוי.
	 */
	const drawnCells = $derived(
		editing
			? page.cells
			: visibleCells.filter((cell) => {
					const slot = predictionPaged.slots.get(cell) ?? paged.slots.get(cell);
					return !hidesEmptyWordListSlot(cell, slot);
				})
	);

	const uid = $props.id();
	const hintId = `${uid}-caption-hint`;
	const unfitOwners = new SvelteSet<HTMLElement>();
	let reader = $state<{ owner: HTMLElement; text: string } | null>(null);
	function readCaption(owner: HTMLElement, text: string | null) {
		if (text !== null) reader = { owner, text };
		else if (reader?.owner === owner) reader = null;
	}
	function captionAvailability(owner: HTMLElement, unfit: boolean) {
		if (unfit) unfitOwners.add(owner);
		else {
			unfitOwners.delete(owner);
			readCaption(owner, null);
		}
	}
	function closeReader() {
		const owner = reader?.owner;
		reader = null;
		owner?.dispatchEvent(new Event('caption-reader-close'));
	}
	function showReader(element: HTMLElement) {
		// The native top layer escapes the board's size container and every clip.
		element.showPopover();
		return () => element.hidePopover();
	}

	function tileVisible(cell: Cell): boolean {
		return gridColourToRgb(cell.style.tileColour).a > 0;
	}

	function tileBackground(cell: Cell): string {
		const { r, g, b, a } = gridColourToRgb(cell.style.tileColour);
		return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
	}

	/** משבצת = שטח הרשת + חצי-מרזב לשכן, מרזב מלא לקצה (tilecolour-measured §3.2). */
	function tileMarginStyle(cell: Cell): string {
		const inlineStartEdge = cell.x === 0;
		const inlineEndEdge = cell.x + cell.columnSpan === page.columns;
		const blockStartEdge = cell.y === 0;
		const blockEndEdge = cell.y + cell.rowSpan === page.rows;
		// 🛑 לא-מאומת מול Grid — פיצול מרזב בין שכנות בצבע TileColour שונה
		const half = 'calc(-1 * var(--gutter) / 2)';
		const full = 'calc(-1 * var(--gutter))';
		return `
			margin-inline-start: ${inlineStartEdge ? full : half};
			margin-inline-end: ${inlineEndEdge ? full : half};
			margin-block-start: ${blockStartEdge ? full : half};
			margin-block-end: ${blockEndEdge ? full : half};
		`;
	}
</script>

<div class="grid-wrap" style="--grid-rows: {page.rows}; --gutter-k: {gutterK}">
	<div
		class="grid"
		data-testid="grid-board"
		data-wordlist-arm={ctx.wordListArmed ?? undefined}
		style="
			grid-template-columns: {columnTemplate};
			grid-template-rows: {rowTemplate};
			background: {backgroundFill};
		"
	>
		{#each drawnCells as cell, i (i)}
			{#if tileVisible(cell)}
				<div
					class="tile"
					data-testid="grid-tile"
					aria-hidden="true"
					style="
						--x: {cell.x}; --y: {cell.y}; --cspan: {cell.columnSpan}; --rspan: {cell.rowSpan};
						background: {tileBackground(cell)};
						{tileMarginStyle(cell)}
					"
				></div>
			{/if}
			<GridCell
				{isCurrent}
				inspectionScope={{ word: paged, pred: predictionPaged }}
				inspectionHintId={hintId}
				onReadCaption={readCaption}
				onCaptionAvailability={captionAvailability}
				{cell}
				{ctx}
				{symbols}
				{editing}
				slot={predictionPaged.slots.get(cell) ?? paged.slots.get(cell)}
				onNavigate={isPredictionCell(cell) ? navigatePrediction : navigate}
			/>
			{#if editing}
				<button
					type="button"
					class="edit-overlay"
					class:selected={selection?.page === page.name &&
						selection.x === cell.x &&
						selection.y === cell.y}
					data-testid="edit-cell"
					data-cell-x={cell.x}
					data-cell-y={cell.y}
					aria-label={cellLabel(page.name, cell.x, cell.y, cell.caption)}
					aria-pressed={selection?.page === page.name &&
						selection.x === cell.x &&
						selection.y === cell.y}
					onclick={() => onSelectCell?.(page, cell)}
					style="--x:{cell.x};--y:{cell.y};--cspan:{cell.columnSpan};--rspan:{cell.rowSpan};"
				></button>
			{/if}
		{/each}
	</div>
	{#if unfitOwners.size > 0 && !editing}
		<p class="reader-hint" id={hintId}>לחיצה ממושכת על תא המסומן … לקריאת הכיתוב המלא</p>
	{/if}
</div>

{#if reader}
	<div class="reader-layer" popover="manual" {@attach showReader} data-testid="caption-reader">
		<div class="reader-panel" role="dialog" tabindex="-1" aria-label="כיתוב מלא" aria-modal="false">
			<p class="reader-text" dir="auto" data-testid="full-caption">{reader.text}</p>
			<button type="button" onclick={closeReader}>סגירה</button>
		</div>
	</div>
{/if}
<svelte:window
	onkeydown={(event) => {
		if (reader && event.key === 'Escape') {
			event.preventDefault();
			closeReader();
		}
	}}
/>

<style>
	.reader-layer {
		position: fixed;
		inset: 0;
		margin: 0;
		width: 100%;
		height: 100dvh;
		box-sizing: border-box;
		border: 0;
		padding: 10px;
		background: rgb(0 0 0 / 35%);
	}
	.reader-layer:popover-open {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.reader-panel {
		width: 100%;
		max-height: 100%;
		overflow: auto;
		box-sizing: border-box;
		padding: 16px;
		border: 2px solid #111;
		border-radius: 12px;
		background: #fff;
		color: #111;
		font: 20px/1.4 sans-serif;
	}
	.reader-text {
		margin: 0 0 16px;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.reader-panel button {
		min-width: 44px;
		min-height: 44px;
		padding: 8px 16px;
		font: inherit;
		background: #fff;
		color: #111;
		border: 2px solid #111;
		border-radius: 6px;
		cursor: pointer;
	}
	.reader-hint {
		position: absolute;
		inset-block-start: 0;
		inset-inline: 0;
		z-index: 2;
		margin: 0;
		text-align: center;
		font: 12px/1.2 sans-serif;
		background: #fff;
		color: #111;
		pointer-events: none;
	}
	.edit-overlay {
		grid-column: calc(var(--x) + 1) / span var(--cspan);
		grid-row: calc(var(--y) + 1) / span var(--rspan);
		z-index: 3;
		background: transparent;
		border: 0;
		padding: 0;
		cursor: pointer;
		min-inline-size: 44px;
		min-block-size: 44px;
	}
	.edit-overlay.selected {
		outline: 4px solid #075dcc;
		outline-offset: 2px;
	}
	.edit-overlay:focus-visible {
		outline: 4px dashed #075dcc;
		outline-offset: 2px;
	}

	.grid-wrap {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
		height: 100%;
		width: 100%;
		container-type: size;
	}
	.grid {
		display: grid;
		direction: rtl;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		/* 🔑 מרזב = שוליים: g = k·cellH, ואותו g ל-padding ול-gap (ב-cqh). */
		--gutter: calc(
			100cqh * var(--gutter-k) / (var(--grid-rows) + var(--gutter-k) * (var(--grid-rows) + 1))
		);
		padding: var(--gutter);
		gap: var(--gutter);
	}
	@container (inline-size < 360px) {
		.grid {
			--column-min: 0px;
		}
	}
	.tile {
		grid-column: calc(var(--x) + 1) / span var(--cspan);
		grid-row: calc(var(--y) + 1) / span var(--rspan);
		box-sizing: border-box;
		z-index: 0;
		pointer-events: none;
	}
	.grid :global(.cell) {
		position: relative;
		z-index: 1;
	}
</style>
