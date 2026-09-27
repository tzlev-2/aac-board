<script lang="ts">
	import type { CellRendererProps } from './cellRenderers';
	import type { SymbolResolution } from '$lib/gridset/symbols';
	import {
		VISUAL_DEFAULTS,
		captionBelowSymbolFontSizeCss,
		captionBelowSymbolMaxBlockCss,
		captionFontSizeCss
	} from '$lib/gridset/visualDefaults';

	let { cell, ctx, symbols = null }: CellRendererProps = $props();

	const captionAtTop = $derived(ctx?.gridSet.textAtTop ?? VISUAL_DEFAULTS.captionAtTop);
	/** תא בלי `Image` — דיו ממורכז אנכית (§4 שורות 65..134), לא מתחת לסמל. */
	const captionOnly = $derived(cell.image == null && Boolean(cell.caption));
	const captionFontSize = $derived(
		captionOnly
			? captionFontSizeCss(cell.style.fontSize)
			: captionBelowSymbolFontSizeCss(cell.style.fontSize)
	);
	const captionMaxBlock = $derived(captionOnly ? undefined : captionBelowSymbolMaxBlockCss());

	const iconBoxW = `${(VISUAL_DEFAULTS.iconBoxWidthRatio * 100).toFixed(3)}%`;
	const iconTopPad = `${(((VISUAL_DEFAULTS.iconTopRatio * 217) / 277) * 100).toFixed(3)}%`;
	const captionBottomPad = `${(((VISUAL_DEFAULTS.captionBottomMarginRatio * 217) / 277) * 100).toFixed(3)}%`;

	let resolution = $state<SymbolResolution | null>(null);
	const url = $derived(resolution?.url ?? null);
	const alt = $derived(cell.caption ? '' : (resolution?.keyword ?? ''));

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

{#snippet caption()}
	{#if cell.caption}
		<span
			class="caption"
			class:caption-only={captionOnly}
			data-testid="cell-caption"
			style="font-size: {captionFontSize}; line-height: {VISUAL_DEFAULTS.captionLineHeight}{captionMaxBlock
				? `; max-block-size: ${captionMaxBlock}`
				: ''}"
		>
			{cell.caption}
		</span>
	{/if}
{/snippet}

{#snippet symbolBox()}
	<div
		class="symbol"
		style="inline-size: {iconBoxW}; {captionAtTop ? `margin-top: ${iconTopPad};` : ''}"
	>
		{#if url}
			<img src={url} {alt} />
		{/if}
	</div>
{/snippet}

<div class="button-cell" class:caption-only={captionOnly}>
	{#if captionOnly}
		{@render caption()}
	{:else if captionAtTop}
		{@render caption()}
		{@render symbolBox()}
	{:else}
		<div class="top-gap" style="height: {iconTopPad}"></div>
		{@render symbolBox()}
		{@render caption()}
		<div class="bottom-gap" style="height: {captionBottomPad}"></div>
	{/if}
</div>

<style>
	.button-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		height: 100%;
		overflow: hidden;
		box-sizing: border-box;
	}
	.button-cell.caption-only {
		justify-content: center;
	}
	.top-gap {
		width: 100%;
		flex: 0 0 auto;
	}
	.symbol {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 1;
		min-height: 0;
	}
	.symbol img {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
	}
	.caption {
		flex: 0 0 auto;
		font: inherit;
		color: inherit;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
		box-sizing: border-box;
	}
	.bottom-gap {
		width: 100%;
		flex: 0 0 auto;
	}
</style>
