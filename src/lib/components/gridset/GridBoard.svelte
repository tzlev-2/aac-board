<script lang="ts">
	/**
	 * הרשת — display:grid לפי page.columns/rows.
	 * 🛑 X=0 הוא התא הימני: direction:rtl על המכולה, בלי היפוך אינדקסים בקוד
	 * (ראו docs/plans/gridset-core-design.md §7 — נשבר על ColumnSpan).
	 */
	import type { Page, RuntimeContext } from '$lib/gridset/types';
	import { VISUAL_DEFAULTS } from '$lib/gridset/visualDefaults';
	import GridCell from './GridCell.svelte';

	let { page, ctx }: { page: Page; ctx: RuntimeContext } = $props();

	// Hidden אינו מרונדר כלל — לא רק מוסתר חזותית.
	const visibleCells = $derived(page.cells.filter((cell) => cell.visibility !== 'Hidden'));
</script>

<div
	class="grid"
	data-testid="grid-board"
	style="
		--cols: {page.columns}; --rows: {page.rows};
		--tile-gap: {VISUAL_DEFAULTS.tileGap};
		--tile-radius: {VISUAL_DEFAULTS.tileBorderRadius};
		--tile-padding: {VISUAL_DEFAULTS.tilePadding};
		--disabled-opacity: {VISUAL_DEFAULTS.disabledOpacity};
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
		gap: var(--tile-gap);
		width: 100%;
		grid-template-columns: repeat(var(--cols), 1fr);
		grid-template-rows: repeat(var(--rows), 1fr);
	}
</style>
