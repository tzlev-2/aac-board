<script lang="ts">
	import { untrack } from 'svelte';
	import { captionFitReceipt, observeCaptionFit } from '$lib/gridset/caption-fit';
	import { fontPresentation, fontPresentationGradient } from '$lib/gridset/fontColourPresentation';
	import type { CellRendererProps } from './cellRenderers';
	import type { SymbolResolution } from '$lib/gridset/symbols';
	import {
		VISUAL_DEFAULTS,
		captionBelowSymbolFontSizeCss,
		captionBelowSymbolMaxBlockCss,
		captionFontSizeCss
	} from '$lib/gridset/visualDefaults';

	let { cell, ctx, symbols = null, onCaptionFit }: CellRendererProps = $props();

	const captionAtTop = $derived(ctx?.gridSet.textAtTop ?? VISUAL_DEFAULTS.captionAtTop);
	/** תא בלי `Image` — דיו ממורכז אנכית (§4 שורות 65..134), לא מתחת לסמל. */
	const captionOnly = $derived(cell.image == null && Boolean(cell.caption));
	const captionFontSize = $derived(
		captionOnly
			? captionFontSizeCss(cell.style.fontSize)
			: captionBelowSymbolFontSizeCss(cell.style.fontSize)
	);
	const captionMaxBlock = $derived(captionOnly ? undefined : captionBelowSymbolMaxBlockCss());

	// ערכי primitive מונעים הקמת observers מחדש כשדף אחר משתמש באותו סגנון.
	const presentationFont = $derived(cell.style.fontColour);
	const presentationBack = $derived(cell.style.backColour);
	const presentationDisabled = $derived(cell.visibility === 'Disabled');
	const presentation = $derived(
		fontPresentation(presentationFont, presentationBack, captionOnly, presentationDisabled)
	);
	function presentCaption(span: HTMLSpanElement) {
		const notify = onCaptionFit;
		const model = presentation,
			preferred = captionFontSize,
			only = captionOnly;
		// Primitive inputs rerun the owner after caption/draft/font updates.
		void cell.caption;
		void cell.style.fontName;
		const tile = span.closest<HTMLElement>('[data-testid="grid-cell"]');
		if (!tile) return;
		const forced = matchMedia('(forced-colors: active)');
		const expectedBackground = document.createElement('span').style;
		if (model.eligible)
			expectedBackground.backgroundImage = `linear-gradient(to bottom, rgb(${model.stops[0].join(', ')}), rgb(${model.stops[1].join(', ')}) 50%, rgb(${model.stops[2].join(', ')}))`;
		let disposed = false;
		const clear = () => {
			for (const property of [
				'background-image',
				'background-size',
				'background-position',
				'background-repeat',
				'background-clip',
				'-webkit-background-clip',
				'color',
				'-webkit-text-fill-color'
			])
				span.style.removeProperty(property);
		};
		const measure = () => {
			if (disposed || !span.isConnected) return;
			if (
				!model.eligible ||
				forced.matches ||
				!CSS.supports('background-clip', 'text') ||
				!CSS.supports('background-image', 'linear-gradient(to bottom in srgb, black, white)')
			)
				return clear;
			for (let el: HTMLElement | null = span; el; el = el.parentElement) {
				const style = getComputedStyle(el);
				if (
					style.opacity !== '1' ||
					style.filter !== 'none' ||
					style.mixBlendMode !== 'normal' ||
					style.backdropFilter !== 'none'
				)
					return clear;
				for (const pseudo of ['::before', '::after']) {
					const ps = getComputedStyle(el, pseudo);
					if (ps.content !== 'none' && ps.content !== 'normal') return clear;
				}
			}
			const c = tile.getBoundingClientRect(),
				r = span.getBoundingClientRect(),
				cs = getComputedStyle(tile);
			const width = parseFloat(cs.width),
				boxHeight = parseFloat(cs.height);
			const left = parseFloat(cs.borderLeftWidth),
				right = parseFloat(cs.borderRightWidth);
			const top = parseFloat(cs.borderTopWidth),
				bottom = parseFloat(cs.borderBottomWidth);
			const scaleX = c.width / width,
				scaleY = c.height / boxHeight;
			const height = boxHeight - top - bottom;
			if (!(scaleX > 0 && scaleY > 0)) return clear;
			const gradient = fontPresentationGradient(model, height);
			if (
				!gradient ||
				cs.backgroundImage !== expectedBackground.backgroundImage ||
				cs.backgroundOrigin !== 'padding-box' ||
				cs.backgroundSize !== 'auto' ||
				cs.backgroundPosition !== '0% 0%'
			)
				return clear;
			return () => {
				if (disposed || !span.isConnected) return;
				clear();
				span.style.backgroundImage = gradient;
				span.style.backgroundSize = `${width - left - right}px ${height}px`;
				span.style.backgroundPosition = `${(c.x - r.x) / scaleX + left}px ${(c.y - r.y) / scaleY + top}px`;
				span.style.backgroundRepeat = 'no-repeat';
				span.style.backgroundClip = 'text';
				span.style.webkitBackgroundClip = 'text';
				span.style.color = 'transparent';
				span.style.webkitTextFillColor = 'transparent';
			};
		};
		// Read and commit in this turn, after fitting has installed its final
		// (or restored preferred) font. No geometry closure crosses a frame.
		const paint = () => {
			if (disposed || !span.isConnected) return;
			try {
				measure()?.();
			} catch {
				clear();
			}
		};
		const stopFit = only
			? observeCaptionFit(span, preferred, () => {
					const receipt = captionFitReceipt(span);
					untrack(() => notify?.(Boolean(receipt && 'after' in receipt && !receipt.after.fits)));
					paint();
				})
			: undefined;
		const observer = new ResizeObserver(paint);
		observer.observe(span);
		observer.observe(tile);
		forced.addEventListener('change', paint);
		window.addEventListener('resize', paint);
		window.visualViewport?.addEventListener('resize', paint);
		document.fonts.addEventListener('loadingdone', paint);
		document.fonts.addEventListener('loadingerror', paint);
		void document.fonts.ready.then(paint);
		if (!only) paint();
		return () => {
			disposed = true;
			observer.disconnect();
			stopFit?.();
			untrack(() => notify?.(false));
			forced.removeEventListener('change', paint);
			window.removeEventListener('resize', paint);
			window.visualViewport?.removeEventListener('resize', paint);
			document.fonts.removeEventListener('loadingdone', paint);
			document.fonts.removeEventListener('loadingerror', paint);
			clear();
		};
	}

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
			{@attach presentCaption}
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
	/**
	 * כתובית לבדה נשברת לשורות וממלאת את התא; כתובית **מתחת לסמל** נשארת שורה
	 * אחת — וזו ההבחנה ש-`captionOnly` כבר עושה (GRID-GAPS §2).
	 * `overflow-wrap` — לא-מאומת מול Grid: שבירה **בתוך מילה** לא נמדדה, והיא
	 * כאן רק כדי שמילה בודדת ארוכה מ-התא לא תגלוש אופקית.
	 */
	.caption.caption-only {
		white-space: normal;
		overflow-wrap: break-word;
	}
	.bottom-gap {
		width: 100%;
		flex: 0 0 auto;
	}
</style>
