/**
 * הבדיקות נגזרות מ-`wordlist-overflow.md` §המלצה — שלושת דפי-הקבלה
 * שהמדידה קבעה. 🛑 הקריטריון הקודם ("דף בגדים מציג 11 בגדים") עבר גם
 * במימוש שמוותר על הגלישה, כי `בגדים` הוא 11⇄11 — המקרה היחיד שבו
 * מיפוי 1:1 נכון.
 */
import { describe, it, expect } from 'vitest';
import { pageWordList, orderWordListCells, isWordListCell } from './wordListPager';
import type { Cell, WordListItem } from './types';

const style = {
	backColour: '#FFFFFFFF', fontColour: '#000000FF', borderColour: '#FFFFFF00',
	fontName: 'Booster', fontSize: 24, backgroundShape: 1, tileColour: '#00000000'
};

/** תא-`WordList` ב-(x,y). */
const wl = (x: number, y: number): Cell => ({
	x, y, columnSpan: 1, rowSpan: 1, commands: [],
	contentType: 'AutoContent', contentSubType: 'WordList', style
});
const word = (t: string): WordListItem => ({
	text: { paragraphs: [{ sentences: [{ runs: [t] }] }] }
});
const words = (...t: string[]) => t.map(word);
const textOf = (s: ReturnType<typeof pageWordList>['slots'] extends Map<Cell, infer S> ? S : never) =>
	s.kind === 'item' ? s.item.text.paragraphs[0].sentences[0].runs[0] : s.kind === 'nav' ? s.label : '';

describe('סדר המילוי', () => {
	// 🛑 54 מ-146 דפי ה-WordList שומרים תאים בסדר שאינו (y,x).
	it('ממיין לפי (y,x) ולא לפי סדר-המערך', () => {
		const docOrder = [wl(2, 1), wl(5, 3), wl(2, 4), wl(3, 3)];
		expect(orderWordListCells(docOrder).map((c) => [c.y, c.x])).toEqual([
			[1, 2], [3, 3], [3, 5], [4, 2]
		]);
	});

	it('מסנן תאים שאינם WordList', () => {
		const chat: Cell = { ...wl(0, 0), contentType: 'Workspace', contentSubType: 'Chat' };
		const plain: Cell = { ...wl(1, 0), contentType: undefined, contentSubType: undefined };
		expect(isWordListCell(chat)).toBe(false);
		expect(isWordListCell(plain)).toBe(false);
		expect(orderWordListCells([chat, plain, wl(2, 0)])).toHaveLength(1);
	});
});

describe('קבלה · org-1/בגדים — N = C', () => {
	const cells = Array.from({ length: 11 }, (_, i) => wl(i % 4 + 2, Math.floor(i / 4) + 1));
	const items = words(...Array.from({ length: 11 }, (_, i) => `פריט${i + 1}`));

	it('11 מילים, עמוד יחיד, ו🛑 אין תא-ניווט', () => {
		const { slots, pageCount, capacity } = pageWordList(cells, items);
		expect(pageCount).toBe(1);
		expect(capacity).toBe(11);
		const kinds = [...slots.values()].map((s) => s.kind);
		expect(kinds.filter((k) => k === 'item')).toHaveLength(11);
		expect(kinds).not.toContain('nav');
	});
});

describe('קבלה · org-1/גוף - פנים — N < C', () => {
	const cells = Array.from({ length: 12 }, (_, i) => wl(i % 4 + 2, Math.floor(i / 4) + 1));
	const items = words(...Array.from({ length: 10 }, (_, i) => `פריט${i + 1}`));

	it('10 מילים, 2 תאים ריקים, אין ניווט', () => {
		const { slots, pageCount } = pageWordList(cells, items);
		expect(pageCount).toBe(1);
		const kinds = [...slots.values()].map((s) => s.kind);
		expect(kinds.filter((k) => k === 'item')).toHaveLength(10);
		expect(kinds.filter((k) => k === 'empty')).toHaveLength(2);
		expect(kinds).not.toContain('nav');
	});
});

describe('🔑 קבלה · org-2/ארצות — N > C, וסדר-מסמך ≠ (y,x)', () => {
	// 15 תאים, וסדר-המסמך מסתיים ב-(3,5) בעוד (y,x) מסתיים ב-(4,4).
	// זה הדף שמבדיל בין מימוש נכון למימוש שמסתמך על סדר-המערך.
	const docOrder: Cell[] = [
		...[2, 3, 4, 5].map((x) => wl(x, 1)),
		...[2, 3, 4, 5].map((x) => wl(x, 2)),
		...[2, 3, 4].map((x) => wl(x, 3)),
		...[2, 3, 4].map((x) => wl(x, 4)),
		wl(5, 3) // 🛑 אחרון בגוף ה-XML, אך (3,5) ב-(y,x)
	];
	const items = words(...Array.from({ length: 45 }, (_, i) => `ארץ${i + 1}`));

	it('4 עמודים, קיבולת 14', () => {
		const { pageCount, capacity } = pageWordList(docOrder, items);
		expect(capacity).toBe(14);
		expect(pageCount).toBe(4);
	});

	it('🛑 תא-הניווט הוא (4,4) ולא (3,5) — האחרון ב-(y,x), לא במסמך', () => {
		const { slots } = pageWordList(docOrder, items);
		const nav = [...slots.entries()].find(([, s]) => s.kind === 'nav')?.[0];
		expect([nav?.y, nav?.x]).toEqual([4, 4]);
	});

	it('(3,5) מקבל מילה — פריט 12 — ואינו הניווט', () => {
		const { slots } = pageWordList(docOrder, items);
		const cell = docOrder.find((c) => c.y === 3 && c.x === 5)!;
		const slot = slots.get(cell)!;
		expect(slot.kind).toBe('item');
		expect(textOf(slot)).toBe('ארץ12');
	});

	it('עמוד 1 — "עוד"', () => {
		const { slots } = pageWordList(docOrder, items, 0);
		const nav = [...slots.values()].find((s) => s.kind === 'nav');
		expect(nav).toMatchObject({ action: 'next', label: 'עוד' });
	});

	it('עמוד 4 — 3 מילים + "חזור", והשאר אינם מצוירים', () => {
		const { slots } = pageWordList(docOrder, items, 3);
		const vals = [...slots.values()];
		expect(vals.filter((s) => s.kind === 'item')).toHaveLength(3);
		expect(vals.find((s) => s.kind === 'nav')).toMatchObject({ action: 'first', label: 'חזור' });
		expect(vals.filter((s) => s.kind === 'empty')).toHaveLength(11);
	});

	it('עמוד 2 מתחיל בפריט 15', () => {
		const { slots } = pageWordList(docOrder, items, 1);
		const first = orderWordListCells(docOrder)[0];
		expect(textOf(slots.get(first)!)).toBe('ארץ15');
	});
});

describe('גבולות', () => {
	const cells = Array.from({ length: 11 }, (_, i) => wl(i % 4 + 2, Math.floor(i / 4) + 1));

	it('🔑 הגבול חד: N=C אין ניווט, N=C+1 יש', () => {
		const exact = pageWordList(cells, words(...Array(11).fill('x')));
		expect([...exact.slots.values()].some((s) => s.kind === 'nav')).toBe(false);
		const over = pageWordList(cells, words(...Array(12).fill('x')));
		expect([...over.slots.values()].some((s) => s.kind === 'nav')).toBe(true);
		expect(over.pageCount).toBe(2);
	});

	it('עמוד מחוץ לטווח מקוצץ', () => {
		const r = pageWordList(cells, words(...Array(12).fill('x')), 99);
		expect([...r.slots.values()].find((s) => s.kind === 'nav')).toMatchObject({ action: 'first' });
	});

	it('בלי תאים — אפס עמודים', () => {
		expect(pageWordList([], words('a'))).toMatchObject({ pageCount: 0, capacity: 0 });
	});

	it('בלי פריטים — הכול ריק, בלי ניווט', () => {
		const { slots } = pageWordList(cells, []);
		expect([...slots.values()].every((s) => s.kind === 'empty')).toBe(true);
	});
});
