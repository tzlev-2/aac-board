/**
 * בדיקות הקשר-הריצה. גם הן בלי DOM: מתאם-הדיבור מוזרק, ולכן `tts.ts`
 * (ואיתו localStorage ו-IndexedDB) לעולם לא נטען כאן.
 */

import { describe, expect, it } from 'vitest';
import { createRuntime, type SpeechAdapter } from './runtime.svelte';
import { executeCommands } from './commands';
import { featureSet } from './features';
import type { Cell, CommandInvocation, GridSet, Page, ParamValue, ResolvedStyle } from './types';

const STYLE: ResolvedStyle = {
	backColour: '#FFFFFFFF',
	fontColour: '#000000FF',
	borderColour: '#000000FF',
	fontName: 'Arial',
	fontSize: 16,
	backgroundShape: 1
};

function page(name: string): Page {
	return {
		name,
		columns: 4,
		rows: 3,
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
		pages: { בית: page('בית'), אוכל: page('אוכל'), משחקים: page('משחקים') },
		styles: {}
	};
}

function cmd(id: string, params: Record<string, ParamValue> = {}): CommandInvocation {
	return { id, params };
}

function cell(...commands: CommandInvocation[]): Cell {
	return { x: 0, y: 0, columnSpan: 1, rowSpan: 1, commands, style: STYLE };
}

function silentSpeech(): SpeechAdapter & { spoken: string[] } {
	const spoken: string[] = [];
	return {
		spoken,
		speak: (text) => void spoken.push(text),
		stop: () => void spoken.push('<stop>')
	};
}

function runtime(overrides: Parameters<typeof createRuntime>[1] = {}) {
	return createRuntime(gridSet(), { speech: silentSpeech(), ...overrides });
}

describe('ניווט', () => {
	it('מתחיל ב-startGrid', () => {
		expect(runtime().pageName).toBe('בית');
	});

	it('Jump.To מנווטת ודוחפת למחסנית', () => {
		const rt = runtime();
		executeCommands(cell(cmd('Jump.To', { grid: 'אוכל' })), rt);
		expect(rt.pageName).toBe('אוכל');
		expect(rt.history).toEqual(['בית']);
	});

	it('Jump.Back על מחסנית ריקה אינו קורס ואינו מזיז', () => {
		const rt = runtime();
		expect(() => executeCommands(cell(cmd('Jump.Back')), rt)).not.toThrow();
		expect(rt.pageName).toBe('בית');
	});

	it('Jump.Back חוזר צעד אחד', () => {
		const rt = runtime();
		executeCommands(cell(cmd('Jump.To', { grid: 'אוכל' })), rt);
		executeCommands(cell(cmd('Jump.To', { grid: 'משחקים' })), rt);
		executeCommands(cell(cmd('Jump.Back')), rt);
		expect(rt.pageName).toBe('אוכל');
		expect(rt.history).toEqual(['בית']);
	});

	it('Jump.Home חוזר ל-startGrid ומאפס את המחסנית', () => {
		const rt = runtime();
		executeCommands(cell(cmd('Jump.To', { grid: 'אוכל' })), rt);
		executeCommands(cell(cmd('Jump.Home')), rt);
		expect(rt.pageName).toBe('בית');
		expect(rt.history).toEqual([]);
	});

	it('יעד שאינו קיים מדווח ואינו מנווט', () => {
		const missing: string[] = [];
		const rt = runtime({ onMissingPage: (name) => void missing.push(name) });
		executeCommands(cell(cmd('Jump.To', { grid: 'דף שלא קיים' })), rt);
		expect(missing).toEqual(['דף שלא קיים']);
		expect(rt.pageName).toBe('בית');
	});

	it('page מחזיר את הדף הפעיל', () => {
		const rt = runtime();
		executeCommands(cell(cmd('Jump.To', { grid: 'משחקים' })), rt);
		expect(rt.page.name).toBe('משחקים');
	});
});

describe('חוצץ-הפלט', () => {
	it('InsertText מצטבר, ו-DeleteWord מסיר פריט אחד', () => {
		const rt = runtime();
		rt.output.insert({ text: 'אני', gender: 'זכר' });
		rt.output.insert({ text: 'רוצה' });
		executeCommands(cell(cmd('Action.DeleteWord')), rt);
		expect(rt.output.items).toEqual([{ text: 'אני', gender: 'זכר' }]);
	});

	it('Action.Letter בונה מילה אחת אות-אחר-אות', () => {
		const rt = runtime();
		for (const letter of ['ש', 'ל', 'ו', 'ם']) {
			executeCommands(cell(cmd('Action.Letter', { letter })), rt);
		}
		expect(rt.output.items).toEqual([{ text: 'שלום' }]);
	});

	it('InsertText אחרי אותיות פותח פריט חדש', () => {
		const rt = runtime();
		executeCommands(cell(cmd('Action.Letter', { letter: 'א' })), rt);
		rt.output.insert({ text: 'רוצה' });
		executeCommands(cell(cmd('Action.Letter', { letter: 'ב' })), rt);
		expect(rt.output.items.map((i) => i.text)).toEqual(['א', 'רוצה', 'ב']);
	});

	it('deleteLetter מקצר מילה, ומסיר פריט בן אות אחת', () => {
		const rt = runtime();
		rt.output.insert({ text: 'שלום' });
		rt.output.deleteLetter();
		expect(rt.output.items[0].text).toBe('שלו');
		rt.output.insert({ text: 'א' });
		rt.output.deleteLetter();
		expect(rt.output.items).toHaveLength(1);
	});

	it('Action.Clear מרוקן', () => {
		const rt = runtime();
		rt.output.insert({ text: 'שלום' });
		executeCommands(cell(cmd('Action.Clear')), rt);
		expect(rt.output.items).toEqual([]);
	});

	it('DeleteWord על חוצץ ריק אינו קורס', () => {
		const rt = runtime();
		expect(() => executeCommands(cell(cmd('Action.DeleteWord')), rt)).not.toThrow();
	});
});

describe('דיבור', () => {
	it('Action.Speak מוציאה את כל החוצץ למתאם', () => {
		const speech = silentSpeech();
		const rt = createRuntime(gridSet(), { speech });
		rt.output.insert({ text: 'אני' });
		rt.output.insert({ text: 'רוצה מים' });
		executeCommands(cell(cmd('Action.Speak', { unit: 'All' })), rt);
		expect(speech.spoken).toEqual(['אני רוצה מים']);
	});

	it('חוצץ ריק אינו מדבר', () => {
		const speech = silentSpeech();
		const rt = createRuntime(gridSet(), { speech });
		executeCommands(cell(cmd('Action.Speak')), rt);
		expect(speech.spoken).toEqual([]);
	});

	it('stopSpeaking מגיע למתאם', () => {
		const speech = silentSpeech();
		const rt = createRuntime(gridSet(), { speech });
		rt.stopSpeaking();
		expect(speech.spoken).toEqual(['<stop>']);
	});
});

describe('שומרים בהקשר אמיתי', () => {
	it('WEB_FEATURES הריקה חוסמת תא ComputerControl', () => {
		const rt = runtime();
		const blocked = cell(
			cmd('Settings.RequiredFeature', { feature: 'ComputerControl' }),
			cmd('Jump.To', { grid: 'אוכל' })
		);
		expect(rt.canActivate(blocked)).toBe(false);
		rt.activate(blocked);
		expect(rt.pageName).toBe('בית');
	});

	it('הקשר שכן מחזיק את התכונה מפעיל את התא', () => {
		const rt = runtime({ features: featureSet('ComputerControl') });
		const ok = cell(
			cmd('Settings.RequiredFeature', { feature: 'ComputerControl' }),
			cmd('Jump.To', { grid: 'אוכל' })
		);
		expect(rt.canActivate(ok)).toBe(true);
		rt.activate(ok);
		expect(rt.pageName).toBe('אוכל');
	});
});

describe('פקודות לא-ממומשות', () => {
	it('נצברות במונה ומדווחות פעם אחת לכל מזהה', () => {
		const reported: string[] = [];
		const rt = runtime({ onUnimplemented: (id) => void reported.push(id) });
		executeCommands(cell(cmd('Calculator.Add'), cmd('Calculator.Add'), cmd('Photos.Next')), rt);
		expect(rt.unimplemented).toEqual({ 'Calculator.Add': 2, 'Photos.Next': 1 });
		expect(reported).toEqual(['Calculator.Add', 'Photos.Next']);
	});

	it('דוח הכיסוי של ההקשר מונה את מה שנתקלנו בו', () => {
		const rt = runtime();
		executeCommands(cell(cmd('Calculator.Add')), rt);
		expect(rt.coverageReport()).toContain('Calculator.Add×1');
	});
});
