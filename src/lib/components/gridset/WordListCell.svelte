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
	 *
	 * ✅ **עודכן 28.9.2026 — לתא-הניווט כן יש הפניית-אייקון, והיא אומתה.**
	 * ‏`[grid3x]autocells_next.wmf` ו-`[grid3x]autocells_start.wmf`; הראיה
	 * והמגבלות ב-`wordListPager.ts` ליד `WORDLIST_NAV_IMAGES`. ההערה שהייתה
	 * כאן ניחשה את הצורה (`◄●●`) — **זה נמשך ונמחק**, כי אייקון משוער בתיעוד
	 * מכוון עבודה עתידית לכיוון שאין לו עוגן.
	 *
	 * 🛑 בפועל הוא כמעט ודאי לא ייפתר: ‏`[grid3x]` הוא ספרייה חיצונית של Grid
	 * שאינה בידינו, ו-`.wmf` אינו נתמך בדפדפן. ההפניה נמסרת לשרשרת-הפתירה
	 * **הרגילה**, ונופלת לכיתוב-לבדו בדיוק כמו כל ref אחר של `[grid3x]`.
	 * אין כאן מסלול מיוחד, ואין placeholder.
	 */
	const derivedCell = $derived.by(() => {
		if (!slot) return cell;
		if (slot.kind === 'item')
			return { ...cell, caption: richTextToString(slot.item.text), image: slot.item.image };
		if (slot.kind === 'nav') return { ...cell, caption: slot.label, image: slot.image };
		return cell;
	});
</script>

{#if slot?.kind === 'item' || slot?.kind === 'nav'}
	<ButtonCell cell={derivedCell} {ctx} {symbols} />
{/if}
