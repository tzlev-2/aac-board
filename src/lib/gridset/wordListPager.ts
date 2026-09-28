/**
 * עימוד תאי `AutoContent/WordList` — פאזה 3א.
 *
 * 🔑 **נמדד מ-Grid 3 האמיתי על studio**, לא נגזר מה-XML:
 * `tzlev-docs-repo/aac-board/grid-reference/derived/wordlist-overflow.md`
 * (‏5 דפים, ‏12 צילומים, טבלת `(X,Y)→טקסט` מול סדר ה-XML בכל אחד).
 *
 * העודף **אינו נחתך ואינו נגלל — הוא מעומד**. שלושת המרכיבים אינם נגזרים
 * זה מזה, וכל אחד ניתן לשבור בנפרד:
 *
 *   1. סדר המילוי הוא **`(y,x)` ממוין** — ולא סדר-המסמך.
 *   2. קיבולת עמוד היא **`C − 1`** כשיש גלישה (התא האחרון נתפס לניווט).
 *   3. תא-הניווט **מסונתז** — הוא תא אמיתי מה-XML שמחליף תוכן, והכיתוב
 *      בא ממחרוזות Grid ולא מהלוח.
 *
 * ‏**‏32.8% מהפריטים (‏841 מ-2,565) יושבים מעבר לעמוד הראשון** — כלומר
 * מימוש בלי עימוד מעלים שליש מאוצר-המילים.
 */

import type { Cell, ImageRef, WordListItem } from './types';

/**
 * כיתובי תא-הניווט — **אינם מגיעים מהלוח**, הם מחרוזות של Grid עצמו.
 *
 * ## ✅ אומת מול Grid, ‏28.9.2026 — הכיתובים **לא** הומצאו
 *
 * המקור הוא קובץ-התרגום של Grid עצמו,
 * ‏`~/work/grid-mapping/raw/he-IL.ts` (‏Qt ‏`.ts`, ‏1.08MB), בהקשר
 * ‏`<name>Auto Content</name>` (שורה 925). שתי הרשומות, מילה-במילה:
 *
 * | שורות | `<source>` | `<comment>` | `<translation>` |
 * |---|---|---|---|
 * | 1025–1029 | `More` | *"Caption for item automatically added to auto content to go to the next page"* | **`עוד`** |
 * | 938–942 | `Back` | *"Caption for item automatically added to auto content to go back to the start from the last page"* | **`חזור`** |
 *
 * 🔑 ה-`<comment>` הוא העוגן ולא רק התרגום: הוא אומר במפורש *item
 * automatically added to auto content* — כלומר בדיוק התא המסונתז הזה, ולא
 * כפתור-ניווט כללי. ‏`first` ולא `back` בשמנו כי המשמעות היא *"to the
 * start"*, ‏`Back` הוא רק ה-`source` האנגלי.
 *
 * ## האייקון — השם אומת, הקובץ אינו בידינו
 *
 * משפחת האייקונים של Grid לעימוד תוכן-אוטומטי היא `[grid3x]autocells_*`,
 * ‏נמדדה על 116 קבצים: ‏`autocells_next` ‏1,049 · `autocells_previous` ‏188 ·
 * ‏`autocells_start` ‏4 · `autocells_end` ‏2. ההצמדות לכיתוב:
 *
 * | אייקון | כיתובים שנצפו לידו |
 * |---|---|
 * | `autocells_next.wmf` | `More` ‏687 · **`עוֹד` ‏113** · `עוד` ‏25 · `More words` ‏48 |
 * | `autocells_start.wmf` | **`חזור` — ב-`org-1` עצמו**, עם `Jump.Home` · `Back` (b100) · `first page` (b097/b098) |
 *
 * ⚠️ **מה שזה כן מוכיח ומה שלא.** התאים שנמצאו הם תאים **שנכתבו ביד**
 * (שרשרתם `Jump.Home` / `Prediction.MoreWords`), ולא התא **המסונתז**. הראיה
 * היא לאוצר-האייקונים של Grid ולהצמדה שלו לכיתוב — ‏`autocells_start`
 * ‏+ `חזור` נמצאים יחד באותו תא ב-`org-1`. היא **אינה** צילום של התא המסונתז.
 *
 * 🛑 **ולכן האייקון אינו מוצג.** ‏`[grid3x]` היא ספרייה חיצונית שנשלחת עם
 * Grid ואינה בתוך אף `.gridset`, והסיומת `.wmf` היא Windows Metafile שאף
 * דפדפן אינו מרנדר. ה-`ImageRef` נמסר בכל זאת לשרשרת-הפתירה הרגילה
 * (‏`symbols.ts`) — שם `[grid3x]` נפתר ב-41% דרך שם-הבסיס, וכאן כמעט ודאי
 * לא ייפתר, וייפול לכיתוב לבדו. זה בדיוק מה שקורה לכל ref של `[grid3x]`,
 * ואין כאן מסלול מיוחד.
 */
export const WORDLIST_NAV_LABELS = {
	next: 'עוד',
	first: 'חזור'
} as const;

/**
 * הפניות-האייקון של Grid לתא-הניווט. ‏`library: 'grid3x'` ולא `''` — זו
 * הפניית-ספרייה חיצונית, לא מדיה מוטמעת, ולכן `embeddedMedia` אינו נוגע בה.
 */
export const WORDLIST_NAV_IMAGES: { readonly next: ImageRef; readonly first: ImageRef } = {
	next: { library: 'grid3x', path: 'autocells_next.wmf' },
	first: { library: 'grid3x', path: 'autocells_start.wmf' }
};

export type WordListSlot =
	| { kind: 'item'; item: WordListItem; index: number }
	| {
			kind: 'nav';
			action: 'next' | 'first';
			label: string;
			/** האייקון של Grid לפעולה הזאת. אומת בשמו; ראו למעלה למה אינו מוצג. */
			image: ImageRef;
	  }
	| { kind: 'empty' };

export interface WordListPage {
	/** תא → מה מוצג בו. תא שאינו במפה אינו תא-`WordList`. */
	slots: Map<Cell, WordListSlot>;
	pageCount: number;
	/** קיבולת פריטים לעמוד: `C` בלי גלישה, `C − 1` עם. */
	capacity: number;
}

/** האם התא הוא תא-`WordList` שהעימוד חל עליו. */
export function isWordListCell(cell: Cell): boolean {
	return cell.contentType === 'AutoContent' && cell.contentSubType === 'WordList';
}

/**
 * 🛑 **המלכודת המסוכנת ביותר כאן.** ‏`parse.ts` מחזיר תאים בסדר-המסמך,
 * ו-**‏54 מ-146 דפי ה-`WordList` (‏37%) שומרים אותם בסדר שאינו `(y,x)`**.
 * מימוש שמסתמך על סדר-המערך נראה נכון ב-`בגדים` (ששם הסדרים זהים במקרה)
 * ומתבלבל ב-`org-2/ארצות`.
 */
export function orderWordListCells(cells: Cell[]): Cell[] {
	return cells.filter(isWordListCell).sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * מחשב מה מוצג בכל תא-`WordList` בעמוד נתון.
 *
 * @param pageIndex עמוד מבוסס-0. מקוצץ לטווח החוקי.
 */
export function pageWordList(
	cells: Cell[],
	items: readonly WordListItem[],
	pageIndex = 0
): WordListPage {
	const order = orderWordListCells(cells);
	const slots = new Map<Cell, WordListSlot>();
	const cellCount = order.length;

	if (cellCount === 0) return { slots, pageCount: 0, capacity: 0 };

	const overflows = items.length > cellCount;

	// 🛑 `C = 1` עם גלישה ייתן `capacity = 0`. **אין דף כזה בקורפוס**
	// (‏0 מ-146) ולכן ההתנהגות לא נמדדה ואי-אפשר להסיק אותה. הבחירה כאן —
	// לא לעמד, להציג את הפריט הראשון — היא **החלטה שלנו ולא ממצא**.
	const capacity = overflows && cellCount > 1 ? cellCount - 1 : cellCount;
	const pageCount = Math.max(1, Math.ceil(items.length / capacity));
	const page = Math.min(Math.max(pageIndex, 0), pageCount - 1);
	const navCell = overflows && cellCount > 1 ? order[cellCount - 1] : null;
	const start = page * capacity;

	for (let i = 0; i < cellCount; i++) {
		const cell = order[i];
		if (cell === navCell) {
			const onLastPage = page === pageCount - 1;
			const action = onLastPage ? 'first' : 'next';
			slots.set(cell, {
				kind: 'nav',
				action,
				label: WORDLIST_NAV_LABELS[action],
				image: WORDLIST_NAV_IMAGES[action]
			});
			continue;
		}
		const item = items[start + i];
		// תא בלי פריט **אינו מצויר** — לא קופסה ריקה ולא placeholder.
		slots.set(cell, item ? { kind: 'item', item, index: start + i } : { kind: 'empty' });
	}

	return { slots, pageCount, capacity };
}
