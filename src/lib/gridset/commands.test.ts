/**
 * בדיקות מנוע-הפקודות — **בלי DOM**.
 *
 * `RuntimeContext` מזויף כאן במלואו: אין stores, אין tts, אין דפדפן. זה
 * בדיוק מה שמאפשר לבדוק את השרשרת, את שער-הזמינות ואת הדקדוק בלי לרנדר.
 */

import { describe, expect, it } from 'vitest';
import {
	AUTOCONTENT_WITHOUT_ITEM,
	REQUIREMENT_WITHOUT_PARAM,
	cellCommands,
	commandRegistry,
	executeCommandChain,
	executeCommands,
	isCellAvailable,
	isCommandPause,
	parseWaitTimeMs,
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
	RuntimeContext,
	WordListItem
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
			// 🔑 מחקה את `OutputBuffer.appendToStream`: מצטרף לפריט האחרון,
			// ורווח על חוצץ ריק אינו פותח שבב.
			appendToStream: (text) => {
				log.push(`append:${text}`);
				const last = buffer[buffer.length - 1];
				if (!last) {
					if (text.trim()) buffer.push({ text });
					return;
				}
				buffer[buffer.length - 1] = { ...last, text: last.text + text };
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
		playSound: (path) => void log.push(`sound:${path}`),
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

// ── חמש הפקודות של סלייס 11 ───────────────────────────────────────────────
// כל הערכים כאן **נמדדו** מ-org-1..org-4, לא הומצאו: ערכי `letter`, היעדר
// הפרמטרים ב-Space/DeleteLetter, וצורות ה-`waittime`.

describe('Action.Punctuation', () => {
	it('🛑 הפיסוק נדבק למילה שלפניו ואינו שבב נפרד', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.InsertText', { text: rich('עוגה') })), ctx);
		executeCommands(cell(cmd('Action.Punctuation', { letter: '!' })), ctx);
		expect(ctx.buffer).toEqual([{ text: 'עוגה!' }]);
	});

	it('כל 19 תווי-הפיסוק שנמדדו עוברים כמו שהם', () => {
		const measured = [
			'.',
			'?',
			'-',
			'=',
			':',
			',',
			"'",
			'!',
			'×',
			'÷',
			';',
			'#',
			'₪',
			')',
			'(',
			'@',
			'&',
			'"',
			'+'
		];
		expect(measured).toHaveLength(19);
		for (const mark of measured) {
			const ctx = fakeContext();
			executeCommands(cell(cmd('Action.InsertText', { text: rich('מילה') })), ctx);
			executeCommands(cell(cmd('Action.Punctuation', { letter: mark })), ctx);
			expect(ctx.buffer).toEqual([{ text: `מילה${mark}` }]);
		}
	});

	it('חוצץ ריק — הפיסוק פותח פריט, ואינו נעלם', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.Punctuation', { letter: '?' })), ctx);
		expect(ctx.buffer).toEqual([{ text: '?' }]);
	});

	it('בלי `letter` — אין פעולה', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.Punctuation')), ctx);
		expect(ctx.log).toEqual([]);
	});
});

describe('Action.Number', () => {
	it('🔑 הערוץ הוא insertLetter — ספרות בונות מילה, כמו Action.Letter', () => {
		const ctx = fakeContext();
		for (const d of ['1', '2', '3']) {
			executeCommands(cell(cmd('Action.Number', { letter: d })), ctx);
		}
		expect(ctx.log).toEqual(['letter:1', 'letter:2', 'letter:3']);
	});

	it('כל עשר הספרות שנמדדו עוברות', () => {
		const ctx = fakeContext();
		for (const d of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
			executeCommands(cell(cmd('Action.Number', { letter: d })), ctx);
		}
		expect(ctx.log).toHaveLength(10);
	});

	it('בלי `letter` — אין פעולה', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.Number', { letter: '' })), ctx);
		expect(ctx.log).toEqual([]);
	});
});

describe('Action.Space', () => {
	it('🛑 אינה מוסיפה שבב־רווח — היא נדבקת למילה וסוגרת אותה', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.InsertText', { text: rich('אני') })), ctx);
		executeCommands(cell(cmd('Action.Space')), ctx);
		expect(ctx.buffer).toEqual([{ text: 'אני ' }]);
	});

	it('חוצץ ריק — רווח בלבד אינו פותח שבב', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.Space')), ctx);
		expect(ctx.buffer).toEqual([]);
	});

	it('אינה נושאת פרמטרים — נמדד ב-30 מ-30, ופרמטר תועה נבלע', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.Space', { letter: 'מתעלמים' })), ctx);
		expect(ctx.log).toEqual(['append: ']);
	});
});

describe('Action.DeleteLetter', () => {
	it('מוחקת אות מהחוצץ', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.DeleteLetter')), ctx);
		expect(ctx.log).toEqual(['deleteLetter']);
	});

	it('השרשרת שנמדדה ב-org-1: DeleteLetter → DeleteWord, בסדר הזה', () => {
		const ctx = fakeContext();
		executeCommands(cell(cmd('Action.DeleteLetter'), cmd('Action.DeleteWord')), ctx);
		expect(ctx.log).toEqual(['deleteLetter', 'deleteWord']);
	});
});

describe('CommandExecution.Wait — השהיית המשך השרשרת', () => {
	/** מרגל-השהיה: רושם כל בקשה, ופותר רק כשמשחררים במפורש. */
	function delaySpy() {
		const calls: number[] = [];
		let release: (() => void) | undefined;
		return {
			calls,
			delay: (ms: number) =>
				new Promise<void>((resolve) => {
					calls.push(ms);
					release = resolve;
				}),
			releaseAll: async () => {
				release?.();
				// שני סבבי-microtask: אחד לשחרור ההמתנה, אחד להמשך הלולאה.
				await Promise.resolve();
				await Promise.resolve();
			}
		};
	}

	it('🛑 הפקודה שאחריה **אינה** רצה מיָד — השרשרת שנמדדה ב-org-3 (4,0)', async () => {
		const ctx = fakeContext();
		const spy = delaySpy();
		const chain = executeCommands(
			cell(
				cmd('Action.InsertText', { text: rich('מה') }),
				cmd('CommandExecution.Wait', { waittime: '00:00:02', cancellable: '1' }),
				cmd('Jump.To', { grid: 'מה אני רוצה לעשות' })
			),
			ctx,
			undefined,
			{ delay: spy.delay }
		);

		// 🔑 הלב של הבדיקה: ההכנסה כבר קרתה, הקפיצה **עוד לא**.
		expect(ctx.log).toEqual(['insert:מה']);
		expect(spy.calls).toEqual([2000]);

		await spy.releaseAll();
		await chain;
		expect(ctx.log).toEqual(['insert:מה', 'navigate:מה אני רוצה לעשות']);
	});

	it('Wait בראש השרשרת משהה את הכל — השרשרת שנמדדה ב-org-1/מצלמה', async () => {
		const ctx = fakeContext();
		const spy = delaySpy();
		const chain = executeCommands(
			cell(
				cmd('CommandExecution.Wait', { waittime: '00:00:02', cancellable: '1' }),
				cmd('Photos.Snapshot'),
				cmd('SpeechPlaySound')
			),
			ctx,
			undefined,
			{ delay: spy.delay }
		);
		expect(ctx.log).toEqual([]);
		await spy.releaseAll();
		await chain;
		// 🛑 ‏`SpeechPlaySound` **אינו** ברשימה יותר — סלייס 13 מימש אותו.
		// כאן אין לו `filedata`, ולכן הוא יוצא בשקט בלי לנגן ובלי להיספר
		// כלא-ממומש. ‏`Photos.Snapshot` נשאר הפקודה היחידה ללא handler.
		expect(ctx.unimplemented).toEqual({ 'Photos.Snapshot': 1 });
	});

	/**
	 * 🔑 החיזוק שמחליף את מה שהטסט הקודם בדק במקרה.
	 *
	 * הטסט למעלה הוכיח "השרשרת נמשכה" דרך **ספירת לא-ממומשות** — מדד עקיף
	 * שנשבר ברגע שפקודה בשרשרת מקבלת handler. כאן אותה שרשרת בדיוק, אבל
	 * ‏`SpeechPlaySound` מקבל `filedata` אמיתי, וההוכחה היא **האפקט**:
	 * הצליל נוגן, ורק אחרי ההשהיה.
	 */
	it('אחרי Wait, SpeechPlaySound עם filedata מנגן בפועל', async () => {
		const ctx = fakeContext();
		const spy = delaySpy();
		const chain = executeCommands(
			cell(
				cmd('CommandExecution.Wait', { waittime: '00:00:02', cancellable: '1' }),
				cmd('Photos.Snapshot'),
				cmd('SpeechPlaySound', {
					// הצורה שנמדדה: ‏`<data>` נושא **סיומת** ולא שם-קובץ, ו-
					// ‏`embeddedPath` מוזרק במעבר שאחרי הפרסור.
					filedata: { data: '.mp3', embeddedPath: 'Grids/מצלמה/5-1-2-filedata.mp3' }
				})
			),
			ctx,
			undefined,
			{ delay: spy.delay }
		);
		// לפני שחרור ההשהיה — כלום. גם לא הצליל.
		expect(ctx.log).toEqual([]);
		await spy.releaseAll();
		await chain;
		// הסדר הוא סדר-השרשרת: ‏`Photos.Snapshot` עדיין בלי handler, ואחריו
		// הצליל. שניהם **אחרי** ההשהיה.
		expect(ctx.log).toEqual([
			'unimplemented:Photos.Snapshot',
			'sound:Grids/מצלמה/5-1-2-filedata.mp3'
		]);
		expect(ctx.unimplemented).toEqual({ 'Photos.Snapshot': 1 });
	});

	it('🔑 שרשרת בלי Wait נשארת סינכרונית לחלוטין', () => {
		const ctx = fakeContext();
		// בלי `await` כלל — אם המריץ היה דוחה לתור-המיקרו, הלוג היה ריק כאן.
		executeCommands(cell(cmd('Action.InsertText', { text: rich('אני') }), cmd('Jump.Home')), ctx);
		expect(ctx.log).toEqual(['insert:אני', 'home']);
	});

	it('`waittime` חסר — בלי השהיה בכלל, ובלי קריאה ל-delay', async () => {
		const ctx = fakeContext();
		const spy = delaySpy();
		await executeCommands(cell(cmd('CommandExecution.Wait'), cmd('Jump.Home')), ctx, undefined, {
			delay: spy.delay
		});
		expect(spy.calls).toEqual([]);
		expect(ctx.log).toEqual(['home']);
	});

	it('מחזירה CommandPause ולא void — כולל `cancellable` כפי שנמדד', () => {
		const handler = commandRegistry['CommandExecution.Wait'];
		const result = handler?.({ waittime: '00:00:02', cancellable: '1' }, fakeContext());
		expect(isCommandPause(result)).toBe(true);
		expect(result).toEqual({ pauseMs: 2000, cancellable: true });
	});
});

describe('parseWaitTimeMs — שלוש הצורות שנמדדו', () => {
	it('‏00:00:02 ×36 · 00:00:03 ×6 · 00:00:01.5000000 ×2', () => {
		expect(parseWaitTimeMs('00:00:02')).toBe(2000);
		expect(parseWaitTimeMs('00:00:03')).toBe(3000);
		// 🛑 הראיה ש-parseInt על מקטע-השניות היה מחזיר 1000 במקום 1500.
		expect(parseWaitTimeMs('00:00:01.5000000')).toBe(1500);
	});

	it('שעות ודקות נצברות', () => {
		expect(parseWaitTimeMs('00:01:30')).toBe(90_000);
		expect(parseWaitTimeMs('01:00:00')).toBe(3_600_000);
	});

	it('יום מוביל — לא-מאומת מול Grid, אבל נתמך', () => {
		expect(parseWaitTimeMs('1.00:00:00')).toBe(86_400_000);
	});

	it('חסר או פגום ⇒ 0, ולא NaN', () => {
		for (const raw of ['', '   ', 'abc', '00:aa:02', '1:2:3:4', '-00:00:02']) {
			expect(parseWaitTimeMs(raw)).toBe(0);
		}
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
		void executeCommandChain([cmd('Action.DeleteWord'), cmd('Test.Halt'), cmd('Jump.Home')], ctx, {
			registry
		});
		expect(ctx.log).toEqual(['deleteWord']);
	});

	it('שרשרת ריקה אינה עושה כלום', () => {
		const ctx = fakeContext();
		executeCommands(cell(), ctx);
		expect(ctx.log).toEqual([]);
	});

	it('הרג׳יסטרי מחזיק בדיוק את עשרים ואחת הפקודות', () => {
		// ‏21 = ‏15 (עד סלייס 11) + ‏6 (סלייס 13: `Action.InsertCellText` ·
		// ‏`SpeechPlaySound` · ארבע `Settings.Rest*`).
		expect(Object.keys(commandRegistry).sort()).toEqual([
			'Action.Clear',
			'Action.DeleteLetter',
			'Action.DeleteWord',
			'Action.InsertCellText',
			'Action.InsertText',
			'Action.Letter',
			'Action.Number',
			'Action.Punctuation',
			'Action.Space',
			'Action.Speak',
			'AutoContent.Activate',
			'CommandExecution.Wait',
			'Jump.Back',
			'Jump.Home',
			'Jump.To',
			'Settings.RequiredFeature',
			'Settings.RestAll',
			'Settings.RestEyeGaze',
			'Settings.RestPointer',
			'Settings.RestSwitch',
			'SpeechPlaySound'
		]);
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

// ── תא AutoContent — השרשרת ברמת הדף ─────────────────────────────────────

/** תא `AutoContent` כפי שהוא יוצא מהפרסר: **ריק מפקודות**, וזה לא באג. */
function autoCell(subType: string | undefined, ...commands: CommandInvocation[]): Cell {
	return {
		x: 0,
		y: 0,
		columnSpan: 1,
		rowSpan: 1,
		commands,
		contentType: 'AutoContent',
		contentSubType: subType,
		style: STYLE
	};
}

function wordItem(text: string, extras: Partial<WordListItem> = {}): WordListItem {
	return { text: rich(text), ...extras };
}

describe('cellCommands — השרשרת בפועל', () => {
	it('🔑 תא WordList ריק שואב את השרשרת מהדף', () => {
		const ctx = fakeContext();
		ctx.page.autoContentCommands = { WordList: [cmd('AutoContent.Activate')] };
		expect(cellCommands(autoCell('WordList'), ctx.page).map((c) => c.id)).toEqual([
			'AutoContent.Activate'
		]);
	});

	it('🛑 שרשרת על התא **גוברת** ואינה נדרסת', () => {
		const ctx = fakeContext();
		ctx.page.autoContentCommands = { WordList: [cmd('AutoContent.Activate')] };
		const own = autoCell('WordList', cmd('Jump.Home'));
		expect(cellCommands(own, ctx.page).map((c) => c.id)).toEqual(['Jump.Home']);
	});

	it('⚠️ המפתח הוא ה-AutoContentType, לא רק WordList', () => {
		const ctx = fakeContext();
		ctx.page.autoContentCommands = {
			WordList: [cmd('AutoContent.Activate')],
			Photos: [cmd('AutoContent.Activate'), cmd('Jump.To', { grid: 'תמונות' })]
		};
		expect(cellCommands(autoCell('Photos'), ctx.page).map((c) => c.id)).toEqual([
			'AutoContent.Activate',
			'Jump.To'
		]);
	});

	it('סוג שאין לו אוסף בדף — ריק, לא קריסה', () => {
		const ctx = fakeContext();
		ctx.page.autoContentCommands = { WordList: [cmd('AutoContent.Activate')] };
		expect(cellCommands(autoCell('Prediction'), ctx.page)).toEqual([]);
		expect(cellCommands(autoCell(undefined), ctx.page)).toEqual([]);
	});

	it('תא רגיל (בלי ContentType) אינו נוגע בטבלת הדף', () => {
		const ctx = fakeContext();
		ctx.page.autoContentCommands = { WordList: [cmd('AutoContent.Activate')] };
		expect(cellCommands(cell(), ctx.page)).toEqual([]);
		expect(cellCommands(cell(cmd('Jump.Back')), ctx.page).map((c) => c.id)).toEqual(['Jump.Back']);
	});
});

describe('AutoContent.Activate', () => {
	it('🔑 מכניסה את הפריט של המשבצת לפס-הפלט', () => {
		const ctx = fakeContext();
		ctx.page.autoContentCommands = { WordList: [cmd('AutoContent.Activate')] };
		executeCommands(autoCell('WordList'), ctx, wordItem('שמלה'));
		expect(ctx.buffer).toEqual([{ text: 'שמלה' }]);
	});

	it('🔑 נושאת את הדקדוק של ה-WordListItem, לא רק מחרוזת', () => {
		const ctx = fakeContext();
		ctx.page.autoContentCommands = { WordList: [cmd('AutoContent.Activate')] };
		executeCommands(
			autoCell('WordList'),
			ctx,
			wordItem('נעליים', {
				partOfSpeech: 'Noun',
				grammar: { number: 'plural', person: 'third' }
			})
		);
		expect(ctx.buffer[0]).toEqual({
			text: 'נעליים',
			number: 'plural',
			person: 'third',
			pos: 'Noun'
		});
	});

	it('הסמל של הפריט נישא לפריט-הפלט', () => {
		const ctx = fakeContext();
		ctx.page.autoContentCommands = { WordList: [cmd('AutoContent.Activate')] };
		const image = { library: 'widgit', path: 'a.emf' };
		executeCommands(autoCell('WordList'), ctx, wordItem('כובע', { image }));
		expect(ctx.buffer[0].image).toEqual(image);
	});

	it('סמל שיושב על ה-<s> נתפס גם בלי <Image> על הפריט', () => {
		const ctx = fakeContext();
		ctx.page.autoContentCommands = { WordList: [cmd('AutoContent.Activate')] };
		const image = { library: 'widgit', path: 'b.emf' };
		executeCommands(autoCell('WordList'), ctx, { text: rich('גרב', image) });
		expect(ctx.buffer[0].image).toEqual(image);
	});

	it('בלי פריט בהקשר — לא מכניסה, ומדווחת במקום לשתוק', () => {
		const ctx = fakeContext();
		ctx.page.autoContentCommands = { Prediction: [cmd('AutoContent.Activate')] };
		executeCommands(autoCell('Prediction'), ctx);
		expect(ctx.buffer).toEqual([]);
		expect(ctx.unimplemented[AUTOCONTENT_WITHOUT_ITEM]).toBe(1);
	});

	it('שרשרת מעורבת מהדף רצה כולה, והפריט זמין רק ל-Activate', () => {
		const ctx = fakeContext();
		ctx.page.autoContentCommands = {
			WordList: [cmd('AutoContent.Activate'), cmd('Action.Speak')]
		};
		executeCommands(autoCell('WordList'), ctx, wordItem('מעיל'));
		expect(ctx.log).toEqual(['insert:מעיל', 'speak:<buffer>']);
	});

	it('🛑 ההקשר המקורי אינו נפגע — הפריט חי רק לאורך ההפעלה', () => {
		const ctx = fakeContext();
		ctx.page.autoContentCommands = { WordList: [cmd('AutoContent.Activate')] };
		executeCommands(autoCell('WordList'), ctx, wordItem('חולצה'));
		expect(ctx.autoContentItem).toBeUndefined();
	});
});

it('C6 legacy contexts without Back revision retain their suspended suffix through cell wrapping', async () => {
	const ctx = fakeContext();
	let release!: () => void;
	const chain = executeCommands(
		cell(
			cmd('CommandExecution.Wait', { waittime: '2' }),
			cmd('Action.InsertText', { text: 'legacy' })
		),
		ctx,
		undefined,
		{
			delay: () =>
				new Promise<void>((resolve) => {
					release = resolve;
				})
		}
	);
	ctx.back();
	release();
	await chain;
	expect(ctx.log).toEqual(['back', 'insert:legacy']);
});
