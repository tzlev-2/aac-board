<script lang="ts">
	import type { CellRendererProps } from './cellRenderers';
	import { cellRendererKey } from './cellRenderers';
	import { VISUAL_DEFAULTS } from '$lib/gridset/visualDefaults';

	let { cell }: CellRendererProps = $props();

	const key = $derived(cellRendererKey(cell));
</script>

<div
	class="unsupported-cell"
	data-testid="unsupported-cell"
	style="gap: {VISUAL_DEFAULTS.unsupportedBadgeGap}"
>
	{#if cell.caption}
		<span class="caption">{cell.caption}</span>
	{/if}
	<span
		class="type-badge"
		data-testid="unsupported-cell-type"
		style="
			font-size: {VISUAL_DEFAULTS.unsupportedBadgeFontSize};
			opacity: {VISUAL_DEFAULTS.unsupportedBadgeOpacity};
			border-radius: {VISUAL_DEFAULTS.unsupportedBadgeRadius};
		"
	>
		{key}
	</span>
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
	.type-badge {
		border: 1px dashed currentColor;
		padding: 0 4px;
	}
</style>
