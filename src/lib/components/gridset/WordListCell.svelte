<script lang="ts">
	/**
	 * תא `AutoContent/WordList` — פאזה 3א.
	 *
	 * 🔑 **אינו מצייר בעצמו.** הוא מסנתז תא-נגזר מהפריט (כיתוב + סמל)
	 * ומעביר ל-`ButtonCell`, כדי שכל העבודה החזותית שנמדדה על studio —
	 * מיקום-הכתובית, קופסת-הסמל, הגופן — תחול בלי כפילות.
	 *
	 * שלושת המצבים באים מ-`wordListPager`, שמחשב אותם ברמת הדף:
	 *   item  · מילה מ-`page.wordList`
	 *   nav   · "עוד" / "חזור" — 🛑 **תא מסונתז**, אינו ב-XML
	 *   empty · **אינו מצויר כלל** — ‏GridBoard מסנן אותו קודם
	 */
	import type { CellRendererProps } from './cellRenderers';
	import { richTextToString } from '$lib/gridset/richText';
	import ButtonCell from './ButtonCell.svelte';

	let { cell, ctx, symbols = null, slot }: CellRendererProps = $props();

	/**
	 * תא-נגזר: הכיתוב והסמל באים מהפריט, וכל השאר (סגנון, מיקום, span)
	 * נשאר של התא האמיתי.
	 * 🛑 לתא-הניווט **אין סמל** — ב-Grid יש לו אייקון (`◄●●`), אבל הוא
	 * משאב של Grid ואין לנו אותו. הכיתוב לבדו, ומסומן כפער.
	 */
	const derivedCell = $derived.by(() => {
		if (!slot) return cell;
		if (slot.kind === 'item')
			return { ...cell, caption: richTextToString(slot.item.text), image: slot.item.image };
		if (slot.kind === 'nav') return { ...cell, caption: slot.label, image: undefined };
		return cell;
	});
</script>

{#if slot?.kind === 'item' || slot?.kind === 'nav'}
	<ButtonCell cell={derivedCell} {ctx} symbols={slot.kind === 'item' ? symbols : null} />
{/if}
