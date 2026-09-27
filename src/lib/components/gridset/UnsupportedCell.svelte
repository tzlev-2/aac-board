<script lang="ts">
	import type { CellRendererProps } from './cellRenderers';
	import { cellRendererKey } from './cellRenderers';

	let { cell }: CellRendererProps = $props();

	const key = $derived(cellRendererKey(cell));
</script>

<div class="unsupported-cell" data-testid="unsupported-cell">
	{#if cell.caption}
		<span class="caption">{cell.caption}</span>
	{/if}
	<span class="type-badge" data-testid="unsupported-cell-type">{key}</span>
</div>

<style>
	.unsupported-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
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
		font-size: 0.7em;
		opacity: 0.7;
		border: 1px dashed currentColor;
		border-radius: 4px;
		padding: 0 4px;
	}
</style>
