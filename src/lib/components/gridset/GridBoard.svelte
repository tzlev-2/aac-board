<script lang="ts">
	/**
	 * הרשת — display:grid לפי page.columns/rows.
	 * 🛑 X=0 הוא התא הימני: direction:rtl על המכולה, בלי היפוך אינדקסים בקוד
	 * (ראו docs/plans/gridset-core-design.md §7 — נשבר על ColumnSpan).
	 */
	import type { Cell, Page, RuntimeContext } from '$lib/gridset/types';
	import { untrack } from 'svelte';
	import { isCellAvailable } from '$lib/gridset/commands';
	import type { SymbolResolver } from '$lib/gridset/symbols';
	import { sizeNameToFr } from '$lib/gridset/visualDefaults';
	import {
		gridColourToRgb,
		gutterRatioForCellSpacing,
		verticalFillGradient
	} from '$lib/gridset/visualMeasured';
	import { pageWordList } from '$lib/gridset/wordListPager';
	import GridCell from './GridCell.svelte';
	import { cellLabel } from '../../../routes/grid/editor-messages';

	let {
		page,
		ctx,
		symbols = null,
		editing = false,
		selection = null,
		onSelectCell
	}: {
		page: Page;
		ctx: RuntimeContext;
		symbols?: SymbolResolver | null;
		editing?: boolean;
		selection?: { page: string; x: number; y: number } | null;
		onSelectCell?: (page: Page, cell: Cell) => void;
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
	// בלוחות-הדגימה כולן null, ולכן זה שקול היום ל-repeat(n, 1fr).
	const columnTemplate = $derived(
		Array.from({ length: page.columns }, (_, i) => `${sizeNameToFr(page.columnWidths[i])}fr`).join(
			' '
		)
	);
	const rowTemplate = $derived(
		Array.from({ length: page.rows }, (_, i) => `${sizeNameToFr(page.rowHeights[i])}fr`).join(' ')
	);

	const backgroundFill = $derived(
		page.background.colour ? verticalFillGradient(page.background.colour) : 'transparent'
	);

	const gutterK = $derived(gutterRatioForCellSpacing(ctx.gridSet.cellSpacing));

	/**
	 * עימוד ה-`WordList` — פאזה 3א, נמדד מ-Grid האמיתי
	 * (`derived/wordlist-overflow.md`).
	 *
	 * 🛑 **המצב מקומי ונשכח:** ‏`page` הוא של המופע הנוכחי של הדף, לא של
	 * הלוח. יציאה וחזרה ⇒ עמוד 0. **אין להחזיק אותו ב-store גלובלי.**
	 */
	let wordListPage = $state(0);
	const pageName = $derived(page.name);
	$effect(() => {
		pageName;
		wordListPage = 0;
	});

	const paged = $derived(pageWordList(page.cells, page.wordList, wordListPage));

	function navigate(action: 'next' | 'first') {
		wordListPage = action === 'next' ? wordListPage + 1 : 0;
	}

	/**
	 * תא-`WordList` בלי פריט **אינו מצויר** — לא קופסה ריקה ולא placeholder;
	 * זה רקע-לוח נקי, כפי שנמדד. תא שאינו `WordList` אינו במפה ולכן עובר.
	 */
	const drawnCells = $derived(
		editing ? page.cells : visibleCells.filter((cell) => paged.slots.get(cell)?.kind !== 'empty')
	);

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
				{cell}
				{ctx}
				{symbols}
				{editing}
				slot={paged.slots.get(cell)}
				onNavigate={navigate}
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
</div>

<style>
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
