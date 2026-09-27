/**
 * בדיקות מנוע-הפקודות — **בלי DOM**.
 *
 * `RuntimeContext` מזויף כאן במלואו: אין stores, אין tts, אין דפדפן. זה
 * בדיוק מה שמאפשר לבדוק את השרשרת, את השומרים ואת הדקדוק בלי לרנדר כלום.
 */

import { describe, expect, it } from 'vitest';
import {
	blockingGuard,
	canActivate,
	commandRegistry,
	executeCommands,
	paramToText,
	richTextToPlainText
} from './commands';
import type {
	Cell,
	CommandInvocation,
	FeatureId,
	OutputItem,
	ParamValue,
	ResolvedStyle,
	RichText,
	RuntimeContext
} from './types';

// ── תשתית הזיוף ──────────────────────────────────────────────────────────

const STYLE: ResolvedStyle = {
	backColour: '#FFFFFFFF',
	fontColour: '#000000FF',
	borderColour: '#000000FF',
	fontName: 'Arial',
	fontSize: 16,
	backgroundShape: 1
};

interface FakeContext extends RuntimeContext {
	/** יומן קריאות בסדר הופעתן — כך בודקים גם *מה* קרה וגם *מה לא* קרה. */
	readonly log: string[];
	readonly buffer: OutputItem[];
	readonly unimplemented: Record<string, number>;
}

function fakeContext(features: FeatureId[] = []): FakeContext {
	const log: string[] = [];
	const buffer: OutputItem[] = [];
	const unimplemented: Record<string, number> = {};

	const ctx: FakeContext = {
		log,
		buffer,
		unimplemented,
		gridSet: {
			startGrid: 'בית',
			language: 'he-IL',
			symbolSearchKeys: [],
			pages: {},
			styles: {}
		},
		page: {
			name: 'בית',
			columns: 4,
			rows: 3,
			cells: [],
			wordList: [],
			predictionSource: 'None',
			autoContentCommands: {},
			background: {}
		},
		features: new Set(features),
		navigate: (name) => void log.push(`navigate:${name}`),
		back: () => void log.push('back'),
		home: () => void log.push('home'),
		output: {
			insert: (item) => {
				buffer.push(item);
				log.push(`insert:${item.text}`);
			},
			insertLetter: (letter) => {
				buffer.push({ text: letter });
				log.push(`letter:${letter}`);
			},
			clear: () => {
				buffer.length = 0;
				log.push('clear');
			},
			deleteWord: () => void log.push('deleteWord'),
			deleteLetter: () => void log.push('deleteLetter'),
			get items() {
				return buffer;
			}
		},
		speak: (text) => void log.push(`speak:${text ?? '<buffer>'}`),
		stopSpeaking: () => void log.push('stop'),
		reportUnimplemented: (id) => {
			unimplemented[id] = (unimplemented[id] ?? 0) + 1;
			log.push(`unimplemented:${id}`);
		}
	};
	return ctx;
}

function cmd(id: string, params: Record<string, ParamValue> = {}): CommandInvocation {
	return { id, params };
}

function cell(...commands: CommandInvocation[]): Cell {
	return { x: 0, y: 0, columnSpan: 1, rowSpan: 1, commands, style: STYLE };
}

/** טקסט עשיר בצורה המנורמלת: פסקה → משפט → ריצות, הסמל על המשפט. */
function rich(text: string, image?: { library: string; path: string }): RichText {
	return { paragraphs: [{ sentences: [{ runs: [text], ...(image ? { image } : {}) }] }] };
}

// ── תשע הפקודות ──────────────────────────────────────────────────────────

describe('Action.InsertText', () => {
	it('מכניסה את הטקסט לחוצץ', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.InsertText', { text: rich('אני רוצה') })), ctx);
		expect(ctx.buffer).toEqual([{ text: 'אני רוצה' }]);
	});

	it('נושאת את הדקדוק העברי אל פריט-הפלט', () => {
		const ctx = fakeContext();
		executeCommands(
			cell(
				cmd('Action.InsertText', {
					text: rich('רוצה'),
					gender: 'זכר',
					number: 'יחיד',
					person: 'second',
					pos: 'Verb',
					showincelllabel: 'No'
				})
			),
			ctx
		);
		expect(ctx.buffer[0]).toEqual({
			text: 'רוצה',
			gender: 'זכר',
			number: 'יחיד',
			person: 'second',
			pos: 'Verb',
			showInCellLabel: false
		});
	});

	it('נושאת את הסמל שיושב על המשפט, ומדלגת על פרמטרי-דקדוק ריקים', () => {
		const ctx = fakeContext();
		executeCommands(
			cell(
				cmd('Action.InsertText', {
					text: rich('אני', { library: 'MJPCS#', path: '3269.wmf' }),
					gender: '',
					number: ''
				})
			),
			ctx
		);
		expect(ctx.buffer[0]).toEqual({
			text: 'אני',
			image: { library: 'MJPCS#', path: '3269.wmf' }
		});
	});

	it('אינה מוסיפה פריט ריק כשאין טקסט ואין סמל', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.InsertText', { text: '' })), ctx);
		expect(ctx.buffer).toHaveLength(0);
	});
});

describe('Jump.To', () => {
	it('מנווטת לדף לפי שמו', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Jump.To', { grid: '.00 Index' })), ctx);
		expect(ctx.log).toEqual(['navigate:.00 Index']);
	});

	it('בלי יעד — אינה מנווטת ואינה זורקת', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Jump.To', { grid: '  ' })), ctx);
		expect(ctx.log).toEqual([]);
	});
});

describe('Jump.Back', () => {
	it('קוראת ל-back', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Jump.Back')), ctx);
		expect(ctx.log).toEqual(['back']);
	});
});

describe('Jump.Home', () => {
	it('קוראת ל-home', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Jump.Home')), ctx);
		expect(ctx.log).toEqual(['home']);
	});
});

describe('Action.Clear', () => {
	it('מרוקנת את החוצץ', () => {
		const ctx = fakeContext();
		ctx.output.insert({ text: 'שלום' });
		executeCommands(cell(cmd('Action.Clear')), ctx);
		expect(ctx.buffer).toHaveLength(0);
	});
});

describe('Action.Speak', () => {
	it('מקריאה את כל החוצץ — בלי ארגומנט טקסט', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.Speak', { unit: 'All', movecaret: '0' })), ctx);
		expect(ctx.log).toEqual(['speak:<buffer>']);
	});
});

describe('Action.DeleteWord', () => {
	it('קוראת ל-deleteWord', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.DeleteWord')), ctx);
		expect(ctx.log).toEqual(['deleteWord']);
	});
});

describe('Action.Letter', () => {
	it('מוסיפה אות לחוצץ', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.Letter', { letter: 'ש' })), ctx);
		expect(ctx.log).toEqual(['letter:ש']);
	});

	it('אות ריקה אינה עושה כלום', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.Letter', { letter: '' })), ctx);
		expect(ctx.log).toEqual([]);
	});
});

describe('Settings.RequiredFeature — פקודת-שומר', () => {
	it('עוצרת את השרשרת כשהתכונה חסרה', () => {
		const ctx = fakeContext();
		executeCommands(
			cell(
				cmd('Settings.RequiredFeature', { feature: 'ComputerControl' }),
				cmd('Action.InsertText', { text: rich('לא אמור להגיע') }),
				cmd('Jump.To', { grid: 'שולחן עבודה' })
			),
			ctx
		);
		expect(ctx.log).toEqual([]);
	});

	it('מניחה לשרשרת להמשיך כשהתכונה קיימת', () => {
		const ctx = fakeContext(['ComputerControl']);
		executeCommands(
			cell(
				cmd('Settings.RequiredFeature', { feature: 'ComputerControl' }),
				cmd('Action.InsertText', { text: rich('עובד') }),
				cmd('Jump.To', { grid: 'שולחן עבודה' })
			),
			ctx
		);
		expect(ctx.log).toEqual(['insert:עובד', 'navigate:שולחן עבודה']);
	});

	it('שומר בלי שם-תכונה אינו עוצר — לא מכריעים על סמך נתון חסר', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Settings.RequiredFeature', {}), cmd('Action.DeleteWord')), ctx);
		expect(ctx.log).toEqual(['deleteWord']);
	});

	it('שומר באמצע השרשרת עוצר רק את מה שאחריו', () => {
		const ctx = fakeContext();
		executeCommands(
			cell(
				cmd('Action.InsertText', { text: rich('לפני') }),
				cmd('Settings.RequiredFeature', { feature: 'EyeGaze' }),
				cmd('Action.InsertText', { text: rich('אחרי') })
			),
			ctx
		);
		expect(ctx.log).toEqual(['insert:לפני']);
	});
});

// ── המריץ ────────────────────────────────────────────────────────────────

describe('executeCommands', () => {
	it('פקודה לא-מוכרת נספרת, והשרשרת ממשיכה', () => {
		const ctx = fakeContext();
		executeCommands(
			cell(
				cmd('Calculator.Add'),
				cmd('Action.DeleteWord'),
				cmd('Calculator.Add'),
				cmd('Jump.Home')
			),
			ctx
		);
		expect(ctx.unimplemented).toEqual({ 'Calculator.Add': 2 });
		expect(ctx.log.filter((l) => !l.startsWith('unimplemented'))).toEqual(['deleteWord', 'home']);
	});

	it('שרשרת ריקה אינה עושה כלום', () => {
		const ctx = fakeContext();
		executeCommands(cell(), ctx);
		expect(ctx.log).toEqual([]);
	});

	it('הרג׳יסטרי מחזיק בדיוק את תשע הפקודות של הסבב', () => {
		expect(Object.keys(commandRegistry).sort()).toEqual(
			[
				'Action.Clear',
				'Action.DeleteWord',
				'Action.InsertText',
				'Action.Letter',
				'Action.Speak',
				'Jump.Back',
				'Jump.Home',
				'Jump.To',
				'Settings.RequiredFeature'
			].sort()
		);
	});
});

// ── canActivate ──────────────────────────────────────────────────────────

describe('canActivate', () => {
	it('תא שנפתח בשומר שאינו מתקיים אינו פעיל', () => {
		const ctx = fakeContext();
		const blocked = cell(
			cmd('Settings.RequiredFeature', { feature: 'ComputerControl' }),
			cmd('Jump.To', { grid: 'שולחן עבודה' })
		);
		expect(canActivate(blocked, ctx)).toBe(false);
	});

	it('אותו תא פעיל כשהתכונה קיימת', () => {
		const ctx = fakeContext(['ComputerControl']);
		const ok = cell(
			cmd('Settings.RequiredFeature', { feature: 'ComputerControl' }),
			cmd('Jump.To', { grid: 'שולחן עבודה' })
		);
		expect(canActivate(ok, ctx)).toBe(true);
	});

	it('שומר שאינו בראש השרשרת אינו משפיע על הפעילות', () => {
		const ctx = fakeContext();
		const late = cell(
			cmd('Action.InsertText', { text: rich('שלום') }),
			cmd('Settings.RequiredFeature', { feature: 'EyeGaze' })
		);
		expect(canActivate(late, ctx)).toBe(true);
	});

	it('תא בלי פקודות פעיל', () => {
		expect(canActivate(cell(), fakeContext())).toBe(true);
	});

	it('אינו מריץ את השרשרת ואין לו תופעות-לוואי', () => {
		const ctx = fakeContext(['ComputerControl']);
		canActivate(
			cell(
				cmd('Settings.RequiredFeature', { feature: 'ComputerControl' }),
				cmd('Action.InsertText', { text: rich('לא להריץ') })
			),
			ctx
		);
		expect(ctx.log).toEqual([]);
	});

	it('blockingGuard מחזיר את השומר החוסם', () => {
		const ctx = fakeContext();
		const blocked = cell(cmd('Settings.RequiredFeature', { feature: 'EyeGaze' }));
		expect(blockingGuard(blocked, ctx)?.params.feature).toBe('EyeGaze');
	});
});

// ── ממירי פרמטרים ────────────────────────────────────────────────────────

describe('קריאת פרמטרים', () => {
	it('טקסט עשיר: ריצות בלי מפריד, משפטים ברווח, פסקאות בשורה חדשה', () => {
		const value: RichText = {
			paragraphs: [
				{ sentences: [{ runs: ['אני ', 'רוצה'] }, { runs: ['לשתות'] }] },
				{ sentences: [{ runs: ['מים'] }] }
			]
		};
		expect(richTextToPlainText(value)).toBe('אני רוצה לשתות\nמים');
	});

	it('מחרוזת, undefined ומטען בינארי', () => {
		expect(paramToText('All')).toBe('All');
		expect(paramToText(undefined)).toBe('');
		expect(paramToText({ data: 'AAAA' })).toBe('');
	});
});
