/**
 * היזון חזותי — טבעת `outline` על `.cell.interactive`.
 * שער חזותי: צילום DoD; כאן hover אמיתי + getComputedStyle.
 */
import { page } from 'vitest/browser';
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

function makeCtx(theme?: string): RuntimeContext {
	const pageDef = {
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
			pages: { test: pageDef },
			styles: {},
			theme
		},
		page: pageDef,
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

const speakCmd = [{ id: 'Action.Speak' as const, params: { unit: 'All' as const } }];

describe('GridCell — טבעת press/hover', () => {
	it('hover — outline-width מחושב > 0 ו≈ 0.71×--gutter (squircle, בלי clip-path)', async () => {
		render(GridCell, {
			cell: makeCell({ commands: speakCmd, style: { ...style, backgroundShape: 1 } }),
			ctx: makeCtx('Kids')
		});
		const loc = page.getByTestId('grid-cell');
		const cellEl = loc.element() as HTMLElement;
		cellEl.style.setProperty('--gutter', '38px');
		cellEl.style.width = '277px';
		cellEl.style.height = '217px';

		await loc.hover();
		const s = getComputedStyle(cellEl);
		const outlineWidth = parseFloat(s.outlineWidth);

		const gutterPx = parseFloat(s.getPropertyValue('--gutter'));
		expect(outlineWidth).toBeGreaterThan(0);
		expect(Math.abs(outlineWidth - 0.71 * gutterPx)).toBeLessThan(2);
	});

	it('cut-top-left (Kids, shape 2) — clip-path פעיל; outline-width מחושב > 0 (נחתך בציור)', async () => {
		render(GridCell, {
			cell: makeCell({ commands: speakCmd, style: { ...style, backgroundShape: 2 } }),
			ctx: makeCtx('Kids')
		});
		const loc = page.getByTestId('grid-cell');
		const cellEl = loc.element() as HTMLElement;
		cellEl.style.setProperty('--gutter', '38px');
		cellEl.style.width = '277px';
		cellEl.style.height = '217px';

		await loc.hover();
		const s = getComputedStyle(cellEl);

		expect(parseFloat(s.outlineWidth)).toBeGreaterThan(0);
		expect(s.clipPath).not.toBe('none');
	});

	it('תא בלי פקודות אינו interactive', () => {
		const screen = render(GridCell, { cell: makeCell({ commands: [] }), ctx: makeCtx() });
		const el = screen.getByTestId('grid-cell').element();

		expect(el.classList.contains('interactive')).toBe(false);
		expect(el.tagName).toBe('DIV');
	});
});
