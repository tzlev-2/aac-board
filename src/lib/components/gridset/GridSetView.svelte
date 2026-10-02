<script lang="ts">
	/**
	 * החוליה שהייתה חסרה — `GridSet` אחד → מריץ חי → רשת מצוירת ולחיצה.
	 *
	 * 🔑 שלושת המנגנונים כבר קיימים ואינם נכתבים כאן: ‏`createRuntime`
	 * (‏`runtime.svelte.ts`) מחזיק את הדף הנוכחי, את חוצץ-הפלט ואת הדיבור;
	 * ‏`createSymbolResolver` (‏`symbols.ts`) פותר סמלים; ‏`GridBoard` מצייר.
	 * מה שנעשה כאן הוא חיווט ותו לא.
	 *
	 * 🛑 המריץ נוצר **פעם אחת** לכל מופע, ולא ב-`$derived`: קובץ חדש = מריץ
	 * חדש, וההחלפה נעשית ב-`{#key gridSet}` אצל הקורא. כך `#pageName` וחוצץ
	 * הפלט מתאפסים בטעינה, והיסטוריית-הניווט אינה נגררת בין לוחות.
	 */
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
		onRuntimeReady
	}: {
		gridSet: GridSet;
		/** ‏`undefined` = פותר אמיתי · `null` = בלי סמלים (בדיקות ללא רשת). */
		symbols?: SymbolResolver | null;
		runtimeOptions?: RuntimeOptions;
		editing?: boolean;
		selection?: { page: string; x: number; y: number } | null;
		onSelectCell?: (page: Page, cell: Cell) => void;
		onRuntimeReady?: (runtime: GridRuntime) => void;
	} = $props();

	// הקריאה ל-props נעשית בתוך פונקציה ולא ברמת-הסקריפט: היא **חד-פעמית
	// בכוונה** (ראו למעלה), וכך גם המהדר יודע זאת ואינו מזהיר.
	function init() {
		return {
			runtime: createRuntime(gridSet, runtimeOptions),
			resolver: symbols === undefined ? createSymbolResolver(gridSet) : symbols
		};
	}

	const { runtime, resolver } = init();
	onMount(() => {
		onRuntimeReady?.(runtime);
	});

	/**
	 * 🛑 שחרור ה-`blob:` URL-ים של המדיה המוטמעת כשהלוח מוחלף.
	 *
	 * ‏`URL.createObjectURL` מחזיק את הבייטים עד `revokeObjectURL` או עד ניווט
	 * — טעינת לוח שני הייתה משאירה את המדיה של הראשון בזיכרון. הנקודה הנכונה
	 * היא כאן ולא ב-`ButtonCell`: הפותר חי לכל אורך חיי המופע הזה, וה-`{#key
	 * gridSet}` אצל הקורא הורס אותו בדיוק כשהלוח מתחלף.
	 *
	 * ‏`$effect` בלי תלויות — רק ה-cleanup מעניין. ‏`dispose` אופציונלי בחוזה
	 * (פותר-מזויף בבדיקה אינו חייב לממש אותו).
	 */
	$effect(() => () => resolver?.dispose?.());
</script>

<GridBoard
	page={runtime.page}
	ctx={runtime}
	symbols={resolver}
	{editing}
	{selection}
	{onSelectCell}
/>
