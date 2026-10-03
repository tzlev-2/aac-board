/**
 * ריאקטיביות חוצץ-הפלט — בדפדפן אמיתי.
 *
 * 🔑 למה קובץ נפרד: בבדיקות הצד-שרת ה-runes מתקמפלים ל-SSR והם **אינרטיים**,
 * ולכן `runtime.test.ts` מאמת התנהגות אבל לא ריאקטיביות. `ChatCell.svelte`
 * (סלייס 4) קורא `ctx.output.items` בתוך `$derived`; אם המערך יפסיק להיות
 * `$state`, פס-הפלט יישאר ריק בלי שום שגיאה. זו המלכודת שהקובץ הזה סוגר.
 */

import { describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { createRuntime, type SpeechAdapter } from './runtime.svelte';
import { executeCommands, executeCommandChain, withCellContext } from './commands';
import { buildPopupBackFixture } from './__fixtures__/popupBack';
import { openGridSet } from './gridSetSource';
import type { Cell, GridSet, Page, ResolvedStyle, CommandInvocation } from './types';

const STYLE: ResolvedStyle = {
	backColour: '#FFFFFFFF',
	fontColour: '#000000FF',
	borderColour: '#000000FF',
	fontName: 'Arial',
	fontSize: 16,
	backgroundShape: 1,
	tileColour: '#00000000'
};

const silentSpeech: SpeechAdapter = { speak: () => {}, stop: () => {} };

function page(name: string): Page {
	return {
		name,
		columns: 4,
		rows: 3,
		columnWidths: [null, null, null, null],
		rowHeights: [null, null, null],
		cells: [],
		wordList: [],
		predictionSource: 'None',
		autoContentCommands: {},
		background: {}
	};
}

function gridSet(): GridSet {
	return {
		startGrid: 'בית',
		language: 'he-IL',
		symbolSearchKeys: ['widgit'],
		pages: { בית: page('בית'), אוכל: page('אוכל') },
		styles: {}
	};
}

function cell(id: string, params: Record<string, string> = {}): Cell {
	return {
		x: 0,
		y: 0,
		columnSpan: 1,
		rowSpan: 1,
		commands: [{ id, params }],
		style: STYLE
	};
}

describe('ריאקטיביות', () => {
	it('output.items מעדכן $derived כמו ב-ChatCell', () => {
		const rt = createRuntime(gridSet(), { speech: silentSpeech });
		const snapshots: string[] = [];

		const cleanup = $effect.root(() => {
			const line = $derived(rt.output.items.map((item) => item.text).join(' '));
			$effect(() => void snapshots.push(line));
		});

		flushSync();
		executeCommands(cell('Action.InsertText', { text: 'אני' }), rt);
		flushSync();
		executeCommands(cell('Action.Letter', { letter: 'ב' }), rt);
		flushSync();
		executeCommands(cell('Action.Clear'), rt);
		flushSync();
		cleanup();

		expect(snapshots).toEqual(['', 'אני', 'אני ב', '']);
	});

	it('הדף הפעיל ריאקטיבי — Jump.To מעדכן קוראים', () => {
		const rt = createRuntime(gridSet(), { speech: silentSpeech });
		const visited: string[] = [];

		const cleanup = $effect.root(() => {
			$effect(() => void visited.push(rt.page.name));
		});

		flushSync();
		executeCommands(cell('Jump.To', { grid: 'אוכל' }), rt);
		flushSync();
		executeCommands(cell('Jump.Back'), rt);
		flushSync();
		cleanup();

		expect(visited).toEqual(['בית', 'אוכל', 'בית']);
	});
});

describe('חוצץ-הפלט האמיתי — פיסוק, רווח ומחיקת-אות', () => {
	/** מה ש-`ChatCell` מציג בפועל: הפריטים מחוברים ברווח. */
	function line(rt: ReturnType<typeof createRuntime>): string {
		return rt.output.items.map((item) => item.text).join(' ');
	}

	it('🛑 משפט אמיתי מהמקלדת של org-1: ארבע מילים, רווח וסימן-פיסוק', () => {
		const rt = createRuntime(gridSet(), { speech: silentSpeech });
		for (const word of ['אני', 'רוצה', 'לאכול']) {
			executeCommands(cell('Action.InsertText', { text: word }), rt);
		}
		// המילה הרביעית נבנית אות-אחר-אות, כמו בדף "מקלדת מלאה - ראשי".
		for (const letter of ['ע', 'ו', 'ג', 'ה']) {
			executeCommands(cell('Action.Letter', { letter }), rt);
		}
		executeCommands(cell('Action.Punctuation', { letter: '!' }), rt);

		expect(line(rt)).toBe('אני רוצה לאכול עוגה!');
		expect(rt.output.items).toHaveLength(4);
	});

	it('🔑 רווח סוגר את המילה — האות שאחריו פותחת מילה חדשה', () => {
		const rt = createRuntime(gridSet(), { speech: silentSpeech });
		for (const letter of ['ש', 'ל']) {
			executeCommands(cell('Action.Letter', { letter }), rt);
		}
		executeCommands(cell('Action.Space'), rt);
		for (const letter of ['ד', 'ג']) {
			executeCommands(cell('Action.Letter', { letter }), rt);
		}
		expect(rt.output.items.map((i) => i.text)).toEqual(['של ', 'דג']);
		// 🛑 ה-getter מכווץ רווחים — הרווח אינו מכפיל את המפריד.
		expect(rt.outputText).toBe('של דג');
	});

	it('פיסוק אינו סוגר את המילה שבבנייה', () => {
		const rt = createRuntime(gridSet(), { speech: silentSpeech });
		for (const letter of ['ל', 'א']) {
			executeCommands(cell('Action.Letter', { letter }), rt);
		}
		executeCommands(cell('Action.Punctuation', { letter: '!' }), rt);
		executeCommands(cell('Action.Letter', { letter: '?' }), rt);
		expect(rt.output.items.map((i) => i.text)).toEqual(['לא!?']);
	});

	it('Action.DeleteLetter מוחקת אות אחת מהמילה האחרונה', () => {
		const rt = createRuntime(gridSet(), { speech: silentSpeech });
		executeCommands(cell('Action.InsertText', { text: 'שלום' }), rt);
		executeCommands(cell('Action.DeleteLetter'), rt);
		expect(line(rt)).toBe('שלו');
	});

	it('Action.Number בונה מספר כמילה אחת', () => {
		const rt = createRuntime(gridSet(), { speech: silentSpeech });
		for (const digit of ['1', '2', '3']) {
			executeCommands(cell('Action.Number', { letter: digit }), rt);
		}
		expect(rt.output.items.map((i) => i.text)).toEqual(['123']);
	});

	it('רווח על חוצץ ריק אינו מייצר שבב', () => {
		const rt = createRuntime(gridSet(), { speech: silentSpeech });
		executeCommands(cell('Action.Space'), rt);
		expect(rt.output.items).toEqual([]);
	});

	it('🔑 פס-הפלט ריאקטיבי גם דרך appendToStream', () => {
		const rt = createRuntime(gridSet(), { speech: silentSpeech });
		const snapshots: string[] = [];
		const cleanup = $effect.root(() => {
			const text = $derived(line(rt));
			$effect(() => void snapshots.push(text));
		});
		flushSync();
		executeCommands(cell('Action.InsertText', { text: 'מה' }), rt);
		flushSync();
		executeCommands(cell('Action.Punctuation', { letter: '?' }), rt);
		flushSync();
		cleanup();
		expect(snapshots).toEqual(['', 'מה', 'מה?']);
	});
});

describe('CommandExecution.Wait במריץ החי', () => {
	it('🛑 Jump.To שאחרי Wait אינו מנווט מיָד — הדף מתחלף רק אחרי ההשהיה', async () => {
		const rt = createRuntime(gridSet(), { speech: silentSpeech });
		const waitCell: Cell = {
			x: 0,
			y: 0,
			columnSpan: 1,
			rowSpan: 1,
			commands: [
				{ id: 'Action.InsertText', params: { text: 'מה' } },
				{ id: 'CommandExecution.Wait', params: { waittime: '00:00:02', cancellable: '1' } },
				{ id: 'Jump.To', params: { grid: 'אוכל' } }
			],
			style: STYLE
		};

		let release: (() => void) | undefined;
		const chain = executeCommands(waitCell, rt, undefined, {
			delay: () =>
				new Promise<void>((resolve) => {
					release = resolve;
				})
		});

		// 🔑 הראיה: המילה כבר בפס-הפלט, והדף **עוד לא** התחלף.
		expect(rt.output.items.map((i) => i.text)).toEqual(['מה']);
		expect(rt.page.name).toBe('בית');

		release?.();
		await chain;
		expect(rt.page.name).toBe('אוכל');
	});
});

// C6: held promises establish the boundary without elapsed-time assertions.
const insert = (text: string): CommandInvocation => ({ id: 'Action.InsertText', params: { text } });
const jump = (grid: string): CommandInvocation => ({ id: 'Jump.To', params: { grid } });
const wait = (cancellable?: string, waittime = '00:00:02'): CommandInvocation => ({
	id: 'CommandExecution.Wait',
	params: { waittime, ...(cancellable === undefined ? {} : { cancellable }) }
});
function held() {
	let release!: () => void;
	const milliseconds: number[] = [];
	return {
		milliseconds,
		release: () => release(),
		delay: (ms: number) => {
			milliseconds.push(ms);
			return new Promise<void>((resolve) => {
				release = resolve;
			});
		}
	};
}
async function backRuntime() {
	const { gridSet } = await openGridSet(buildPopupBackFixture());
	gridSet.media = new Map([...gridSet.media!, ['owned.wav', new Uint8Array([82, 73, 70, 70])]]);
	const speech = { speak: vi.fn(), stop: vi.fn() };
	const audio = { play: vi.fn(), dispose: vi.fn() };
	const rt = createRuntime(gridSet, { speech, audio });
	return { rt, speech, audio };
}
function commandsCell(commands: CommandInvocation[]): Cell {
	return { ...cell('unused'), commands };
}
const sound: CommandInvocation = {
	id: 'SpeechPlaySound',
	params: { filedata: { data: '.wav', embeddedPath: 'owned.wav' } }
};

describe('C6 successful Back across positive Wait', () => {
	it.each(['1', '0', undefined])(
		'D1/D2: skips the whole suffix for cancellable=%s, retaining prefix and attachment',
		async (flag) => {
			const { rt, speech, audio } = await backRuntime();
			rt.navigate('Q');
			rt.navigate('R');
			rt.navigateWordList('next');
			const attachment = rt.attach();
			const pause = held();
			const chain = executeCommands(
				commandsCell([
					insert('held'),
					{ id: 'Action.Speak', params: {} },
					sound,
					wait(flag),
					insert('late-before'),
					{ id: 'Action.Speak', params: {} },
					sound,
					jump('P'),
					insert('late-after'),
					{ id: 'Action.Speak', params: {} },
					sound
				]),
				rt,
				undefined,
				{ delay: pause.delay, isCurrent: attachment.valid }
			);
			expect(rt.outputText).toBe('held');
			expect(pause.milliseconds).toEqual([2000]);
			rt.activate(commandsCell([{ id: 'Jump.Back', params: {} }]));
			expect(rt.pageName).toBe('Q');
			expect(rt.history).toEqual(['P']);
			expect(rt.wordListPage).toBe(0);
			pause.release();
			await chain;
			expect(rt.pageName).toBe('Q');
			expect(rt.history).toEqual(['P']);
			expect(rt.outputText).toBe('held');
			expect(speech.speak).toHaveBeenCalledTimes(1);
			expect(audio.play).toHaveBeenCalledTimes(1);
			expect(audio.dispose).not.toHaveBeenCalled();
			expect(attachment.valid()).toBe(true);
			expect(rt.backRevision).toBe(1);
			attachment.detach();
		}
	);

	it('D2: popup Back cancels a sentinel even when the pending jump targets the current page', async () => {
		const { rt } = await backRuntime();
		rt.navigate('Q');
		expect(rt.page.selfClosing).toBe(true);
		const pause = held();
		const chain = executeCommandChain([insert('held'), wait(), jump('P'), insert('sentinel')], rt, {
			delay: pause.delay
		});
		rt.back();
		pause.release();
		await chain;
		expect(rt.pageName).toBe('P');
		expect(rt.history).toEqual([]);
		expect(rt.outputText).toBe('held');
	});

	it('D3: no Back completes normally; missing, zero and negative Wait preserve synchronous suffixes', async () => {
		const { rt, speech } = await backRuntime();
		const pause = held();
		const chain = executeCommandChain(
			[insert('prefix'), wait(), jump('Q'), insert('suffix'), { id: 'Action.Speak', params: {} }],
			rt,
			{ delay: pause.delay }
		);
		expect(rt.pageName).toBe('P');
		expect(rt.outputText).toBe('prefix');
		pause.release();
		await chain;
		expect(rt.pageName).toBe('Q');
		expect(rt.outputText).toBe('prefix suffix');
		expect(speech.speak).toHaveBeenCalledTimes(1);
		for (const raw of ['', '0', '-1']) {
			const delay = vi.fn();
			const sync = executeCommandChain(
				[
					wait(undefined, raw),
					{ id: 'Jump.Back', params: {} },
					insert(raw || 'missing'),
					jump('R')
				],
				rt,
				{ delay }
			);
			expect(rt.pageName).toBe('R');
			expect(rt.outputText).toContain(raw || 'missing');
			expect(delay).not.toHaveBeenCalled();
			await sync;
		}
	});

	it('D3: To, Back and Home complete their synchronous suffix before awaiting; each later Wait snapshots afresh', async () => {
		const { rt } = await backRuntime();
		const to = rt.activate(commandsCell([jump('Q'), insert('to')]));
		expect(rt.pageName).toBe('Q');
		expect(rt.outputText).toBe('to');
		await to;
		const back = rt.activate(
			commandsCell([{ id: 'Jump.Back', params: {} }, insert('back'), jump('R')])
		);
		expect(rt.pageName).toBe('R');
		expect(rt.history).toEqual(['P']);
		expect(rt.outputText).toBe('to back');
		await back;
		const home = rt.activate(commandsCell([{ id: 'Jump.Home', params: {} }, insert('home')]));
		expect(rt.pageName).toBe('P');
		expect(rt.history).toEqual([]);
		expect(rt.outputText).toBe('to back home');
		await home;
		rt.navigate('Q');
		const first = held();
		const second = held();
		let pauses = 0;
		const twice = executeCommandChain(
			[wait(), { id: 'Jump.Back', params: {} }, insert('own-back'), wait(), jump('R')],
			rt,
			{ delay: (ms) => (++pauses === 1 ? first.delay(ms) : second.delay(ms)) }
		);
		first.release();
		await Promise.resolve();
		expect(rt.pageName).toBe('P');
		expect(rt.outputText).toContain('own-back');
		expect(pauses).toBe(2);
		second.release();
		await twice;
		expect(rt.pageName).toBe('R');
		const own = held();
		const afterOwnBack = executeCommandChain(
			[{ id: 'Jump.Back', params: {} }, insert('before-wait'), wait(), jump('Q')],
			rt,
			{ delay: own.delay }
		);
		own.release();
		await afterOwnBack;
		expect(rt.pageName).toBe('Q');
	});

	it('D4: To/Home/self/missing and empty-history Back do not revoke; a successful Back cannot be undone by re-entry', async () => {
		const { rt } = await backRuntime();
		const pause = held();
		const chain = executeCommandChain([wait(), insert('survives')], rt, { delay: pause.delay });
		rt.back();
		rt.navigate('Q');
		rt.navigate('Q');
		rt.navigate('MISSING');
		rt.home();
		expect(rt.backRevision).toBe(0);
		pause.release();
		await chain;
		expect(rt.outputText).toBe('survives');
		rt.navigate('Q');
		const stale = held();
		const canceled = executeCommandChain([wait(), insert('revived')], rt, { delay: stale.delay });
		rt.back();
		rt.navigate('Q');
		stale.release();
		await canceled;
		expect(rt.pageName).toBe('Q');
		expect(rt.outputText).toBe('survives');
		expect(rt.backRevision).toBe(1);
	});

	it('D5: revokes every held chain, isolates runtimes and allows newly activated chains', async () => {
		const { rt } = await backRuntime();
		const { rt: other } = await backRuntime();
		rt.navigate('Q');
		const a = held(),
			b = held(),
			independent = held();
		const one = executeCommandChain([wait(), insert('old-one')], rt, { delay: a.delay });
		const two = executeCommands(commandsCell([wait(), insert('old-two')]), rt, undefined, {
			delay: b.delay
		});
		const isolated = executeCommandChain([wait(), insert('other')], other, {
			delay: independent.delay
		});
		rt.back();
		const next = held();
		const fresh = executeCommandChain([wait(), insert('new')], rt, { delay: next.delay });
		b.release();
		await two;
		a.release();
		await one;
		independent.release();
		await isolated;
		next.release();
		await fresh;
		expect(rt.outputText).toBe('new');
		expect(other.outputText).toBe('other');
		expect(other.backRevision).toBe(0);
	});

	it('D6: real AutoContent/item context forwards the original receiver and Runtime.activate uses the same revision', async () => {
		const { rt } = await backRuntime();
		rt.navigate('Q');
		const original = rt.gridSet.pages.Q.cells.find((c) => c.contentSubType === 'WordList')!;
		rt.page.autoContentCommands.WordList = [
			{ id: 'AutoContent.Activate', params: {} },
			wait(),
			insert('late')
		];
		const item = rt.page.wordList[0];
		const wrapper = withCellContext(rt, original, item);
		const pause = held();
		const chain = executeCommands(original, rt, item, { delay: pause.delay });
		expect(wrapper.backRevision).toBe(0);
		expect(rt.outputText).toBe('Q-מילה-0');
		rt.back();
		expect(wrapper.backRevision).toBe(1);
		pause.release();
		await chain;
		expect(rt.outputText).toBe('Q-מילה-0');
		rt.navigate('Q');
		vi.useFakeTimers();
		try {
			const activated = rt.activate(commandsCell([wait(), insert('activate-late')]));
			rt.back();
			await vi.runAllTimersAsync();
			await activated;
			expect(rt.outputText).toBe('Q-מילה-0');
		} finally {
			vi.useRealTimers();
		}
	});
});
