<script lang="ts">
	/**
	 * הרשת — display:grid לפי page.columns/rows.
	 * 🛑 X=0 הוא התא הימני: direction:rtl על המכולה, בלי היפוך אינדקסים בקוד
	 * (ראו docs/plans/gridset-core-design.md §7 — נשבר על ColumnSpan).
	 */
	import type { Page, RuntimeContext } from '$lib/gridset/types';
	import { VISUAL_DEFAULTS, sizeNameToFr } from '$lib/gridset/visualDefaults';
	import GridCell from './GridCell.svelte';

	let { page, ctx }: { page: Page; ctx: RuntimeContext } = $props();

	// Hidden אינו מרונדר כלל — לא רק מוסתר חזותית.
	const visibleCells = $derived(page.cells.filter((cell) => cell.visibility !== 'Hidden'));

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
</script>

<div
	class="grid"
	data-testid="grid-board"
	style="
		gap: {VISUAL_DEFAULTS.tileGap};
		grid-template-columns: {columnTemplate};
		grid-template-rows: {rowTemplate};
	"
>
	{#each visibleCells as cell, i (i)}
		<GridCell {cell} {ctx} />
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
