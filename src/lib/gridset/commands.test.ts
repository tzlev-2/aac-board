/**
 * בדיקות מנוע-הפקודות — **בלי DOM**.
 *
 * `RuntimeContext` מזויף כאן במלואו: אין stores, אין tts, אין דפדפן. זה
 * בדיוק מה שמאפשר לבדוק את השרשרת, את שער-הזמינות ואת הדקדוק בלי לרנדר.
 */

import { describe, expect, it } from 'vitest';
import {
	REQUIREMENT_WITHOUT_PARAM,
	commandRegistry,
	executeCommandChain,
	executeCommands,
	isCellAvailable,
	paramToText,
	richTextToPlainText,
	unmetRequirement
} from './commands';
import { WEB_FEATURES, featureSet } from './features';
import type {
	Cell,
	CommandHandler,
	CommandId,
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
	backgroundShape: 1,
	tileColour: '#00000000'
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
			columnWidths: [null, null, null, null],
			rowHeights: [null, null, null],
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

/** מאסף דיווחים של `isCellAvailable` — הוא אינו מקבל ctx. */
function reporter() {
	const seen: CommandId[] = [];
	return { seen, report: (id: CommandId) => void seen.push(id) };
}

// ── תשע הפקודות ──────────────────────────────────────────────────────────

describe('Action.InsertText', () => {
	it('מכניסה את הטקסט לחוצץ', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.InsertText', { text: rich('אני רוצה') })), ctx);
		expect(ctx.buffer).toEqual([{ text: 'אני רוצה' }]);
	});

	it('נושאת את הדקדוק העברי אל פריט-הפלט, גלמי', () => {
		const ctx = fakeContext();
		executeCommands(
			cell(
				cmd('Action.InsertText', {
					text: rich('רוצה'),
					gender: 'זכר',
					number: 'יחיד',
					person: 'גוף שלישי',
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
			person: 'גוף שלישי',
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

	it('מתעלמת מ-indicatorenabled ואינה שומרת אותו בפריט', () => {
		const ctx = fakeContext();
		executeCommands(
			cell(cmd('Action.InsertText', { text: rich('מים'), indicatorenabled: '1' })),
			ctx
		);
		expect(ctx.buffer[0]).toEqual({ text: 'מים' });
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
	it('מוסיפה אות לחוצץ, והערך העברי נשמר גלמי', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.Letter', { letter: 'א' })), ctx);
		expect(ctx.log).toEqual(['letter:א']);
	});

	it('אות ריקה אינה עושה כלום', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.Letter', { letter: '' })), ctx);
		expect(ctx.log).toEqual([]);
	});
});

describe('Settings.RequiredFeature בזמן הרצה', () => {
	it('no-op — אינה עוצרת כלום ואינה נספרת כלא-ממומשת', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Settings.RequiredFeature', { feature: 'ComputerControl' })), ctx);
		expect(ctx.log).toEqual([]);
	});

	it('🛑 היא אחרונה ב-126 מ-126 המופעים — ואינה מונעת ממה שלפניה לרוץ', () => {
		const ctx = fakeContext();
		executeCommands(
			cell(
				cmd('Action.InsertText', { text: rich('אני') }),
				cmd('Action.Speak', { unit: 'All' }),
				cmd('Settings.RequiredFeature', { feature: 'EyeGazeAccess' })
			),
			ctx
		);
		expect(ctx.log).toEqual(['insert:אני', 'speak:<buffer>']);
	});

	it('גם כשהיא בראש — אינה עוצרת. הסינון קרה קודם, בשער-הרינדור', () => {
		const ctx = fakeContext();
		executeCommands(
			cell(
				cmd('Settings.RequiredFeature', { feature: 'ComputerControl' }),
				cmd('Action.DeleteWord')
			),
			ctx
		);
		expect(ctx.log).toEqual(['deleteWord']);
	});
});

// ── שער-הזמינות ──────────────────────────────────────────────────────────

describe('isCellAvailable', () => {
	it('תכונה שאינה בקבוצה — התא אינו זמין', () => {
		const blocked = cell(cmd('Settings.RequiredFeature', { feature: 'EyeGazeAccess' }));
		expect(isCellAvailable(blocked, WEB_FEATURES)).toBe(false);
	});

	it('TouchAccess נמצאת ב-WEB_FEATURES — התא זמין', () => {
		const ok = cell(
			cmd('Action.InsertText', { text: rich('מגע') }),
			cmd('Settings.RequiredFeature', { feature: 'TouchAccess' })
		);
		expect(isCellAvailable(ok, WEB_FEATURES)).toBe(true);
	});

	it('🛑 הצהרה ב-index 1 אחרי Settings.RestAll — 68 מ-126 התאים שלנו', () => {
		const real = cell(
			cmd('Settings.RestAll', { action: 'Off' }),
			cmd('Settings.RequiredFeature', { feature: 'EyeGazeAccess' })
		);
		expect(isCellAvailable(real, WEB_FEATURES)).toBe(false);
	});

	it('🛑 הצהרה אחרונה בשרשרת באורך 3 — אחרי Jump.To', () => {
		const real = cell(
			cmd('Settings.RestAll', { action: 'Off' }),
			cmd('Jump.To', { grid: 'שולחן עבודה' }),
			cmd('Settings.RequiredFeature', { feature: 'ComputerControl' })
		);
		expect(isCellAvailable(real, WEB_FEATURES)).toBe(false);
	});

	it('אינו תלוי במקום ההצהרה — ראש, אמצע וסוף מכריעים זהה', () => {
		const req = cmd('Settings.RequiredFeature', { feature: 'SwitchAccess' });
		const filler = cmd('Settings.RestAll', { action: 'Off' });
		const verdicts = [
			cell(req, filler, filler),
			cell(filler, req, filler),
			cell(filler, filler, req)
		].map((c) => isCellAvailable(c, WEB_FEATURES));
		expect(verdicts).toEqual([false, false, false]);
	});

	it('אותה שרשרת זמינה כשהתכונה כן נמצאת בקבוצה', () => {
		const req = cell(
			cmd('Settings.RestAll', { action: 'Off' }),
			cmd('Settings.RequiredFeature', { feature: 'SwitchAccess' })
		);
		expect(isCellAvailable(req, featureSet('SwitchAccess'))).toBe(true);
	});

	it('🛑 הצהרה בלי פרמטר — התא זמין, והמקרה מדווח (56 מ-126 אצלנו)', () => {
		const { seen, report } = reporter();
		const noParam = cell(
			cmd('Action.InsertText', { text: rich('שלום') }),
			cmd('Settings.RequiredFeature', {})
		);
		expect(isCellAvailable(noParam, WEB_FEATURES, report)).toBe(true);
		expect(seen).toEqual([REQUIREMENT_WITHOUT_PARAM]);
	});

	it('שם-תכונה שאינו באחד מ-12 שנמדדו — זמין ומדווח, לא מוסתר בשקט', () => {
		const { seen, report } = reporter();
		const odd = cell(cmd('Settings.RequiredFeature', { feature: 'Telepathy' }));
		expect(isCellAvailable(odd, WEB_FEATURES, report)).toBe(true);
		expect(seen).toEqual(['Settings.RequiredFeature(Telepathy)']);
	});

	it('תא בלי הצהרות זמין, ואינו מדווח דבר', () => {
		const { seen, report } = reporter();
		expect(isCellAvailable(cell(cmd('Jump.Back')), WEB_FEATURES, report)).toBe(true);
		expect(seen).toEqual([]);
	});

	it('אינו מריץ את השרשרת — אין תופעות-לוואי', () => {
		const ctx = fakeContext(['TouchAccess']);
		isCellAvailable(
			cell(
				cmd('Action.InsertText', { text: rich('לא להריץ') }),
				cmd('Settings.RequiredFeature', { feature: 'TouchAccess' })
			),
			ctx.features
		);
		expect(ctx.log).toEqual([]);
	});

	it('unmetRequirement מחזיר את ההצהרה החוסמת ואת שם התכונה', () => {
		const blocked = cell(
			cmd('Settings.RestAll', { action: 'Off' }),
			cmd('Settings.RequiredFeature', { feature: 'EyeGazeAccess' })
		);
		expect(unmetRequirement(blocked, WEB_FEATURES)?.feature).toBe('EyeGazeAccess');
		expect(unmetRequirement(cell(cmd('Jump.Home')), WEB_FEATURES)).toBeUndefined();
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

	it("'halt' נשאר בחוזה ועוצר את מה שאחריו", () => {
		const ctx = fakeContext();
		const registry: Partial<Record<CommandId, CommandHandler>> = {
			...commandRegistry,
			'Test.Halt': () => 'halt'
		};
		executeCommandChain(
			[cmd('Action.DeleteWord'), cmd('Test.Halt'), cmd('Jump.Home')],
			ctx,
			registry
		);
		expect(ctx.log).toEqual(['deleteWord']);
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
