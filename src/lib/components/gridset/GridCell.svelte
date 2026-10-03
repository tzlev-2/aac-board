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
	import { untrack } from 'svelte';
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
		editing = false,
		isCurrent,
		inspectionScope,
		inspectionHintId,
		onReadCaption,
		onCaptionAvailability
	}: {
		cell: Cell;
		editing?: boolean;
		isCurrent?: () => boolean;
		inspectionScope?: unknown;
		inspectionHintId?: string;
		onReadCaption?: (owner: HTMLElement, text: string | null) => void;
		onCaptionAvailability?: (owner: HTMLElement, unfit: boolean) => void;
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
		void executeCommands(cell, ctx, slot?.kind === 'item' ? slot.item : undefined, { isCurrent });
	}

	let unfitCaption = $state(false);
	const readable = $derived(unfitCaption && !editing && !disabled && Boolean(onReadCaption));

	function inspectCaption(owner: HTMLElement) {
		// This attachment owns every gesture/listener for the current cell and subpage.
		void cell;
		void cell.caption;
		void ctx.page;
		void slot;
		void inspectionScope;
		void editing;
		void disabled;
		const read = onReadCaption;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let pointer: { id: number; x: number; y: number } | undefined;
		let suppressClick = false;
		let returningFocus = false;
		const cancelTimer = () => {
			clearTimeout(timer);
			timer = undefined;
		};
		const hide = () => read?.(owner, null);
		const focus = () => {
			if (!returningFocus && !pointer && readable && owner.matches(':focus-visible'))
				read?.(owner, cell.caption ?? '');
		};
		const down = (event: PointerEvent) => {
			if (!event.isPrimary) return;
			cancelTimer();
			suppressClick = false;
			if (!readable || event.button !== 0) return;
			pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
			owner.setPointerCapture(event.pointerId);
			timer = setTimeout(() => {
				timer = undefined;
				suppressClick = true;
				if (readable && pointer) read?.(owner, cell.caption ?? '');
			}, 400);
		};
		const move = (event: PointerEvent) => {
			if (!pointer || pointer.id !== event.pointerId) return;
			if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) {
				cancelTimer();
				suppressClick = true;
				hide();
			}
		};
		const end = (event: PointerEvent) => {
			if (pointer?.id !== event.pointerId) return;
			cancelTimer();
			pointer = undefined;
		};
		const cancel = (event: PointerEvent) => {
			if (pointer?.id !== event.pointerId) return;
			suppressClick = true;
			hide();
			end(event);
		};
		const click = (event: MouseEvent) => {
			if (suppressClick) {
				event.preventDefault();
				event.stopImmediatePropagation();
				return;
			}
			hide();
		};
		const key = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				hide();
			} else if (event.key === 'Enter' || event.key === ' ') {
				// Native button keyboard activation still produces precisely one click.
				suppressClick = false;
				hide();
			}
		};
		const blur = (event: FocusEvent) => {
			if (
				!(event.relatedTarget instanceof Element) ||
				!event.relatedTarget.closest('[data-testid="caption-reader"]')
			)
				hide();
		};
		const restoreFocus = () => {
			returningFocus = true;
			owner.focus({ preventScroll: true });
			returningFocus = false;
		};
		const contextMenu = (event: Event) => {
			if (readable) event.preventDefault();
		};
		owner.addEventListener('pointerdown', down);
		owner.addEventListener('pointermove', move);
		owner.addEventListener('pointerup', end);
		owner.addEventListener('pointercancel', cancel);
		owner.addEventListener('lostpointercapture', cancel);
		owner.addEventListener('click', click, true);
		owner.addEventListener('focus', focus);
		owner.addEventListener('blur', blur);
		owner.addEventListener('keydown', key);
		owner.addEventListener('contextmenu', contextMenu);
		owner.addEventListener('caption-reader-close', restoreFocus);
		return () => {
			cancelTimer();
			if (pointer && owner.hasPointerCapture(pointer.id)) owner.releasePointerCapture(pointer.id);
			pointer = undefined;
			untrack(hide);
			owner.removeEventListener('pointerdown', down);
			owner.removeEventListener('pointermove', move);
			owner.removeEventListener('pointerup', end);
			owner.removeEventListener('pointercancel', cancel);
			owner.removeEventListener('lostpointercapture', cancel);
			owner.removeEventListener('click', click, true);
			owner.removeEventListener('focus', focus);
			owner.removeEventListener('blur', blur);
			owner.removeEventListener('keydown', key);
			owner.removeEventListener('contextmenu', contextMenu);
			owner.removeEventListener('caption-reader-close', restoreFocus);
		};
	}

	function captionAvailability(owner: HTMLElement) {
		const notify = onCaptionAvailability;
		const available = readable;
		untrack(() => notify?.(owner, available));
		return () => untrack(() => notify?.(owner, false));
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
	{@attach inspectCaption}
	{@attach captionAvailability}
	type={interactive ? 'button' : undefined}
	role={interactive ? 'button' : undefined}
	class="cell"
	inert={editing}
	class:disabled
	class:interactive
	data-testid="grid-cell"
	data-cell-x={cell.x}
	data-cell-y={cell.y}
	tabindex={readable && !interactive ? 0 : undefined}
	aria-describedby={readable ? inspectionHintId : undefined}
	data-caption-unfit={readable || undefined}
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
	<Renderer {cell} {ctx} {symbols} {slot} onCaptionFit={(unfit) => (unfitCaption = unfit)} />
	{#if readable}<span class="read-cue" aria-hidden="true">…</span>{/if}
</svelte:element>

<style>
	.read-cue {
		position: absolute;
		inset-block-start: 2px;
		inset-inline: 0;
		width: fit-content;
		margin-inline: auto;
		background: #fff;
		color: #111;
		border: 1px solid #111;
		border-radius: 4px;
		font: bold 16px/16px sans-serif;
		padding-inline: 2px;
		pointer-events: none;
	}
	.cell[data-caption-unfit] {
		-webkit-user-select: none;
		user-select: none;
	}
	.cell:focus-visible {
		outline: 3px solid #075dcc;
		outline-offset: -3px;
	}
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
