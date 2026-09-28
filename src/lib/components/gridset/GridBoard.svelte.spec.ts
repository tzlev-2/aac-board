import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Cell, Page, ResolvedStyle, RuntimeContext, SizeName } from '$lib/gridset/types';
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
	backgroundShape: 1,
	tileColour: '#00000000'
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
	const columns = overrides.columns ?? 6;
	const rows = overrides.rows ?? 4;
	return {
		name: 'test',
		columns,
		rows,
		columnWidths: Array.from({ length: columns }, () => null as SizeName | null),
		rowHeights: Array.from({ length: rows }, () => null as SizeName | null),
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
		expect(getComputedStyle(el).opacity).toBe(String(0.4));
	});

	it('PointerAndTouchOnly מרונדר רגיל — לא מעומעם ולא לא-לחיץ', () => {
		const cell = makeCell({ x: 0, y: 0, visibility: 'PointerAndTouchOnly', caption: 'מגע' });
		const p = makePage({ cells: [cell] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });
		const el = screen.getByTestId('grid-cell').element();

		expect(el.getAttribute('aria-disabled')).toBeNull();
		expect(getComputedStyle(el).opacity).toBe('1');
		expect(getComputedStyle(el).pointerEvents).not.toBe('none');
	});

	it('סוג לא-מוכר נותן UnsupportedCell', async () => {
		// WordList נתמך מאז פאזה 3א — Camera הוא סוג אמיתי בנתונים שאין לו מרנדר.
		const cell = makeCell({ contentType: 'LiveCell', contentSubType: 'Camera', caption: 'ר' });
		const p = makePage({ cells: [cell] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });

		await expect.element(screen.getByTestId('unsupported-cell')).toBeInTheDocument();
	});

	it('cell.style.fontName מוחל כ-font-family (לא נזרק בשקט)', () => {
		const cell = makeCell({ style: { ...style, fontName: 'Booster' } });
		const p = makePage({ cells: [cell] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });
		const el = screen.getByTestId('grid-cell').element();

		expect(getComputedStyle(el).fontFamily).toContain('Booster');
	});

	it('🔑 Workspace/Chat יושב בפועל בתוך הרשת — לא רצועה נפרדת', () => {
		const chat = makeCell({
			x: 0,
			y: 0,
			columnSpan: 4,
			rowSpan: 1,
			contentType: 'Workspace',
			contentSubType: 'Chat'
		});
		const p = makePage({ columns: 4, rows: 1, cells: [chat] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });

		const board = screen.getByTestId('grid-board').element();
		const chatContent = screen.getByTestId('chat-cell').element();
		const cellWrapper = screen.getByTestId('grid-cell').element();

		// ChatCell הוא צאצא של הרשת, וה-GridCell שעוטף אותו הוא ילד ישיר שלה.
		expect(board.contains(chatContent)).toBe(true);
		expect(cellWrapper.parentElement).toBe(board);
		expect(chatContent.closest('[data-testid="grid-cell"]')).toBe(cellWrapper);

		const computed = getComputedStyle(cellWrapper);
		expect(computed.gridColumnStart).toBe('1');
		expect(computed.gridColumnEnd).toBe('span 4');
	});

	it('columnWidths/rowHeights לא-רגילים משנים את גודל המסלולים היחסי', () => {
		const p = makePage({
			columns: 3,
			rows: 1,
			columnWidths: ['Large', null, 'ExtraSmall']
		});
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });
		const tracks = getComputedStyle(screen.getByTestId('grid-board').element())
			.gridTemplateColumns.trim()
			.split(/\s+/)
			.map(parseFloat);

		expect(tracks[0]).toBeGreaterThan(tracks[1]); // Large > רגיל
		expect(tracks[1]).toBeGreaterThan(tracks[2]); // רגיל > ExtraSmall
	});

	it('הרשת מוגדרת להתמתח לגובה הזמין (flex:1) ולא רק לתוכן', () => {
		const p = makePage();
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });
		const wrap = screen.getByTestId('grid-board').element().parentElement!;
		expect(getComputedStyle(wrap).flexGrow).toBe('1');
	});

	it('תא עם tileColour אטום — .tile עם רקע תואם ואותו שטח-רשת כמו .cell', () => {
		const cell = makeCell({
			x: 1,
			y: 1,
			style: { ...style, tileColour: '#FF0000FF' }
		});
		const p = makePage({ cells: [cell] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });
		const tile = screen.getByTestId('grid-tile').element();
		const cellEl = screen.getByTestId('grid-cell').element();
		const tileStyle = getComputedStyle(tile);
		const cellStyle = getComputedStyle(cellEl);

		expect(tileStyle.backgroundColor).toBe('rgb(255, 0, 0)');
		expect(tileStyle.gridColumnStart).toBe(cellStyle.gridColumnStart);
		expect(tileStyle.gridColumnEnd).toBe(cellStyle.gridColumnEnd);
		expect(tileStyle.gridRowStart).toBe(cellStyle.gridRowStart);
		expect(tileStyle.gridRowEnd).toBe(cellStyle.gridRowEnd);
	});

	it('tileColour שקוף — אין .tile ב-DOM', async () => {
		const cell = makeCell({ style: { ...style, tileColour: '#00000000' } });
		const p = makePage({ cells: [cell] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });

		await expect.element(screen.getByTestId('grid-tile')).not.toBeInTheDocument();
	});

	it('.tile נגישות — aria-hidden וללא טקסט', () => {
		const cell = makeCell({ style: { ...style, tileColour: '#FF0000FF' }, caption: 'כפתור' });
		const p = makePage({ cells: [cell] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });
		const tile = screen.getByTestId('grid-tile').element();

		expect(tile.getAttribute('aria-hidden')).toBe('true');
		expect(tile.textContent?.trim()).toBe('');
	});

	it('.tile מתחת ל-.cell — z-index נמוך יותר', () => {
		const cell = makeCell({ style: { ...style, tileColour: '#FF0000FF' } });
		const p = makePage({ cells: [cell] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });
		const tile = screen.getByTestId('grid-tile').element();
		const cellEl = screen.getByTestId('grid-cell').element();

		expect(Number(getComputedStyle(tile).zIndex)).toBeLessThan(
			Number(getComputedStyle(cellEl).zIndex)
		);
	});

	it('תא בקצה הלוח — מרווחי הרחבה שונים מתא פנימי', () => {
		const edge = makeCell({ x: 0, y: 0, style: { ...style, tileColour: '#FF0000FF' } });
		const inner = makeCell({ x: 2, y: 1, style: { ...style, tileColour: '#FF0000FF' } });
		const p = makePage({ columns: 4, rows: 3, cells: [edge, inner] });
		const screen = render(GridBoard, { page: p, ctx: makeCtx(p) });
		const [edgeTile, innerTile] = screen.getByTestId('grid-tile').elements();

		expect(edgeTile.getAttribute('style')).toContain('margin-inline-start: calc(-1 * var(--gutter))');
		expect(innerTile.getAttribute('style')).toContain('margin-inline-start: calc(-1 * var(--gutter) / 2)');
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
		const cell = makeCell({ contentType: 'LiveCell', contentSubType: 'Camera' });
		expect(resolveCellRenderer(cell)).toBe(UnsupportedCell);
	});
});
