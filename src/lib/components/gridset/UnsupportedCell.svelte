<script lang="ts">
	/**
	 * סוג-תוכן שאין לו מרנדר — ‏695 מ-2,060 תאי org-1 (33.7%), וב-org-2
	 * 1,344 מ-3,984; יש דף שבו 15 מ-24 התאים כאלה.
	 *
	 * 🛑 ולכן זה **אינו מצב-שגיאה אלא מצב רגיל**, והוא נראה כמו תא שקט:
	 * הכתובית מוצגת, והמפתח הטכני (`AutoContent/WordList`) **אינו** — הוא
	 * מפתח-פיתוח באנגלית, ומורה שרואה אותו על שליש מהלוח רואה לוח שבור.
	 * המפתח נשאר על ה-DOM כ-`data-unsupported-type` לדיאגנוסטיקה ולבדיקות.
	 */
	import type { CellRendererProps } from './cellRenderers';
	import { cellRendererKey } from './cellRenderers';

	let { cell }: CellRendererProps = $props();

	const key = $derived(cellRendererKey(cell));
</script>

<div class="unsupported-cell" data-testid="unsupported-cell" data-unsupported-type={key}>
	{#if cell.caption}
		<span class="caption">{cell.caption}</span>
	{/if}
</div>

<style>
	.unsupported-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		overflow: hidden;
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
