import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { tick } from 'svelte';
import { createRuntime } from '$lib/gridset/runtime.svelte';
import type {
	Cell,
	CommandInvocation,
	Page,
	ResolvedStyle,
	RuntimeContext,
	SizeName
} from '$lib/gridset/types';
import GridBoard from './GridBoard.svelte';
import { cellRendererKey, resolveCellRenderer } from './cellRenderers';
import ButtonCell from './ButtonCell.svelte';
import ChatCell from './ChatCell.svelte';
import WordListCell from './WordListCell.svelte';
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
	it('דיווח דרישות עם מונה תגובתי מתייצב בלי להסתיר תאים זמינים', async () => {
		const requirement = (feature?: string): CommandInvocation => ({
			id: 'Settings.RequiredFeature',
			params: feature ? { feature } : {}
		});
		const p = makePage({
			cells: [
				makeCell({ caption: 'בלי פרמטר', commands: [requirement()] }),
				makeCell({ x: 1, caption: 'דרישה לא מוכרת', commands: [requirement('Telepathy')] }),
				makeCell({ x: 2, caption: 'דרישה חסומה', commands: [requirement('EyeGazeAccess')] })
			]
		});
		const runtime = createRuntime(makeCtx(p).gridSet, { features: new Set() });
		const screen = render(GridBoard, { page: p, ctx: runtime });
		await tick();

		await expect.element(screen.getByText('בלי פרמטר')).toBeVisible();
		await expect.element(screen.getByText('דרישה לא מוכרת')).toBeVisible();
		await expect.element(screen.getByText('דרישה חסומה')).not.toBeInTheDocument();
		expect(runtime.unimplemented).toEqual({
			'Settings.RequiredFeature(no-param)': 1,
			'Settings.RequiredFeature(Telepathy)': 1
		});

		// דיווח חיצוני משנה את אותו $state; הוא אינו ביקור נוסף בדף.
		runtime.reportUnimplemented('Photos.Snapshot');
		await tick();
		expect(runtime.unimplemented).toEqual({
			'Settings.RequiredFeature(no-param)': 1,
			'Settings.RequiredFeature(Telepathy)': 1,
			'Photos.Snapshot': 1
		});
	});

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

		expect(edgeTile.getAttribute('style')).toContain(
			'margin-inline-start: calc(-1 * var(--gutter))'
		);
		expect(innerTile.getAttribute('style')).toContain(
			'margin-inline-start: calc(-1 * var(--gutter) / 2)'
		);
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

	it('AutoContent/Prediction uses the WordList renderer', () => {
		const cell = makeCell({ contentType: 'AutoContent', contentSubType: 'Prediction' });
		expect(cellRendererKey(cell)).toBe('AutoContent/Prediction');
		expect(resolveCellRenderer(cell)).toBe(WordListCell);
	});
});

describe('Prediction empty frames', () => {
	function predictionCell(x: number, y: number): Cell {
		return makeCell({
			x,
			y,
			contentType: 'AutoContent',
			contentSubType: 'Prediction'
		});
	}

	it('keeps visible empty Prediction frames and still hides empty WordList cells', async () => {
		const p = makePage({
			columns: 4,
			rows: 2,
			wordList: [{ text: { paragraphs: [{ sentences: [{ runs: ['keep'] }] }] } }],
			autoContentCommands: { Prediction: [{ id: 'AutoContent.Activate', params: {} }] },
			cells: [
				predictionCell(0, 0),
				predictionCell(1, 0),
				makeCell({
					x: 2,
					y: 0,
					contentType: 'AutoContent',
					contentSubType: 'WordList'
				}),
				makeCell({
					x: 3,
					y: 0,
					contentType: 'AutoContent',
					contentSubType: 'WordList'
				})
			]
		});
		const runtime = createRuntime(makeCtx(p).gridSet);
		const screen = render(GridBoard, { page: p, ctx: runtime, pager: runtime });
		await tick();
		expect(screen.getByTestId('prediction-empty').elements()).toHaveLength(2);
		expect(screen.getByTestId('grid-cell').elements()).toHaveLength(3);
		await expect.element(screen.getByText('keep')).toBeVisible();
	});

	it('PredictThis fills frames from the command payload without changing page.wordList', async () => {
		const p = makePage({
			columns: 4,
			rows: 2,
			wordList: [{ text: { paragraphs: [{ sentences: [{ runs: ['keep-page'] }] }] } }],
			autoContentCommands: { Prediction: [{ id: 'AutoContent.Activate', params: {} }] },
			cells: [
				predictionCell(0, 0),
				predictionCell(1, 0),
				predictionCell(2, 0),
				makeCell({
					x: 0,
					y: 1,
					caption: 'Body actions',
					commands: [
						{
							id: 'Prediction.PredictThis',
							params: {
								wordlist: [
									{ text: { paragraphs: [{ sentences: [{ runs: ['abseil'] }] }] } },
									{ text: { paragraphs: [{ sentences: [{ runs: ['amble'] }] }] } }
								]
							}
						}
					]
				})
			]
		});
		const runtime = createRuntime(makeCtx(p).gridSet);
		const screen = render(GridBoard, { page: p, ctx: runtime, pager: runtime });
		await tick();
		expect(screen.getByTestId('prediction-empty').elements()).toHaveLength(3);
		await userEvent.click(screen.getByText('Body actions'));
		await tick();
		await expect.element(screen.getByText('abseil')).toBeVisible();
		await expect.element(screen.getByText('amble')).toBeVisible();
		expect(screen.getByTestId('prediction-empty').elements()).toHaveLength(1);
		expect(runtime.page.wordList[0].text.paragraphs[0].sentences[0].runs[0]).toBe('keep-page');
	});
});

it('edit overlays include Hidden/Disabled and preserve the top-right span address', async () => {
	const p = makePage({
		cells: [
			makeCell({ caption: 'hidden', visibility: 'Hidden', columnSpan: 2 }),
			makeCell({ x: 2, caption: 'disabled', visibility: 'Disabled' })
		]
	});
	const ctx = makeCtx(p);
	let executions = 0;
	ctx.navigate = () => {
		executions++;
	};
	p.cells[0].commands = [{ id: 'Jump.To', params: { grid: 'other' } }];
	const selected: number[] = [];
	const screen = render(GridBoard, {
		page: p,
		ctx,
		editing: true,
		onSelectCell: (_, c) => selected.push(c.x)
	});
	const overlays = screen.getByTestId('edit-cell');
	expect(overlays.elements()).toHaveLength(2);
	await overlays.nth(0).click();
	await overlays.nth(1).click();
	expect(selected).toEqual([0, 2]);
	expect(executions).toBe(0);
	expect(getComputedStyle(overlays.nth(0).element()).gridColumn).toContain('span 2');
	expect(
		screen
			.getByTestId('grid-cell')
			.elements()
			.every((el) => (el as HTMLElement).inert)
	).toBe(true);
});

// Real browser geometry drives eligibility; pointer capture is stubbed only for
// synthetic timer/cancel events. Native touch and keyboard are replayed in Chrome QA.
describe('full caption inspection before activation', () => {
	const label = 'native-360x800';
	async function readerBoard(overrides: Partial<Cell> = {}) {
		const cell = makeCell({
			style: { ...style, fontSize: 80 },
			caption: label,
			commands: [{ id: 'Jump.To', params: { grid: 'next' } }],
			...overrides
		});
		const p = makePage({ cells: [cell] });
		const ctx = makeCtx(p);
		let executions = 0;
		ctx.navigate = () => {
			executions++;
		};
		const screen = render(GridBoard, { page: p, ctx });
		const owner = screen.getByTestId('grid-cell').element() as HTMLElement;
		owner.style.width = '30px';
		owner.style.height = '120px';
		await expect.poll(() => owner.hasAttribute('data-caption-unfit')).toBe(true);
		vi.spyOn(owner, 'setPointerCapture').mockImplementation(() => {});
		vi.spyOn(owner, 'hasPointerCapture').mockReturnValue(false);
		return {
			screen,
			owner,
			p,
			ctx,
			get executions() {
				return executions;
			}
		};
	}
	const pointer = (owner: HTMLElement, type: string, x = 20) =>
		owner.dispatchEvent(
			new PointerEvent(type, {
				pointerId: 7,
				isPrimary: true,
				button: 0,
				clientX: x,
				clientY: 30,
				bubbles: true
			})
		);
	const fullText = () => document.querySelector('[data-testid=full-caption]')?.textContent;
	const hold = async (owner: HTMLElement) => {
		vi.useFakeTimers();
		pointer(owner, 'pointerdown');
		await vi.advanceTimersByTimeAsync(399);
		expect(fullText()).toBeUndefined();
		await vi.advanceTimersByTimeAsync(1);
		await tick();
		vi.useRealTimers();
	};
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('stationary hold reveals exact text in the top layer; release/Close do not activate; next short tap once', async () => {
		const f = await readerBoard();
		await hold(f.owner);
		expect(fullText()).toBe(label);
		expect(document.querySelector('[data-testid=caption-reader]')?.matches(':popover-open')).toBe(
			true
		);
		expect(getComputedStyle(document.querySelector('[data-testid=full-caption]')!).fontSize).toBe(
			'20px'
		);
		pointer(f.owner, 'pointerup');
		f.owner.click();
		expect(f.executions).toBe(0);
		await f.screen.getByRole('button', { name: 'סגירה' }).click();
		expect(fullText()).toBeUndefined();
		expect(f.executions).toBe(0);
		pointer(f.owner, 'pointerdown');
		pointer(f.owner, 'pointerup');
		f.owner.click();
		expect(f.executions).toBe(1);
	});

	it('movement or pointercancel cancels a pending hold and suppresses its release click', async () => {
		const f = await readerBoard();
		for (const cancel of ['pointermove', 'pointercancel']) {
			vi.useFakeTimers();
			pointer(f.owner, 'pointerdown');
			pointer(f.owner, cancel, 31);
			await vi.advanceTimersByTimeAsync(500);
			await tick();
			pointer(f.owner, 'pointerup');
			f.owner.click();
			expect(fullText()).toBeUndefined();
			expect(f.executions).toBe(0);
			vi.useRealTimers();
		}
	});

	it('keyboard focus reads before Enter/Space; Escape clears with zero commands', async () => {
		const f = await readerBoard();
		// Synthetic keyboard events do not change Chrome's input modality.
		// Native focus-visible/Enter/Space are covered by the product Chrome replay.
		const matches = f.owner.matches.bind(f.owner);
		vi.spyOn(f.owner, 'matches').mockImplementation(
			(selector) => selector === ':focus-visible' || matches(selector)
		);
		await userEvent.keyboard('{Tab}');
		f.owner.blur();
		f.owner.focus();
		f.owner.dispatchEvent(new FocusEvent('focus'));
		await tick();
		expect(fullText()).toBe(label);
		expect(f.executions).toBe(0);
		await userEvent.keyboard('{Escape}');
		await tick();
		expect(fullText()).toBeUndefined();
		expect(f.executions).toBe(0);
		for (const key of ['{Enter}', ' ']) {
			f.owner.blur();
			f.owner.focus();
			f.owner.dispatchEvent(new FocusEvent('focus'));
			await tick();
			expect(fullText()).toBe(label);
			await userEvent.keyboard(key);
			await tick();
			expect(fullText()).toBeUndefined();
		}
		expect(f.executions).toBe(2);
	});

	it('cell/page/WordList/mode replacement and unmount clear readers and pending timers', async () => {
		const f = await readerBoard();
		await hold(f.owner);
		await f.screen.rerender({ editing: true });
		await tick();
		expect(fullText()).toBeUndefined();
		expect(f.executions).toBe(0);
		await f.screen.rerender({ editing: false });
		await tick();
		await expect.poll(() => f.owner.hasAttribute('data-caption-unfit')).toBe(true);
		await hold(f.owner);
		await f.screen.rerender({ pager: { wordListPage: 1, navigateWordList: () => {} } });
		await tick();
		expect(fullText()).toBeUndefined();
		vi.useFakeTimers();
		pointer(f.owner, 'pointerdown');
		const replacement = makePage({ name: 'other', cells: [makeCell({ caption: 'replacement' })] });
		await f.screen.rerender({ page: replacement, ctx: makeCtx(replacement) });
		await vi.advanceTimersByTimeAsync(500);
		await tick();
		expect(fullText()).toBeUndefined();
		expect(f.executions).toBe(0);
		vi.useRealTimers();
		f.screen.unmount();
		await tick();
		expect(document.querySelector('[data-testid=caption-reader]')).toBeNull();
		const pending = await readerBoard();
		vi.useFakeTimers();
		pointer(pending.owner, 'pointerdown');
		pending.screen.unmount();
		await vi.advanceTimersByTimeAsync(500);
		await tick();
		expect(fullText()).toBeUndefined();
		expect(pending.executions).toBe(0);
		vi.useRealTimers();
		const open = await readerBoard();
		await hold(open.owner);
		expect(fullText()).toBe(label);
		open.screen.unmount();
		await tick();
		expect(fullText()).toBeUndefined();
	});

	it('passive unfit cells gain reading focus and no command; disabled cells stay unavailable', async () => {
		const f = await readerBoard({ commands: [] });
		expect(f.owner.tagName).toBe('DIV');
		expect(f.owner.tabIndex).toBe(0);
		await hold(f.owner);
		expect(fullText()).toBe(label);
		pointer(f.owner, 'pointerup');
		f.owner.click();
		expect(f.executions).toBe(0);
		await f.screen.rerender({
			page: makePage({ cells: [makeCell({ caption: label, visibility: 'Disabled' })] })
		});
		await tick();
		expect(fullText()).toBeUndefined();
		expect(f.owner.hasAttribute('data-caption-unfit')).toBe(false);
		expect(f.owner.tabIndex).toBe(-1);
	});

	it('an actually loaded font changes a previously fitting caption to unfit without changing text/FontSize', async () => {
		const f = await readerBoard();
		f.owner.style.width = '280px';
		f.owner.style.height = '160px';
		await expect.poll(() => f.owner.hasAttribute('data-caption-unfit')).toBe(false);
		const face = new FontFace('ReaderLoadedFont', 'local("DejaVu Sans")', {
			sizeAdjust: '300%'
		} as FontFaceDescriptors & { sizeAdjust: string });
		document.fonts.add(face);
		await face.load();
		await document.fonts.ready;
		try {
			f.owner.style.fontFamily = 'ReaderLoadedFont';
			window.dispatchEvent(new Event('resize'));
			await expect.poll(() => f.owner.hasAttribute('data-caption-unfit')).toBe(true);
			await hold(f.owner);
			expect(fullText()).toBe(label);
			expect(face.status).toBe('loaded');
			expect(f.p.cells[0].style.fontSize).toBe(80);
		} finally {
			document.fonts.delete(face);
		}
	});
});
