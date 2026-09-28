/**
 * היזון חזותי ללחיצה/ריחוף — טבעת `outline` על `.cell.interactive` בלבד.
 *
 * 🔑 `:hover` ב-getComputedStyle אחרי synthetic events אינו אמין; האימות
 * האמיתי הוא צילום (§6 בבריף). כאן נבדקים שהכלל קיים ב-CSS ושהעובי נגזר
 * מ-`--gutter`, ושתא לא-לחיץ אינו `.interactive`.
 */
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Cell, ResolvedStyle, RuntimeContext } from '$lib/gridset/types';
import GridCell from './GridCell.svelte';

const style: ResolvedStyle = {
	backColour: '#FFFFFFFF',
	fontColour: '#000000FF',
	borderColour: '#00000000',
	fontName: 'Arial',
	fontSize: 20,
	backgroundShape: 1,
	tileColour: '#00000000'
};

function makeCell(overrides: Partial<Cell> = {}): Cell {
	return { x: 0, y: 0, columnSpan: 1, rowSpan: 1, commands: [], style, ...overrides };
}

function makeCtx(): RuntimeContext {
	const page = {
		name: 'test',
		columns: 4,
		rows: 4,
		columnWidths: [],
		rowHeights: [],
		cells: [],
		wordList: [],
		predictionSource: 'None' as const,
		autoContentCommands: {},
		background: {}
	};
	return {
		gridSet: {
			startGrid: 'test',
			language: 'he-IL',
			symbolSearchKeys: [],
			pages: { test: page },
			styles: {}
		},
		page,
		features: new Set(),
		navigate: () => {},
		back: () => {},
		home: () => {},
		output: {
			insert: () => {},
			insertLetter: () => {},
			appendToStream: () => {},
			clear: () => {},
			deleteWord: () => {},
			deleteLetter: () => {},
			items: []
		},
		speak: () => {},
		stopSpeaking: () => {},
		playSound: () => {},
		reportUnimplemented: () => {}
	};
}

/** כללי ה-scope של Svelte — חיפוש לפי `.cell.interactive` + pseudo. */
function styleRulesMatching(substring: string): CSSStyleRule[] {
	const out: CSSStyleRule[] = [];
	for (const sheet of document.styleSheets) {
		try {
			for (const rule of sheet.cssRules) {
				if (rule instanceof CSSStyleRule && rule.selectorText.includes(substring)) {
					out.push(rule);
				}
			}
		} catch {
			// גיליון חסום — לא רלוונטי לקומפוננטה
		}
	}
	return out;
}

describe('GridCell — טבעת press/hover', () => {
	it('ל-.cell.interactive יש :hover עם outline-width מ-0.71×--gutter', () => {
		render(GridCell, {
			cell: makeCell({ commands: [{ id: 'Action.Speak', params: { unit: 'All' } }] }),
			ctx: makeCtx()
		});

		const hoverRules = styleRulesMatching('.cell.interactive').filter((r) =>
			r.selectorText.includes(':hover')
		);
		expect(hoverRules.length).toBeGreaterThan(0);

		const widths = hoverRules.map((r) => r.style.outlineWidth || r.style.getPropertyValue('outline-width'));
		const hasGutterOutline = widths.some(
			(w) => w.includes('0.71') && w.includes('--gutter')
		);
		expect(hasGutterOutline).toBe(true);
	});

	it('תא בלי פקודות אינו interactive ולא מקבל את כללי הטבעת', () => {
		const screen = render(GridCell, { cell: makeCell({ commands: [] }), ctx: makeCtx() });
		const el = screen.getByTestId('grid-cell').element();

		expect(el.classList.contains('interactive')).toBe(false);
		expect(el.tagName).toBe('DIV');
	});
});
