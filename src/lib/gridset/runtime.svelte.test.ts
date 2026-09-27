/**
 * ריאקטיביות חוצץ-הפלט — בדפדפן אמיתי.
 *
 * 🔑 למה קובץ נפרד: בבדיקות הצד-שרת ה-runes מתקמפלים ל-SSR והם **אינרטיים**,
 * ולכן `runtime.test.ts` מאמת התנהגות אבל לא ריאקטיביות. `ChatCell.svelte`
 * (סלייס 4) קורא `ctx.output.items` בתוך `$derived`; אם המערך יפסיק להיות
 * `$state`, פס-הפלט יישאר ריק בלי שום שגיאה. זו המלכודת שהקובץ הזה סוגר.
 */

import { describe, expect, it } from 'vitest';
import { flushSync } from 'svelte';
import { createRuntime, type SpeechAdapter } from './runtime.svelte';
import { executeCommands } from './commands';
import type { Cell, GridSet, Page, ResolvedStyle } from './types';

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
