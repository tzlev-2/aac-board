<script lang="ts">
	import type { CellRendererProps } from './cellRenderers';
	import { VISUAL_DEFAULTS } from '$lib/gridset/visualDefaults';

	let { cell }: CellRendererProps = $props();
</script>

<div class="button-cell" style="gap: {VISUAL_DEFAULTS.tileGap}">
	{#if cell.image}
		<!-- פתירת קבצי סמל אמיתיים (arasaac.ts) מחוץ להיקף הסלייס הזה -->
		<div
			class="symbol"
			style="flex-basis: {VISUAL_DEFAULTS.iconSizeRatio * 100}%"
			title={cell.image.path}
			aria-hidden="true"
		>
			<span class="symbol-placeholder" style="font-size: {VISUAL_DEFAULTS.symbolFontSize}">🖼</span>
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
	.symbol-placeholder {
		line-height: 1;
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
