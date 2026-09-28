<script lang="ts">
	/**
	 * 🔑 פס-הפלט הוא תא (ContentType=Workspace, ContentSubType=Chat), לא רצועה
	 * קבועה בראש המסך. הוא נכנס ל-cellRenderers כמו כל סוג תוכן אחר, תופס תאים
	 * ברשת לפי span, ומקבל את הסגנון שלו כמו כל תא (מ-GridCell).
	 */
	import type { CellRendererProps } from './cellRenderers';
	import { VISUAL_DEFAULTS } from '$lib/gridset/visualDefaults';
	import ChatChip from './ChatChip.svelte';

	let { cell, ctx, symbols = null }: CellRendererProps = $props();

	const SPACE = ' ';

	/**
	 * 🛑 **רצף-רווחים מתכווץ, בדיוק כמו ב-`OutputBuffer.text`** — כלומר מה
	 * שנראה זהה למה שנאמר.
	 *
	 * נצרב בסלייס 11: ‏`Action.Space` מצרפת רווח **לתוך** הפריט
	 * (‏`appendToStream`), והחיבור כאן מוסיף רווח **בין** פריטים. בשרשרת
	 * האמיתית ‏`Space → Punctuation → Space` (דף "מקלדת פשוטה - ספרות
	 * וסימנים" ב-`org-1`, ‏5 תאים) זה הפיק ‏"1 +  2 =  3" עם רווח כפול.
	 *
	 * בסלייס 15 הכיווץ עבר ל-`parts` (trim לכל פריט + `lead` + `{SPACE}` בין
	 * שבבים) — שקול ל-`join(' ').replace(/\s+/g, ' ').trim()` על הפריטים (§4).
	 */
	const parts = $derived.by(() => {
		let emitted = false;
		return ctx.output.items.map((item) => {
			const text = item.text.replace(/\s+/g, ' ').trim();
			const lead = Boolean(text) && emitted;
			if (text) emitted = true;
			return { text, lead, image: item.image };
		});
	});
</script>

<div
	class="chat-cell"
	data-testid="chat-cell"
	role="status"
	style="padding-inline: {VISUAL_DEFAULTS.tilePadding}"
>
	<span class="output-text">{#each parts as part}{#if part.lead}{SPACE}{/if}<ChatChip text={part.text} image={part.image} {cell} {symbols} />{/each}</span>
</div>

<style>
	.chat-cell {
		display: flex;
		align-items: center;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}
	.output-text {
		font: inherit;
		color: inherit;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
	}
</style>
