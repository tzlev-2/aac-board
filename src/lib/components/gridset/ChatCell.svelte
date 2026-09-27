<script lang="ts">
	/**
	 * 🔑 פס-הפלט הוא תא (ContentType=Workspace, ContentSubType=Chat), לא רצועה
	 * קבועה בראש המסך. הוא נכנס ל-cellRenderers כמו כל סוג תוכן אחר, תופס תאים
	 * ברשת לפי span, ומקבל את הסגנון שלו כמו כל תא (מ-GridCell).
	 */
	import type { CellRendererProps } from './cellRenderers';
	import { VISUAL_DEFAULTS } from '$lib/gridset/visualDefaults';

	let { ctx }: CellRendererProps = $props();

	/**
	 * 🛑 **רצף-רווחים מתכווץ, בדיוק כמו ב-`OutputBuffer.text`** — כלומר מה
	 * שנראה זהה למה שנאמר.
	 *
	 * נצרב בסלייס 11: ‏`Action.Space` מצרפת רווח **לתוך** הפריט
	 * (‏`appendToStream`), והחיבור כאן מוסיף רווח **בין** פריטים. בשרשרת
	 * האמיתית ‏`Space → Punctuation → Space` (דף "מקלדת פשוטה - ספרות
	 * וסימנים" ב-`org-1`, ‏5 תאים) זה הפיק ‏"1 +  2 =  3" עם רווח כפול.
	 */
	const text = $derived(
		ctx.output.items
			.map((item) => item.text)
			.join(' ')
			.replace(/\s+/g, ' ')
			.trim()
	);
</script>

<div
	class="chat-cell"
	data-testid="chat-cell"
	role="status"
	style="padding-inline: {VISUAL_DEFAULTS.tilePadding}"
>
	<span class="output-text">{text}</span>
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
