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
	import { VISUAL_DEFAULTS } from '$lib/gridset/visualDefaults';

	let { cell, symbols = null }: CellRendererProps = $props();

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

<div class="button-cell" style="gap: {VISUAL_DEFAULTS.tileGap}">
	{#if url}
		<div class="symbol" style="flex-basis: {VISUAL_DEFAULTS.iconSizeRatio * 100}%">
			<img src={url} {alt} />
		</div>
	{/if}
	{#if cell.caption}
		<span class="caption">{cell.caption}</span>
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
	.symbol {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 0;
	}
	.symbol img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	.caption {
		font: inherit;
		color: inherit;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}
</style>
