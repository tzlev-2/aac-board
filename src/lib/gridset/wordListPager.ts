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

import type { Cell, WordListItem } from './types';

/**
 * 🛑 כיתובי תא-הניווט — **אינם מגיעים מהלוח.** הם מחרוזות של Grid
 * (‏`he-IL.ts`, הקשר `Auto Content: More/Back`, עם ההערה המפורשת
 * *"item automatically added to auto content"*), ולכן הם שייכים ל-i18n
 * של הקלון. אין כאן מנגנון i18n עדיין — כשיהיה, זה המקום לחבר.
 */
export const WORDLIST_NAV_LABELS = {
	next: 'עוד',
	first: 'חזור'
} as const;

export type WordListSlot =
	| { kind: 'item'; item: WordListItem; index: number }
	| { kind: 'nav'; action: 'next' | 'first'; label: string }
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
			slots.set(cell, {
				kind: 'nav',
				action: onLastPage ? 'first' : 'next',
				label: onLastPage ? WORDLIST_NAV_LABELS.first : WORDLIST_NAV_LABELS.next
			});
			continue;
		}
		const item = items[start + i];
		// תא בלי פריט **אינו מצויר** — לא קופסה ריקה ולא placeholder.
		slots.set(cell, item ? { kind: 'item', item, index: start + i } : { kind: 'empty' });
	}

	return { slots, pageCount, capacity };
}
