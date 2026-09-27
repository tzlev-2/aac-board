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
	backgroundShape: 1
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
