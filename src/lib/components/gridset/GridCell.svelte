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
	import { VISUAL_DEFAULTS } from '$lib/gridset/visualDefaults';
	import { resolveCellRenderer } from './cellRenderers';

	let {
		cell,
		ctx,
		symbols = null
	}: { cell: Cell; ctx: RuntimeContext; symbols?: SymbolResolver | null } = $props();

	const Renderer = $derived(resolveCellRenderer(cell));
	const disabled = $derived(cell.visibility === 'Disabled');
	/**
	 * תא בלי שרשרת-פקודות אינו לחיץ, ולכן גם אינו כפתור: פס-הפלט
	 * (`Workspace/Chat`) ותאי-תצוגה אחרים נשארים `<div>` ואינם נכנסים לסדר
	 * המיקוד. תא עם פקודות הוא `<button>` אמיתי — מקלדת ומקריא-מסך בחינם.
	 */
	const interactive = $derived(!disabled && cell.commands.length > 0);

	function activate() {
		if (!interactive) return;
		executeCommands(cell, ctx);
	}
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
		/* איפוס ברירות-המחדל של <button> — כדי שהמעבר div→button לא ישנה
		   כלום חזותית: הגופן והצבע באים מהסגנון שלמעלה, לא מה-user agent. */
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
