/**
 * הנאמנות החזותית — מה שהמשתמש ניסח כ-"אני צריך שזה ייראה כמו גריד.
 * עכשיו זה נראה כמו סקיצה".
 *
 * 🔑 קריטריון-הקבלה האמיתי של הסלייס הוא **צילום** מול
 * `grid-reference/home-page.png`, ולא הקובץ הזה. מה שכן נבדק כאן הוא שלושת
 * המנגנונים שבלעדיהם הצילום לא יכול להיות נכון, ושנשברים **בשקט**:
 *
 * 1. סדר ה-DOM (כתובית לפני סמל) — משנה גם את ההגייה של מקריא-המסך.
 * 2. ‏`container-type: size` על התא — בלעדיו `cqh` נופל ל-viewport בלי שגיאה.
 * 3. ‏`flex: 0 0 auto` על הכתובית — מה שמונע את הגזירה האנכית שנמדדה
 *    (‏31 מ-152 הכותרות בדף-המקלדת של `b107`).
 */
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Cell, ResolvedStyle, RuntimeContext } from '$lib/gridset/types';
import type { SymbolResolver } from '$lib/gridset/symbols';
import { VISUAL_DEFAULTS, resolveFontFamily } from '$lib/gridset/visualDefaults';
import GridCell from './GridCell.svelte';

const style: ResolvedStyle = {
	backColour: '#FFFFFFFF',
	fontColour: '#000000FF',
	borderColour: '#00000000',
	fontName: 'Booster',
	fontSize: VISUAL_DEFAULTS.captionReferenceFontSize,
	backgroundShape: 1,
	tileColour: '#00000000'
};

function makeCell(overrides: Partial<Cell> = {}): Cell {
	return { x: 0, y: 0, columnSpan: 1, rowSpan: 1, commands: [], style, ...overrides };
}

/** ‏1×1 PNG שקוף — הפותר האמיתי הולך לרשת, וזה לא רץ ב-CI. */
const PIXEL =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const fakeSymbols: SymbolResolver = {
	resolve: async () => ({ url: PIXEL, source: 'arasaac', query: 'x', library: 'widgit' }),
	stats: () => ({
		resolved: 1,
		unresolved: 0,
		byLibrary: {},
		resolvedByLibrary: {},
		byMatch: {} as never,
		resolvedBySource: {},
		embeddedUnsupported: {}
	})
};

function makeCtx(textAtTop = true): RuntimeContext {
	return {
		gridSet: {
			startGrid: 't',
			language: 'he-IL',
			symbolSearchKeys: [],
			pages: {},
			styles: {},
			theme: 'Kids',
			textAtTop
		},
		page: {} as RuntimeContext['page'],
		features: new Set(),
		reportUnimplemented: () => {},
		navigate: () => {},
		back: () => {},
		home: () => {},
		output: {
			insert: () => {},
			insertLetter: () => {},
			clear: () => {},
			deleteWord: () => {},
			deleteLetter: () => {},
			items: []
		},
		speak: () => {},
		stopSpeaking: () => {}
	} as RuntimeContext;
}

/** התא חייב גובה אמיתי — `cqh` נמדד מול ה-container, והוא זה שנבדק. */
function renderCell(cell: Cell, height = 200, width = 240, ctx = makeCtx()) {
	const screen = render(GridCell, { cell, ctx, symbols: fakeSymbols });
	const el = screen.getByTestId('grid-cell').element() as HTMLElement;
	el.style.height = `${height}px`;
	el.style.width = `${width}px`;
	return { screen, el };
}

describe('נאמנות חזותית — כתובית', () => {
	it('🔑 הכתובית קודמת לסמל ב-DOM וממוקמת מעליו', async () => {
		const { screen, el } = renderCell(
			makeCell({ caption: 'לאכול', image: { library: 'widgit', path: 'food.emf' } })
		);
		await expect.element(screen.getByTestId('cell-caption')).toBeInTheDocument();

		const caption = el.querySelector('[data-testid=cell-caption]') as HTMLElement;
		const img = el.querySelector('img') as HTMLImageElement;

		// סדר DOM — מה שמקריא-המסך הולך אחריו.
		expect(caption.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		// ומיקום בפועל — כי `column-reverse` היה מספק את הראשון ולא את השני.
		expect(caption.getBoundingClientRect().top).toBeLessThan(img.getBoundingClientRect().top);
	});

	it('🔑 גודל-הגופן נגזר מגובה התא ולא מ-px מוחלט', async () => {
		// אותו תא, אותו `fontSize` מה-XML — רק הגובה משתנה.
		const { screen, el } = renderCell(makeCell({ caption: 'לאכול' }), 120);
		await expect.element(screen.getByTestId('cell-caption')).toBeInTheDocument();
		const caption = el.querySelector('[data-testid=cell-caption]') as HTMLElement;

		const shortPx = parseFloat(getComputedStyle(caption).fontSize);
		el.style.height = '240px';
		const tallPx = parseFloat(getComputedStyle(caption).fontSize);

		// תא כפול בגובהו ⇒ כותרת כפולה (פחות ה-padding הקבוע שלא הוכפל).
		expect(tallPx).toBeGreaterThan(shortPx * 1.8);
		// 🛑 וזה מה שמוכיח ש-`container-type: size` קיים: בלעדיו שני המצבים
		// היו מקבלים את אותו גודל (אחוז מה-viewport), והיחס היה 1.
		expect(tallPx / shortPx).toBeLessThan(2.2);
	});

	it('הכותרת אינה נגזרת אנכית — היא קודמת לסמל בחלוקת המקום', async () => {
		const { screen, el } = renderCell(makeCell({ caption: 'עכשיו צריך' }), 90);
		await expect.element(screen.getByTestId('cell-caption')).toBeInTheDocument();

		const caption = el.querySelector('[data-testid=cell-caption]') as HTMLElement;
		expect(caption.scrollHeight).toBeLessThanOrEqual(caption.clientHeight + 1);
	});
});

describe('נאמנות חזותית — סמל וגופן', () => {
	it('קופסת-הסמל בגודל שנמדד (148/217 מגובה התא)', async () => {
		const { screen, el } = renderCell(
			makeCell({ caption: 'לאכול', image: { library: 'widgit', path: 'food.emf' } }),
			217,
			277
		);
		await expect.element(screen.getByTestId('cell-caption')).toBeInTheDocument();

		const symbol = el.querySelector('.symbol') as HTMLElement;
		const cs = getComputedStyle(el);
		const innerW =
			el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) * 2;
		const box = symbol.getBoundingClientRect();
		expect(box.width / innerW).toBeCloseTo(VISUAL_DEFAULTS.iconBoxWidthRatio, 1);
		expect(box.height / box.width).toBeCloseTo(1, 2);
	});

	it('גופן לא-מוכר מקבל ערימת-נפילה, ולא גופן-מערכת שרירותי', async () => {
		const cell = makeCell({ caption: 'עוד', style: { ...style, fontName: 'Booster' } });
		const { screen, el } = renderCell(cell);
		await expect.element(screen.getByTestId('cell-caption')).toBeInTheDocument();

		const applied = getComputedStyle(el).fontFamily;
		expect(applied).toContain('Booster');
		expect(applied).toContain('sans-serif');
		expect(applied.split(',').length).toBe(resolveFontFamily('Booster').split(',').length);
	});
});
