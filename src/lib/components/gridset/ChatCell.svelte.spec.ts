import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Cell, OutputItem, ResolvedStyle, RuntimeContext } from '$lib/gridset/types';
import type { SymbolResolver } from '$lib/gridset/symbols';
import { VISUAL_DEFAULTS } from '$lib/gridset/visualDefaults';
import ChatCell from './ChatCell.svelte';

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
	return {
		x: 0,
		y: 0,
		columnSpan: 4,
		rowSpan: 1,
		contentType: 'Workspace',
		contentSubType: 'Chat',
		commands: [],
		style,
		...overrides
	};
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

function makeCtx(items: readonly OutputItem[]): RuntimeContext {
	return {
		gridSet: {
			startGrid: 't',
			language: 'he-IL',
			symbolSearchKeys: [],
			pages: {},
			styles: {},
			theme: 'Kids',
			textAtTop: true
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
			appendToStream: () => {},
			clear: () => {},
			deleteWord: () => {},
			deleteLetter: () => {},
			items
		},
		speak: () => {},
		stopSpeaking: () => {},
		playSound: () => {}
	} as RuntimeContext;
}

function mount(items: readonly OutputItem[], symbols: SymbolResolver | null = fakeSymbols) {
	const cell = makeCell();
	return render(ChatCell, { cell, ctx: makeCtx(items), symbols });
}

describe('ChatCell — סמל מעל מילה בפס-הפלט', () => {
	it('🔑 פריט עם image מקבל <img> מעל המילה', async () => {
		const screen = mount([
			{ text: 'שמלה', image: { library: 'widgit', path: 'dress.emf' } }
		]);
		const root = screen.getByTestId('chat-cell').element() as HTMLElement;
		await expect.element(screen.getByTestId('chat-cell')).toBeInTheDocument();

		const imgs = root.querySelectorAll('img');
		expect(imgs).toHaveLength(1);

		const word = root.querySelector('.word') as HTMLElement;
		expect(word).not.toBeNull();
		expect(imgs[0].getBoundingClientRect().top).toBeLessThan(word.getBoundingClientRect().top);
	});

	it('פריט בלי image נשאר טקסט חשוף גם כשיש פותר', async () => {
		const screen = mount([{ text: 'שלום' }]);
		const root = screen.getByTestId('chat-cell').element() as HTMLElement;
		await expect.element(screen.getByTestId('chat-cell')).toBeInTheDocument();
		expect(root.querySelectorAll('img')).toHaveLength(0);
	});

	it('🛑 textContent מדויק — כיווץ הרווחים נשמר', async () => {
		const screen = mount([
			{ text: '1', image: { library: 'widgit', path: 'one.emf' } },
			{ text: ' + ', image: { library: 'widgit', path: 'plus.emf' } },
			{ text: '2', image: { library: 'widgit', path: 'two.emf' } }
		]);
		await expect.element(screen.getByTestId('chat-cell')).toBeInTheDocument();
		expect(screen.getByTestId('chat-cell').element().textContent).toBe('1 + 2');
	});

	it('פריט בלי טקסט אינו מוסיף רווח', async () => {
		const screen = mount([
			{ text: 'שמלה', image: { library: 'widgit', path: 'dress.emf' } },
			{ text: '', image: { library: 'widgit', path: 'empty.emf' } },
			{ text: 'כובע', image: { library: 'widgit', path: 'hat.emf' } }
		]);
		await expect.element(screen.getByTestId('chat-cell')).toBeInTheDocument();
		expect(screen.getByTestId('chat-cell').element().textContent).toBe('שמלה כובע');
	});
});
