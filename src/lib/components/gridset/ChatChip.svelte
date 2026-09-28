<script lang="ts">
	import type { Cell, ImageRef } from '$lib/gridset/types';
	import type { SymbolResolution, SymbolResolver } from '$lib/gridset/symbols';

	let {
		text,
		image,
		cell,
		symbols = null
	}: {
		text: string;
		image: ImageRef | undefined;
		/** התא האמיתי של פס-הפלט — הבסיס לתא-הנגזר (סגנון, span). */
		cell: Cell;
		symbols?: SymbolResolver | null;
	} = $props();

	const derivedCell = $derived({ ...cell, caption: text, image, commands: [] });

	let resolution = $state<SymbolResolution | null>(null);
	const url = $derived(resolution?.url ?? null);
	const alt = $derived(text ? '' : (resolution?.keyword ?? ''));

	$effect(() => {
		const resolver = symbols;
		const toResolve = derivedCell;
		resolution = null;
		if (!resolver || !image) return;
		let cancelled = false;
		void resolver.resolve(toResolve).then((resolved) => {
			if (!cancelled) resolution = resolved;
		});
		return () => {
			cancelled = true;
		};
	});
</script>

<span class="chat-chip" data-testid="chat-chip">{#if url}<img src={url} {alt} />{/if}<span class="word">{text}</span></span>

<style>
	/* לא-מאומת מול Grid — הפריסה לא נמדדה */
	.chat-chip {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		vertical-align: middle;
	}
	img {
		block-size: 2em;
		inline-size: auto;
		object-fit: contain;
	}
</style>
