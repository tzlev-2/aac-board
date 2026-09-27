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
	import type { GridSet } from '$lib/gridset/types';
	import { createRuntime, type RuntimeOptions } from '$lib/gridset/runtime.svelte';
	import { createSymbolResolver, type SymbolResolver } from '$lib/gridset/symbols';
	import GridBoard from './GridBoard.svelte';

	let {
		gridSet,
		symbols,
		runtimeOptions
	}: {
		gridSet: GridSet;
		/** ‏`undefined` = פותר אמיתי · `null` = בלי סמלים (בדיקות ללא רשת). */
		symbols?: SymbolResolver | null;
		runtimeOptions?: RuntimeOptions;
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
</script>

<GridBoard page={runtime.page} ctx={runtime} symbols={resolver} />
