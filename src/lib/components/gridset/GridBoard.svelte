<script lang="ts">
	/**
	 * הרשת — display:grid לפי page.columns/rows.
	 * 🛑 X=0 הוא התא הימני: direction:rtl על המכולה, בלי היפוך אינדקסים בקוד
	 * (ראו docs/plans/gridset-core-design.md §7 — נשבר על ColumnSpan).
	 */
	import type { Page, RuntimeContext } from '$lib/gridset/types';
	import { isCellAvailable } from '$lib/gridset/commands';
	import type { SymbolResolver } from '$lib/gridset/symbols';
	import { VISUAL_DEFAULTS, sizeNameToFr } from '$lib/gridset/visualDefaults';
	import GridCell from './GridCell.svelte';

	let {
		page,
		ctx,
		symbols = null
	}: { page: Page; ctx: RuntimeContext; symbols?: SymbolResolver | null } = $props();

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
			isCellAvailable(cell, ctx.features, (id) => ctx.reportUnimplemented(id));
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

	// רקע-הדף — Page.background.colour נפרס (#FEF6D7FF ב-org-1) ועד כה נזרק.
	// צבעי Grid הם #RRGGBBAA, שהוא בדיוק hex-with-alpha של CSS.
	const background = $derived(page.background.colour ?? 'transparent');
</script>

<div
	class="grid"
	data-testid="grid-board"
	style="
		gap: {VISUAL_DEFAULTS.tileGap};
		grid-template-columns: {columnTemplate};
		grid-template-rows: {rowTemplate};
		background-color: {background};
	"
>
	{#each visibleCells as cell, i (i)}
		<GridCell {cell} {ctx} {symbols} />
	{/each}
</div>

<style>
	.grid {
		display: grid;
		direction: rtl;
		width: 100%;
		height: 100%;
		flex: 1 1 auto;
		min-height: 0;
	}
</style>
