<script lang="ts">
	/**
	 * 🔑 פס-הפלט הוא תא (ContentType=Workspace, ContentSubType=Chat), לא רצועה
	 * קבועה בראש המסך. הוא נכנס ל-cellRenderers כמו כל סוג תוכן אחר, תופס תאים
	 * ברשת לפי span, ומקבל את הסגנון שלו כמו כל תא (מ-GridCell).
	 */
	import type { CellRendererProps } from './cellRenderers';
	import { VISUAL_DEFAULTS } from '$lib/gridset/visualDefaults';

	let { ctx }: CellRendererProps = $props();

	const text = $derived(ctx.output.items.map((item) => item.text).join(' '));
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
