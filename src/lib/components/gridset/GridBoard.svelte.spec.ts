import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Cell, Page, ResolvedStyle, RuntimeContext } from '$lib/gridset/types';
import GridBoard from './GridBoard.svelte';
import { cellRendererKey, resolveCellRenderer } from './cellRenderers';
import ButtonCell from './ButtonCell.svelte';
import ChatCell from './ChatCell.svelte';
import UnsupportedCell from './UnsupportedCell.svelte';

const style: ResolvedStyle = {
	backColour: '#FFFFFFFF',
	fontColour: '#000000FF',
	borderColour: '#00000000',
	fontName: 'Arial',
	fontSize: 20,
	backgroundShape: 1
};

function makeCell(overrides: Partial<Cell> = {}): Cell {
	return {
		x: 0,
		y: 0,
		columnSpan: 1,
		rowSpan: 1,
		commands: [],
		style,
		...overrides
	};
}

function makePage(overrides: Partial<Page> = {}): Page {
	return {
		name: 'test',
		columns: 6,
		rows: 4,
		cells: [],
		wordList: [],
		predictionSource: 'None',
		autoContentCommands: {},
		background: {},
		...overrides
	};
}

function makeCtx(page: Page): RuntimeContext {
	return {
		gridSet: {
			startGrid: page.name,
			language: 'he-IL',
			symbolSearchKeys: [],
			pages: { [page.name]: page },
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
			clear: () => {},
			deleteWord: () => {},
			deleteLetter: () => {},
			items: []
		},
		speak: () => {},
		stopSpeaking: () => {},
		reportUnimplemented: () => {}
	};
}

describe('GridBoard', () => {
	it('רשת 6×4 מייצרת 24 מיקומים', () => {
		const p = makePage({ columns: 6, rows: 4 });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });
		const grid = screen.getByTestId('grid-board').element();
		const computed = getComputedStyle(grid);

		expect(computed.gridTemplateColumns.trim().split(/\s+/)).toHaveLength(6);
		expect(computed.gridTemplateRows.trim().split(/\s+/)).toHaveLength(4);
	});

	it('תא עם span תופס את השטח הנכון', () => {
		const cell = makeCell({ x: 1, y: 0, columnSpan: 3, rowSpan: 2 });
		const p = makePage({ cells: [cell] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });
		const el = screen.getByTestId('grid-cell').element();
		const computed = getComputedStyle(el);

		expect(computed.gridColumnStart).toBe('2'); // x+1
		expect(computed.gridColumnEnd).toBe('span 3');
		expect(computed.gridRowStart).toBe('1'); // y+1
		expect(computed.gridRowEnd).toBe('span 2');
	});

	it('X=0 נוחת בעמודה הימנית (RTL)', () => {
		const right = makeCell({ x: 0, y: 0, caption: 'ימני' });
		const left = makeCell({ x: 3, y: 0, caption: 'שמאלי' });
		const p = makePage({ columns: 4, rows: 1, cells: [right, left] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });
		const [rightEl, leftEl] = screen.getByTestId('grid-cell').elements();

		expect(rightEl.getBoundingClientRect().left).toBeGreaterThan(
			leftEl.getBoundingClientRect().left
		);
	});

	it('Hidden לא מרונדר ב-DOM', async () => {
		const hidden = makeCell({ x: 0, y: 0, visibility: 'Hidden', caption: 'נסתר' });
		const p = makePage({ cells: [hidden] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });

		await expect.element(screen.getByText('נסתר')).not.toBeInTheDocument();
	});

	it('Disabled מרונדר מעומעם ולא-לחיץ', () => {
		const disabled = makeCell({ x: 0, y: 0, visibility: 'Disabled', caption: 'מושבת' });
		const p = makePage({ cells: [disabled] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });
		const el = screen.getByTestId('grid-cell').element();

		expect(el.getAttribute('aria-disabled')).toBe('true');
		expect(getComputedStyle(el).pointerEvents).toBe('none');
	});

	it('סוג לא-מוכר נותן UnsupportedCell', async () => {
		const cell = makeCell({ contentType: 'AutoContent', contentSubType: 'WordList', caption: 'ר' });
		const p = makePage({ cells: [cell] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });

		await expect.element(screen.getByTestId('unsupported-cell')).toBeInTheDocument();
	});
});

describe('cellRenderers registry', () => {
	it('בלי contentType → default → ButtonCell', () => {
		expect(cellRendererKey({})).toBe('default');
		expect(resolveCellRenderer(makeCell())).toBe(ButtonCell);
	});

	it('Workspace/Chat → ChatCell', () => {
		const cell = makeCell({ contentType: 'Workspace', contentSubType: 'Chat' });
		expect(cellRendererKey(cell)).toBe('Workspace/Chat');
		expect(resolveCellRenderer(cell)).toBe(ChatCell);
	});

	it('סוג לא רשום נופל ל-UnsupportedCell', () => {
		const cell = makeCell({ contentType: 'AutoContent', contentSubType: 'WordList' });
		expect(resolveCellRenderer(cell)).toBe(UnsupportedCell);
	});
});
