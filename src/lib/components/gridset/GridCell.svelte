<script lang="ts">
	/**
	 * מעטפת תא: מיקום+span (CSS Grid lines, ראו GridBoard להסבר RTL), סגנון
	 * (cell.style כפי שהוא, בלי המצאת ערכים), ו-Visibility=Disabled (מעומעם
	 * ולא לחיץ). Hidden מסונן קודם ב-GridBoard ולא מגיע לכאן בכלל.
	 *
	 * 🔑 וכאן יושבת ההפעלה: לחיצה מריצה את שרשרת-הפקודות של התא דרך
	 * `executeCommands` — הכלי היחיד שהמנוע חושף לקומפוננטה. התא אינו יודע
	 * מהי "תיקייה" ומהי "מילה": `Jump.To` ו-`Action.InsertText` הן שתי שורות
	 * באותה שרשרת, וההבדל כולו בהקשר-הריצה.
	 */
	import type { Cell, RuntimeContext } from '$lib/gridset/types';
	import { executeCommands } from '$lib/gridset/commands';
	import type { SymbolResolver } from '$lib/gridset/symbols';
	import { VISUAL_DEFAULTS, resolveFontFamily } from '$lib/gridset/visualDefaults';
	import {
		CELL_SHADOW,
		cornerClipPath,
		cornerToCss,
		resolveBackgroundCorner,
		verticalFillGradient
	} from '$lib/gridset/visualMeasured';
	import { resolveCellRenderer } from './cellRenderers';

	let {
		cell,
		ctx,
		symbols = null
	}: { cell: Cell; ctx: RuntimeContext; symbols?: SymbolResolver | null } = $props();

	const Renderer = $derived(resolveCellRenderer(cell));
	const disabled = $derived(cell.visibility === 'Disabled');
	const interactive = $derived(!disabled && cell.commands.length > 0);

	function activate() {
		if (!interactive) return;
		executeCommands(cell, ctx);
	}

	const fillGradient = $derived(verticalFillGradient(cell.style.backColour));
	const corner = $derived(
		resolveBackgroundCorner({
			shape: cell.style.backgroundShape,
			theme: ctx.gridSet.theme
		})
	);
	const borderRadius = $derived(cornerToCss(corner));
	const clipPathCss = $derived.by(() => {
		const p = cornerClipPath(corner);
		return p ? `clip-path: ${p};` : '';
	});
</script>

<svelte:element
	this={interactive ? 'button' : 'div'}
	type={interactive ? 'button' : undefined}
	role={interactive ? 'button' : undefined}
	class="cell"
	class:disabled
	class:interactive
	data-testid="grid-cell"
	data-cell-x={cell.x}
	data-cell-y={cell.y}
	aria-disabled={disabled ? 'true' : undefined}
	onclick={interactive ? activate : undefined}
	style="
		--x: {cell.x}; --y: {cell.y}; --cspan: {cell.columnSpan}; --rspan: {cell.rowSpan};
		background: {fillGradient};
		color: {cell.style.fontColour};
		border-color: {cell.style.borderColour};
		font-family: {resolveFontFamily(cell.style.fontName)};
		font-size: {cell.style.fontSize}px;
		border-width: {VISUAL_DEFAULTS.tileBorderWidth};
		border-radius: {borderRadius};
		{clipPathCss}
		padding: {VISUAL_DEFAULTS.tilePadding};
		box-shadow: {CELL_SHADOW};
		opacity: {disabled ? VISUAL_DEFAULTS.disabledOpacity : 1};
	"
>
	<Renderer {cell} {ctx} {symbols} />
</svelte:element>

<style>
	.cell {
		grid-column: calc(var(--x) + 1) / span var(--cspan);
		grid-row: calc(var(--y) + 1) / span var(--rspan);
		display: flex;
		box-sizing: border-box;
		border-style: solid;
		overflow: hidden;
		container-type: size;
		margin: 0;
		font: inherit;
		text-align: inherit;
		appearance: none;
		-webkit-appearance: none;
		background-image: none;
	}
	.cell.interactive {
		cursor: pointer;
	}
	.cell.disabled {
		pointer-events: none;
	}
</style>
