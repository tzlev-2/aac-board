<script lang="ts">
	/**
	 * התא הנפוץ — כתובית + סמל.
	 *
	 * 🔑 הסמל נפתר מול ARASAAC דרך `createSymbolResolver` (הפותר מוזרק, ולא
	 * נבנה כאן). ‏**‏4 תאים מכל 10 יחזרו בלי סמל** — נמדד 61% ב-org-1 — ולכן
	 * מה שנשאר כשאין סמל (צבע התא + הכתובית) הוא **המסלול הראשי**: אין
	 * placeholder, אין אייקון-שבור, ואין אמוג'י שמסגיר חוסר.
	 * ראו docs/plans/gridset-core-design.md §6.
	 */
	import type { CellRendererProps } from './cellRenderers';
	import type { SymbolResolution } from '$lib/gridset/symbols';
	import { VISUAL_DEFAULTS, captionFontSizeCss } from '$lib/gridset/visualDefaults';

	let { cell, symbols = null }: CellRendererProps = $props();

	/**
	 * 🔑 הכתובית **מעל** הסמל, וזה ההבדל החזותי הגדול ביותר מול Grid האמיתי
	 * (‏`grid-reference/home-page.png`). ‏`TextAtTop` הוא מאפיין ברמת סדרת-הלוחות
	 * שאינו נכתב ל-XML כשהוא בברירת-המחדל — ראו `VISUAL_DEFAULTS.captionAtTop`.
	 *
	 * 🛑 הסדר נקבע ב-DOM ולא ב-`flex-direction: column-reverse`: ההגייה של
	 * מקריא-מסך הולכת אחרי ה-DOM, ותווית שמוצגת ראשונה ונקראת אחרונה היא באג.
	 */
	const captionAtTop = VISUAL_DEFAULTS.captionAtTop;
	const captionFontSize = $derived(captionFontSizeCss(cell.style.fontSize));
	const symbolMaxHeight = $derived(`${(VISUAL_DEFAULTS.iconSizeRatio * 100).toFixed(2)}cqh`);

	let resolution = $state<SymbolResolution | null>(null);
	const url = $derived(resolution?.url ?? null);
	/**
	 * 🛑 `alt` ריק כשיש כתובית — אחרת מקריא-המסך אומר "מחק מחק": הסמל והכתובית
	 * הם אותו מושג, והתמונה דקורטיבית. בלי כתובית הסמל **הוא** התווית, ואז
	 * מילת-המפתח של ARASAAC עדיפה על כפתור בלי שם.
	 */
	const alt = $derived(cell.caption ? '' : (resolution?.keyword ?? ''));

	// הפתירה אסינכרונית (רשת + קאש), ולכן $effect ולא $derived. הפותר ממזכר
	// לפי תא ולפי מפתח-חיפוש, כך שדף שחוזר אינו מחפש שוב.
	$effect(() => {
		const resolver = symbols;
		resolution = null;
		if (!resolver) return;
		let cancelled = false;
		void resolver.resolve(cell).then((resolved) => {
			if (!cancelled) resolution = resolved;
		});
		return () => {
			cancelled = true;
		};
	});
</script>

{#snippet caption()}
	{#if cell.caption}
		<span
			class="caption"
			data-testid="cell-caption"
			style="font-size: {captionFontSize}; line-height: {VISUAL_DEFAULTS.captionLineHeight}"
		>
			{cell.caption}
		</span>
	{/if}
{/snippet}

{#snippet symbol()}
	{#if url}
		<div class="symbol">
			<img src={url} {alt} style="max-block-size: {symbolMaxHeight}" />
		</div>
	{/if}
{/snippet}

<div class="button-cell" style="gap: {VISUAL_DEFAULTS.tileGap}">
	{#if captionAtTop}
		{@render caption()}
		{@render symbol()}
	{:else}
		{@render symbol()}
		{@render caption()}
	{/if}
</div>

<style>
	.button-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
	/* הסמל לוקח את כל מה שנשאר אחרי הכתובית, וממורכז בתוכו — אבל `max-block-size`
	   על ה-`img` חוסם אותו ב-`iconSizeRatio` מגובה **התא**, ולא מגובה השארית.
	   כך תא בלי כתובית אינו מקבל סמל ענק יותר מתא עם כתובית. */
	.symbol {
		flex: 1 1 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
		width: 100%;
	}
	.symbol img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	/* 🛑 `flex: 0 0 auto` הוא מה שמונע את הגזירה האנכית של הכתובית: היא מקבלת
	   את הגובה שהיא צריכה, והסמל הוא שמתכווץ. הסדר ההפוך הוא הבאג שנמדד. */
	.caption {
		flex: 0 0 auto;
		/* 🛑 `font-size` ו-`line-height` מגיעים inline: `font: inherit` היה מחזיר את
		   ה-px המוחלטים של `.cell`, וה-inline הוא מה שגובר עליו. */
		font: inherit;
		color: inherit;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}
</style>
