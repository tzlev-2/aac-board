<script lang="ts">
	import { onMount } from 'svelte';
	import type { GridSet, Page, Cell } from '$lib/gridset/types';
	import {
		createRuntime,
		type GridRuntime,
		type RuntimeOptions
	} from '$lib/gridset/runtime.svelte';
	import { createSymbolResolver, type SymbolResolver } from '$lib/gridset/symbols';
	import GridBoard from './GridBoard.svelte';

	let {
		gridSet,
		symbols,
		runtimeOptions,
		editing = false,
		selection = null,
		onSelectCell,
		onRuntimeReady,
		retainedRuntime
	}: {
		gridSet: GridSet;
		/** ‏`undefined` = פותר אמיתי · `null` = בלי סמלים (בדיקות ללא רשת). */
		symbols?: SymbolResolver | null;
		runtimeOptions?: RuntimeOptions;
		editing?: boolean;
		selection?: { page: string; x: number; y: number } | null;
		onSelectCell?: (page: Page, cell: Cell) => void;
		onRuntimeReady?: (runtime: GridRuntime) => void;
		retainedRuntime?: GridRuntime;
	} = $props();

	// הקריאה ל-props נעשית בתוך פונקציה ולא ברמת-הסקריפט: היא **חד-פעמית
	// בכוונה** (ראו למעלה), וכך גם המהדר יודע זאת ואינו מזהיר.
	function init() {
		return {
			runtime: retainedRuntime ?? createRuntime(gridSet, runtimeOptions),
			resolver: symbols === undefined ? createSymbolResolver(gridSet) : symbols
		};
	}

	const { runtime, resolver } = init();
	const attachment = runtime.attach();
	onMount(() => {
		onRuntimeReady?.(runtime);
		return () => {
			attachment.detach();
			resolver?.dispose?.();
		};
	});
</script>

<GridBoard
	page={runtime.page}
	ctx={runtime}
	pager={runtime}
	isCurrent={attachment.valid}
	symbols={resolver}
	{editing}
	{selection}
	{onSelectCell}
/>
