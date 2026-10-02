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
	import { cellCommands, executeCommands } from '$lib/gridset/commands';
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
	import type { WordListSlot } from '$lib/gridset/wordListPager';

	let {
		cell,
		ctx,
		symbols = null,
		slot,
		onNavigate,
		editing = false
	}: {
		cell: Cell;
		editing?: boolean;
		ctx: RuntimeContext;
		symbols?: SymbolResolver | null;
		slot?: WordListSlot;
		/** תא-ניווט של WordList — העימוד הוא מצב של הדף, ולכן GridBoard מטפל. */
		onNavigate?: (action: 'next' | 'first') => void;
	} = $props();

	const Renderer = $derived(resolveCellRenderer(cell));
	const disabled = $derived(cell.visibility === 'Disabled');
	/**
	 * 🛑 תא-ניווט לחיץ למרות ש-`cell.commands` ריק — הוא מסונתז ואין לו
	 * שרשרת ב-XML. ותא-מילה מריץ את השרשרת של התא **המארח**, לא של הפריט.
	 */
	const isNav = $derived(slot?.kind === 'nav');
	/**
	 * 🛑 **`cell.commands` אינו המקור.** תא `AutoContent` שואב את שרשרתו
	 * מ-`page.autoContentCommands[contentSubType]` — ‏11 מ-11 תאי ה-`WordList`
	 * ב-`org-1/בגדים` ריקים מפקודות, ולכן חישוב על `cell.commands` הפך את
	 * כולם ל-`<div>` לא-לחיץ.
	 */
	const commands = $derived(cellCommands(cell, ctx.page));
	const interactive = $derived(!disabled && (isNav || commands.length > 0));

	function activate() {
		if (editing || !interactive) return;
		if (slot?.kind === 'nav') return onNavigate?.(slot.action);
		// הפריט נמסר להקשר: `AutoContent.Activate` אינה נושאת פרמטרים, ומה
		// שמבדיל בין משבצת למשבצת הוא הפריט שבה.
		// ‏`void` — השרשרת עשויה להכיל `CommandExecution.Wait` ואז היא נמשכת
		// אחרי הלחיצה. אין למה להמתין כאן: המצב חי ב-runes ומתעדכן מעצמו.
		void executeCommands(cell, ctx, slot?.kind === 'item' ? slot.item : undefined);
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
	inert={editing}
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
	<Renderer {cell} {ctx} {symbols} {slot} />
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
		outline: none;
	}
	/* #F28F53 — לא-מאומת מול Grid — נמדד מ-eng-02 בלבד; חסום‹studio› */
	.cell.interactive:hover {
		outline-width: calc(0.71 * var(--gutter));
		outline-style: solid;
		outline-color: #f28f53;
	}
	.cell.interactive:active {
		outline-width: calc(0.82 * var(--gutter));
		outline-style: solid;
		outline-color: #e07a3a;
	}
	.cell.disabled {
		pointer-events: none;
	}
</style>
