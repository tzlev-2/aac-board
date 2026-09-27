<script lang="ts">
	/**
	 * מעטפת תא: מיקום+span (CSS Grid lines, ראו GridBoard להסבר RTL), סגנון
	 * (cell.style כפי שהוא, בלי המצאת ערכים), ו-Visibility=Disabled (מעומעם
	 * ולא לחיץ). Hidden מסונן קודם ב-GridBoard ולא מגיע לכאן בכלל.
	 */
	import type { Cell, RuntimeContext } from '$lib/gridset/types';
	import { VISUAL_DEFAULTS } from '$lib/gridset/visualDefaults';
	import { resolveCellRenderer } from './cellRenderers';

	let { cell, ctx }: { cell: Cell; ctx: RuntimeContext } = $props();

	const Renderer = $derived(resolveCellRenderer(cell));
	const disabled = $derived(cell.visibility === 'Disabled');
</script>

<div
	class="cell"
	class:disabled
	data-testid="grid-cell"
	data-cell-x={cell.x}
	data-cell-y={cell.y}
	aria-disabled={disabled ? 'true' : undefined}
	style="
		--x: {cell.x}; --y: {cell.y}; --cspan: {cell.columnSpan}; --rspan: {cell.rowSpan};
		background-color: {cell.style.backColour};
		color: {cell.style.fontColour};
		border-color: {cell.style.borderColour};
		font-family: {cell.style.fontName};
		font-size: {cell.style.fontSize}px;
		border-width: {VISUAL_DEFAULTS.tileBorderWidth};
		border-radius: {VISUAL_DEFAULTS.tileBorderRadius};
		padding: {VISUAL_DEFAULTS.tilePadding};
		opacity: {disabled ? VISUAL_DEFAULTS.disabledOpacity : 1};
	"
>
	<Renderer {cell} {ctx} />
</div>

<style>
	.cell {
		grid-column: calc(var(--x) + 1) / span var(--cspan);
		grid-row: calc(var(--y) + 1) / span var(--rspan);
		display: flex;
		box-sizing: border-box;
		border-style: solid;
		overflow: hidden;
	}
	.cell.disabled {
		pointer-events: none;
	}
</style>
