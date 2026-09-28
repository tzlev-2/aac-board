/**
 * שרשרת-הפקודות של gridset — רג'יסטרי, מריץ, ושער-זמינות.
 *
 * 🔑 **רג'יסטרי, לא `switch`.** הקטלוג מונה 353 פקודות, 63 בשימוש בלוחות
 * שנותחו, ו-15 מהן מכסות 95.3% מההפעלות בשלוש הרמות. הוספת אחת
 * מהנותרות חייבת להיות **ערך במפה** — בלי לגעת במריץ. ‏🛑 סלייס 11 שבר את
 * הכלל פעם אחת ובמכוון: ‏`CommandExecution.Wait` היא הפקודה הראשונה שהמריץ
 * **כן** נדרש להכיר, כי השהיה אינה "עוד ערך במפה". ראו `CommandPause`
 * ב-`types.ts`.
 *
 * 🛑 **הקובץ הזה נבדק בלי DOM.** אין כאן import של stores, של tts, ושל שום
 * דבר שנוגע ב-`window`. כל מה ש-handler יכול לעשות עובר דרך `RuntimeContext`.
 *
 * מקור: docs/plans/gridset-core-design.md §1 (מתוקן 27.9.2026) ·
 * docs/briefs/5-commands-engine.md (סבב 2).
 */

import { isKnownFeature } from './features';
import type {
	Cell,
	CommandHandler,
	CommandId,
	CommandInvocation,
	CommandPause,
	CommandResult,
	FeatureId,
	Grammar,
	ImageRef,
	OutputItem,
	Page,
	ParamValue,
	RichText,
	RuntimeContext,
	WordListItem
} from './types';

// ── קריאת פרמטרים ────────────────────────────────────────────────────────
// ParamValue הוא איחוד: מחרוזת · טקסט עשיר · מטען בינארי · רשימת מילים.
// handler לעולם לא עושה cast — הוא עובר דרך הממירים כאן.

/** האם הערך הוא טקסט עשיר (`Text/p/s/r` אחרי נרמול הפרסר). */
export function isRichText(value: unknown): value is RichText {
	return (
		typeof value === 'object' &&
		value !== null &&
		Array.isArray((value as Partial<RichText>).paragraphs)
	);
}

/**
 * צמצום טקסט עשיר למחרוזת: ריצות מתחברות בלי מפריד (הן חלקי אותו משפט),
 * משפטים ברווח, פסקאות בשורה חדשה.
 */
export function richTextToPlainText(rich: RichText): string {
	return rich.paragraphs
		.map((p) => p.sentences.map((s) => s.runs.join('')).join(' '))
		.join('\n')
		.trim();
}

/** הסמל הראשון שנמצא בטקסט העשיר. 🔑 הסמל יושב על ה-`<s>`, לא על התא. */
export function firstImageOf(rich: RichText): ImageRef | undefined {
	for (const paragraph of rich.paragraphs) {
		for (const sentence of paragraph.sentences) {
			if (sentence.image) return sentence.image;
		}
	}
	return undefined;
}

/** ערך פרמטר כלשהו → מחרוזת. מטען בינארי (`{ data }`) מצטמצם למחרוזת ריקה. */
export function paramToText(value: ParamValue | undefined): string {
	if (value === undefined) return '';
	if (typeof value === 'string') return value;
	if (isRichText(value)) return richTextToPlainText(value);
	if (Array.isArray(value)) {
		return (value as WordListItem[])
			.map((item) => richTextToPlainText(item.text))
			.filter(Boolean)
			.join(' ');
	}
	return '';
}

/** פרמטר בוליאני של Grid: `Yes`/`No`, `1`/`0`, `True`/`False`. חסר ⇒ undefined. */
function paramToBool(value: ParamValue | undefined): boolean | undefined {
	const raw = paramToText(value).trim().toLowerCase();
	if (!raw) return undefined;
	return raw === 'yes' || raw === '1' || raw === 'true' || raw === 'on';
}

/**
 * ‏`waittime` → מילישניות. הפורמט הוא `TimeSpan` של .NET.
 *
 * **נמדד** ב-44 המופעים ב-`org-1..org-4`: ‏`00:00:02` ×36 · ‏`00:00:03` ×6 ·
 * ‏`00:00:01.5000000` ×2 — כלומר `hh:mm:ss` עם שבריר-שנייה אופציונלי.
 * ‏`00:00:01.5000000` הוא הראיה שאסור ל-`parseInt` על מקטע-השניות.
 *
 * ‏`d.hh:mm:ss` (יום מוביל) חוקי ב-`TimeSpan` ונתמך כאן — **לא-מאומת מול Grid**,
 * לא נצפה באף מופע. מחרוזת חסרה או פגומה ⇒ ‏0, כלומר בלי השהיה.
 */
export function parseWaitTimeMs(raw: string): number {
	const value = raw.trim();
	if (!value) return 0;
	// 🛑 `Number('-00')` הוא `-0`, ו-`-0 < 0` הוא **false** — בדיקת-סימן על
	// המספרים לבדה הייתה מקבלת `-00:00:02` כ-2,000ms. הסימן נפסל על המחרוזת.
	if (value.includes('-')) return 0;

	// `1.02:03:04` — היום מופרד בנקודה מהשעות, ורק כשיש שלושה מקטעי-זמן.
	let days = 0;
	let rest = value;
	const dayMatch = /^(\d+)\.(?=\d+:\d+:\d+)/.exec(value);
	if (dayMatch) {
		days = Number(dayMatch[1]);
		rest = value.slice(dayMatch[0].length);
	}

	const parts = rest.split(':');
	if (parts.length > 3) return 0;
	const nums = parts.map(Number);
	if (nums.some((n) => !Number.isFinite(n))) return 0;

	// מקטע אחד = שניות · שניים = mm:ss · שלושה = hh:mm:ss.
	const [h, m, sec] =
		nums.length === 3 ? nums : nums.length === 2 ? [0, nums[0], nums[1]] : [0, 0, nums[0]];
	return Math.round(((days * 24 + h) * 3600 + m * 60 + sec) * 1000);
}

/** האם התוצאה היא בקשת-השהיה (ולא `void`/`'halt'`). */
export function isCommandPause(result: CommandResult): result is CommandPause {
	return typeof result === 'object' && result !== null && 'pauseMs' in result;
}

/**
 * דקדוק מפרמטרי `Action.InsertText`. 🔑 הערכים **עבריים** (`gender=זכר`,
 * `number=יחיד`, `person=גוף שלישי`) ונשמרים **גלמיים** — אין כאן מיפוי
 * לאנגלית. חוקי הנטייה הם plan.md שלב E ואינם בסבב הזה, אבל המודל נושא
 * את השדות מהיום.
 */
function grammarFromParams(params: Record<string, ParamValue>): Grammar {
	const grammar: Grammar = {};
	const gender = paramToText(params.gender).trim();
	const number = paramToText(params.number).trim();
	const person = paramToText(params.person).trim();
	const pos = paramToText(params.pos).trim();
	if (gender) grammar.gender = gender;
	if (number) grammar.number = number;
	if (person) grammar.person = person;
	if (pos) grammar.pos = pos;
	return grammar;
}

// ── שער-הזמינות ──────────────────────────────────────────────────────────
// 🛑 תוקן 27.9.2026 אחרי אימות מול 116 קובצי .gridset.
//
// `Settings.RequiredFeature` **אינה פקודת-שומר**. היא הפקודה האחרונה
// ב-4,014 מ-4,155 המופעים (96.6%), ובלוחות-הדגימה ב-126 מ-126 — ולכן אין
// לה מה לעצור. זו **הצהרת-דרישה של התא בתחביר של פקודה**, וההשפעה שלה היא
// בזמן **רינדור**: תא שדרישתו אינה מתקיימת אינו מצויר, אך שומר את משבצתו.
//
// שתי מסקנות שנקנו בדם באימות:
//   1. בדיקת ראש-שרשרת בלבד מחמיצה 54% מהמופעים (68 מ-126 יושבים ב-index 1,
//      אחרי `Settings.RestAll`/`Jump.To`) — לכן סורקים את **כל** השרשרת.
//   2. `'halt'` לא רק מיותר כאן אלא מזיק: בעשרה תאים `Jump.To` מקדים את
//      ההצהרה, הניווט כבר התבצע, ו-`'halt'` אינו מבטל דבר.
//
// 🛑 וזה אינו `Cell.visibility` — אלמנט נפרד (1,555 מופעים), מנגנון אחר.

/** `ok` = הדרישה מתקיימת · `blocked` = אינה מתקיימת · `unknown` = לא ניתן להכריע. */
export type Availability = 'ok' | 'blocked' | 'unknown';

/**
 * כלל-זמינות: פקודה שמצהירה על דרישה מהסביבה. רג'יסטרי, בדיוק כמו
 * הפקודות — דרישה חדשה היא ערך במפה.
 */
export type AvailabilityRule = (
	params: Record<string, ParamValue>,
	features: ReadonlySet<FeatureId>
) => Availability;

/** מזהה שמדווח כשהצהרת-דרישה מגיעה בלי פרמטר `feature` (280 מופעים). */
export const REQUIREMENT_WITHOUT_PARAM = 'Settings.RequiredFeature(no-param)';

function requiredFeatureAvailability(
	params: Record<string, ParamValue>,
	features: ReadonlySet<FeatureId>
): Availability {
	const feature = paramToText(params.feature).trim();

	// 🛑 `<Command ID="Settings.RequiredFeature" />` בלי פרמטר כלל — 280 מופעים
	// בחבילה, **56 מתוך 126 בלוחות-הדגימה**. מימוש תמים כותב
	// `features.has(undefined)`, מקבל `false`, ומסתיר 56 תאים בשקט.
	// הוכרע: אין פרמטר = אין דרישה. התא זמין, והמקרה מדווח כדי שיהיה נראה.
	if (!feature) return 'unknown';

	// שם שאינו באחד משנים-עשר הערכים שנמדדו ⇒ נתון חדש, לא הכרעה. לא מסתירים
	// תא על סמך מה שלא ידוע — מדווחים ומציגים.
	if (!isKnownFeature(feature)) return 'unknown';

	return features.has(feature) ? 'ok' : 'blocked';
}

/** רג'יסטרי כללי-הזמינות. */
export const availabilityRules: Partial<Record<CommandId, AvailabilityRule>> = {
	'Settings.RequiredFeature': requiredFeatureAvailability
};

/**
 * האם התא זמין — **שער רינדור**, נקרא לפני הציור ולא בזמן ההפעלה.
 *
 * 🔑 סורק את **כל השרשרת**, ללא תלות במקום ההצהרה. תא שאינו זמין אינו
 * מצויר אך שומר את משבצתו — בלי reflow, ובלי להריץ שום פקודה.
 *
 * @param report דיווח על הצהרה שלא ניתן להכריע (בלי פרמטר / שם לא מוכר).
 *               בדרך כלל `ctx.reportUnimplemented`.
 */
export function isCellAvailable(
	cell: Cell,
	features: ReadonlySet<FeatureId>,
	report?: (id: CommandId) => void
): boolean {
	for (const inv of cell.commands) {
		const rule = availabilityRules[inv.id];
		if (!rule) continue;
		const verdict = rule(inv.params, features);
		if (verdict === 'blocked') return false;
		if (verdict === 'unknown') {
			const feature = paramToText(inv.params.feature).trim();
			report?.(feature ? `${inv.id}(${feature})` : REQUIREMENT_WITHOUT_PARAM);
		}
	}
	return true;
}

/**
 * ההצהרה שחוסמת את התא — למי שרוצה להסביר *למה* התא אינו מצויר.
 * סורקת את כל השרשרת, כמו `isCellAvailable`.
 */
export function unmetRequirement(
	cell: Cell,
	features: ReadonlySet<FeatureId>
): { command: CommandInvocation; feature: string } | undefined {
	for (const inv of cell.commands) {
		const rule = availabilityRules[inv.id];
		if (!rule) continue;
		if (rule(inv.params, features) === 'blocked') {
			return { command: inv, feature: paramToText(inv.params.feature).trim() };
		}
	}
	return undefined;
}

// ── תא AutoContent — השרשרת יושבת ברמת הדף ───────────────────────────────
// 🛑 נמדד 28.9.2026 על org-1..org-4: **166 הפעלות** תחת
// `/Grid/AutoContentCommands/AutoContentCommandCollection/Commands/Command`,
// מהן `AutoContent.Activate` ×158. תא `AutoContent` עצמו **ריק מפקודות**
// (‏11 מ-11 ב-`org-1/בגדים`), ולכן כל מי שקורא רק את `cell.commands` רואה
// שרשרת ריקה, ‏`GridCell` מסיק שהתא אינו לחיץ — ו-2,025 תאי `AutoContent`
// בקורפוס מתים בשקט.

/** דווח כשהפקודה מופעלת בלי פריט בהקשר — למשל תא `AutoContent/Prediction`. */
export const AUTOCONTENT_WITHOUT_ITEM = 'AutoContent.Activate(no-item)';

/**
 * השרשרת **בפועל** של התא.
 *
 * 🛑 **אינה דורסת `cell.commands`.** תא `AutoContent` עשוי לשאת שרשרת משלו,
 * ואז היא גוברת; רק תא ריק שואב מהדף.
 * ⚠️ המפתח הוא ה-`AutoContentType`, ולא רק `WordList`: נמדדו גם `Prediction`
 * (‏3 דפים ב-org-1) ו-`Photos` (‏1). סוג שאין לו אוסף בדף מחזיר ריק.
 */
export function cellCommands(cell: Cell, page: Page): readonly CommandInvocation[] {
	if (cell.commands.length > 0) return cell.commands;
	if (cell.contentType !== 'AutoContent' || !cell.contentSubType) return cell.commands;
	return page.autoContentCommands[cell.contentSubType] ?? cell.commands;
}

/**
 * הקשר-ריצה שנושא את **התא שרצים עליו ואת הפריט שהוא מציג כרגע**.
 *
 * שתי פקודות נשענות על זה, ואף אחת מהן אינה קוראת פרמטר:
 * ‏`AutoContent.Activate` — פקודה אחת שמשרתת תא אחד לכל פריט, ומה שמבדיל בין
 * ההפעלות הוא `autoContentItem`; ‏`Action.InsertCellText` — מכניסה את
 * ה-`Caption` של `cell`.
 *
 * 🔑 **האצלה מפורשת ולא `Object.create`/spread:** ‏`GridRuntime` מחזיק שדות
 * פרטיים (`#history`, ‏`#pageName`), וקריאה למתודה שלו דרך אובייקט-נגזר
 * הייתה זורקת. כאן כל קריאה חוזרת ל-`ctx` המקורי כמקבל.
 *
 * 🛑 **מחזיר את `ctx` כמות שהוא כששניהם חסרים** — כך שרשרת שהורצה ישירות
 * דרך `executeCommandChain` אינה משלמת עטיפה, ו-30 הטסטים שמזריקים `ctx`
 * מזויף ממשיכים לקבל בדיוק את האובייקט שהזריקו.
 */
export function withCellContext(
	ctx: RuntimeContext,
	cell: Cell | undefined,
	item: WordListItem | undefined
): RuntimeContext {
	if (!item && !cell) return ctx;
	return {
		get gridSet() {
			return ctx.gridSet;
		},
		get page() {
			return ctx.page;
		},
		get features() {
			return ctx.features;
		},
		get output() {
			return ctx.output;
		},
		autoContentItem: item ?? ctx.autoContentItem,
		cell: cell ?? ctx.cell,
		navigate: (name) => ctx.navigate(name),
		back: () => ctx.back(),
		home: () => ctx.home(),
		speak: (text, opts) => ctx.speak(text, opts),
		stopSpeaking: () => ctx.stopSpeaking(),
		playSound: (path) => ctx.playSound(path),
		reportUnimplemented: (id) => ctx.reportUnimplemented(id)
	};
}

/**
 * @deprecated השם הישן, מסלייס 10. ‏`withCellContext` נושא גם את התא.
 * נשמר כדי שקוראים קיימים לא יישברו.
 */
export function withAutoContentItem(
	ctx: RuntimeContext,
	item: WordListItem | undefined
): RuntimeContext {
	return withCellContext(ctx, undefined, item);
}

// ── רג'יסטרי הפקודות ─────────────────────────────────────────────────────
// 21 פקודות אחרי סלייס 13.
//
// 🛑 **הכיסוי נמדד לכל לוח בנפרד, ולא על לוח אחד.** זה עיקר סלייס 13: השער
// ("≥96%") נמדד עד כה על `org-1` בלבד, ובמדידה לכל לוחות-הארגון התגלה
// ש-`org-3` עומד על **87.3%** — תשע נקודות מתחת, ואיש לא ידע.
//
// נמדד 28.9.2026, אלמנט `<Command ID=…>` תחת `Grids/**/grid.xml`, שלוש הרמות:
//   | לוח   | לפני            | אחרי            |
//   | org-1 | 1,113/1,152 96.6% | 1,114/1,152 96.7% |
//   | org-2 | 2,074/2,110 98.3% | 2,075/2,110 98.3% |
//   | org-3 |   419/480  87.3% |   462/480  96.3% |
//
// ‏`org-4` **אינו לוח רביעי** — ‏53 מ-54 חברי ה-zip זהי-CRC ל-`org-3`, והם
// נבדלים ב-`Settings0/settings.xml` בלבד. אינו נספר.

export const commandRegistry: Partial<Record<CommandId, CommandHandler>> = {
	/**
	 * 1,736 הפעלות. `text` הוא טקסט עשיר; `gender`/`number`/`person`/`pos`
	 * נישאים לחוצץ-הפלט, ו-`showincelllabel` נשמר לרינדור.
	 *
	 * ℹ️ `indicatorenabled` מופיע ב-1,739 מ-1,739 המופעים ו**מושמט בכוונה**:
	 * הוא שולט במחוון-המצב של Grid 3 (הנקודה שמסמנת פקודה פעילה בממשק
	 * הפיזי), ואין לו מקבילה בקלון-הווב. אינו נשמר כדי לא להעמיד פנים
	 * שהמידע משפיע על משהו — כשיהיה מחוון, הפרמטר יחזור לכאן.
	 */
	'Action.InsertText': (params, ctx) => {
		const raw = params.text;
		const text = paramToText(raw);
		const image = isRichText(raw) ? firstImageOf(raw) : undefined;
		// פריט ריק לגמרי היה מוסיף שבב ריק לפס-הפלט — אין מה להכניס.
		if (!text && !image) return;

		const item: OutputItem = { text, ...grammarFromParams(params) };
		if (image) item.image = image;
		const showInCellLabel = paramToBool(params.showincelllabel);
		if (showInCellLabel !== undefined) item.showInCellLabel = showInCellLabel;
		ctx.output.insert(item);
	},

	/** 464 הפעלות. `grid` הוא **שם הדף** — המפתח ב-`GridSet.pages`. */
	'Jump.To': (params, ctx) => {
		const grid = paramToText(params.grid).trim();
		if (!grid) return;
		ctx.navigate(grid);
	},

	/** 375 הפעלות. מחסנית ריקה אינה שגיאה — ההקשר מחליט מה לעשות. */
	'Jump.Back': (_params, ctx) => {
		ctx.back();
	},

	/** 262 הפעלות. היעד הוא `gridSet.startGrid`. */
	'Jump.Home': (_params, ctx) => {
		ctx.home();
	},

	/** 212 הפעלות. */
	'Action.Clear': (_params, ctx) => {
		ctx.output.clear();
	},

	/**
	 * 212 הפעלות. `unit=All` הוא הערך היחיד שנצפה; יחידות-משנה (משפט, מילה)
	 * ייכנסו עם הסמן. `movecaret` אינו ממומש — הסמן בחוצץ הוא תמיד הסוף.
	 */
	'Action.Speak': (_params, ctx) => {
		ctx.speak();
	},

	/** 204 הפעלות. */
	'Action.DeleteWord': (_params, ctx) => {
		ctx.output.deleteWord();
	},

	/**
	 * 126 הפעלות. 🛑 **no-op בזמן הרצה, בכוונה.**
	 *
	 * זו הצהרת-דרישה שנצרכת ב-`isCellAvailable` לפני הרינדור, ולא פעולה.
	 * היא אחרונה בשרשרת ב-126 מ-126 המופעים בלוחות-הדגימה — אין לה מה לעצור,
	 * ובעשרה תאים שבהם `Jump.To` מקדים אותה עצירה כבר הייתה מאחרת את
	 * הרכבת. נשארת ברג'יסטרי כדי שלא תיספר כפקודה לא-ממומשת.
	 */
	'Settings.RequiredFeature': () => {},

	/** 118 הפעלות. בונה מילה אות-אחר-אות בתוך פריט אחד בחוצץ. */
	'Action.Letter': (params, ctx) => {
		const letter = paramToText(params.letter);
		if (!letter) return;
		ctx.output.insertLetter(letter);
	},

	/**
	 * ‏33 הפעלות (‏22 ב-`org-1`). **‏`letter` הוא תו-פיסוק בודד**, ונמדדו 19
	 * ערכים שונים: ‏`.` ‏`?` ‏`-` ‏`=` ×3 · ‏`:` ‏`,` ‏`\'` ‏`!` ‏`×` ‏`÷` ×2 ·
	 * ‏`;` ‏`#` ‏`₪` ‏`)` ‏`(` ‏`@` ‏`&` ‏`"` ‏`+` ×1.
	 *
	 * 🛑 **‏`appendToStream` ולא `insertLetter`** — פיסוק נדבק למילה שלפניו.
	 * ‏`insertLetter` פותחת פריט חדש כשאין מילה בבנייה (למשל אחרי
	 * ‏`Action.InsertText`), ואז ‏`ChatCell` — שמחבר פריטים ברווח — היה מציג
	 * ‏"עוגה !" במקום "עוגה!".
	 */
	'Action.Punctuation': (params, ctx) => {
		const letter = paramToText(params.letter);
		if (!letter) return;
		ctx.output.appendToStream(letter);
	},

	/**
	 * ‏30 הפעלות (‏20 ב-`org-1`). ‏`letter` הוא ספרה בודדת — נמדד `0`–`9`,
	 * שלוש פעמים כל אחת, ואין ערך אחר.
	 *
	 * 🔑 **אותו מנגנון כמו `Action.Letter`** ולא כמו `Action.Punctuation`:
	 * ספרות בונות **מילה** (‏`1`·`2`·`3` ⇒ ‏"123"), ולכן הן פותחות פריט חדש
	 * כשאין מילה בבנייה ואינן נדבקות למילה הקודמת.
	 */
	'Action.Number': (params, ctx) => {
		const letter = paramToText(params.letter);
		if (!letter) return;
		ctx.output.insertLetter(letter);
	},

	/**
	 * ‏30 הפעלות (‏15 ב-`org-1`). **בלי פרמטרים כלל** — נמדד ב-30 מ-30.
	 *
	 * מה שהיא עושה אצלנו: **סוגרת את המילה שבבנייה**, כך שהאות הבאה תפתח
	 * פריט חדש. ‏`ChatCell` כבר מחבר פריטים ברווח, ולכן אין צורך בשבב-רווח
	 * נפרד — והוא היה נראה כשבב ריק בפס-הפלט.
	 */
	'Action.Space': (_params, ctx) => {
		ctx.output.appendToStream(' ');
	},

	/**
	 * ‏13 הפעלות (‏**9** ב-`org-1`; ‏4 ב-`org-2`, ‏0 ב-`org-3/4`).
	 * **בלי פרמטרים כלל** — נמדד ב-13 מ-13.
	 * ⚠️ הבריף ייחס את ‏13 ל-`org-1`; ‏13 הוא הסך על ארבעת הלוחות.
	 */
	'Action.DeleteLetter': (_params, ctx) => {
		ctx.output.deleteLetter();
	},

	/**
	 * ‏44 הפעלות (‏1 ב-`org-1`, ‏1 ב-`org-2`, ‏21 ב-`org-3`, ‏21 ב-`org-4`).
	 *
	 * 🛑 **זהו באג התנהגותי שנמדד, ולא סתם פקודה חסרה.** השרשרת השכיחה היא
	 * ‏`Action.InsertText → CommandExecution.Wait → Jump.To` (‏40 תאים
	 * ב-`org-3/4`, למשל ‏(‏4,0) ב-"עמוד ראשי" = "מה"). בלי מימוש, **הקפיצה
	 * מתבצעת מיָד** והמשתמש לא רואה את המילה שהוא בחר נכנסת לפס-הפלט.
	 * ‏שרשרת שנייה שנמדדה: ‏`Wait → Photos.Snapshot → SpeechPlaySound` (org-1,
	 * דף "מצלמה") — שם ה-`Wait` היא **ראשונה** בשרשרת.
	 *
	 * ‏`cancellable=1` ב-44 מ-44 — **לעולם לא נמדד `0`**, ולא נמדד מה מבטל
	 * את ההמתנה. הערך נקרא, נמסר, ו**אינו נצרך**. ראו `CommandPause`.
	 */
	'CommandExecution.Wait': (params) => ({
		pauseMs: parseWaitTimeMs(paramToText(params.waittime)),
		cancellable: paramToBool(params.cancellable) ?? false
	}),

	/**
	 * **158 הפעלות ברמת-הדף** (‏3,342 בקורפוס) — הפקודה שמפעילה את
	 * ‏2,025 תאי ה-`AutoContent`. אין לה פרמטרים: מה שמבדיל בין הפעלה להפעלה
	 * הוא `ctx.autoContentItem`, הפריט שבמשבצת.
	 *
	 * 🔑 מכניסה **פריט עם דקדוק**, לא מחרוזת: ‏`Number`/`Person` מגיעים
	 * מ-`WordListItem.grammar`, ו-`PartOfSpeech` (‏12,259 מופעים) נכנס ל-`pos`.
	 * 🛑 **אינה נוגעת בעימוד.** תא-הניווט ("עוד"/"חזור") מסונתז ומטופל
	 * ב-`GridBoard`, ואינו עובר דרך כאן כלל.
	 */
	'AutoContent.Activate': (_params, ctx) => {
		const item = ctx.autoContentItem;
		// תא-`AutoContent` שאינו רשימת-מילים (‏`Prediction`, ‏`Photos`) מגיע
		// לכאן בלי פריט. לא שגיאה, ולא שתיקה — נספר כדי שיהיה נראה בדוח.
		if (!item) {
			ctx.reportUnimplemented(AUTOCONTENT_WITHOUT_ITEM);
			return;
		}
		const text = richTextToPlainText(item.text);
		// הסמל יושב על ה-`<s>` כשאין `<Image>` על הפריט עצמו.
		const image = item.image ?? firstImageOf(item.text);
		if (!text && !image) return;

		const out: OutputItem = { text, ...item.grammar };
		if (!out.pos && item.partOfSpeech) out.pos = item.partOfSpeech;
		if (image) out.image = image;
		ctx.output.insert(out);
	},

	/**
	 * ‏1,386 הפעלות בקורפוס (‏12 בלוחות-הדגימה, מהן **6 ב-`org-3`**).
	 *
	 * 🔑 **הנשא הוא הכתובית של התא, ואין לה פרמטר** — ‏0 פרמטרים ב-1,386
	 * מ-1,386. לכן היא הפקודה הראשונה שנזקקת ל-`ctx.cell`.
	 *
	 * 🛑 **תא בלי כתובית הוא המקרה השכיח, לא הקצה:** ‏581 מ-1,386 (‏41.9%),
	 * ו-**6 מ-6 ב-`org-3`** — שם כל השש יושבות בדף `.תבנית` על תאים שאין
	 * להם `CaptionAndImage` כלל. אין מה להכניס, ולכן אין פעולה; זה **לא**
	 * מדווח כלא-ממומש, כי הפקודה כן ממומשת והיא פשוט ריקה.
	 *
	 * ‏`insert` ולא `appendToStream`: היא מכניסה **מילה** ("book", "different"),
	 * ולא נדבקת למילה שלפניה כמו פיסוק. והראיה שאין כאן שאלת-פיסוק בכלל —
	 * היא **ראשונה בשרשרת ב-1,386 מ-1,386**, ולבדה ב-1,361 (‏98.2%).
	 * לעולם לא נמדדה פקודה שקודמת לה.
	 */
	'Action.InsertCellText': (_params, ctx) => {
		const text = ctx.cell?.caption?.trim();
		if (!text) return;
		const item: OutputItem = { text };
		// ✅ **עודכן — פס-הפלט אכן מציג סמל-מעל-מילה** (GRID-GAPS §3: צילום `eng-02`,
		// סמל חצאית וסמל שמלה מעל השורה). האזהרה שהייתה כאן — "האם Grid מציג אותו
		// בחלל-העבודה לא נמדד" — **נמשכת**, וזו הראיה ששללה אותה.
		// 🛑 מה שנשאר לא-מאומת צר יותר: שהסמל שנכנס לפריט הוא זה של **התא**
		// (`CaptionAndImage/Image`) ולא אחר. הנזק אם זו טעות נשאר סמל עודף בשבב.
		if (ctx.cell?.image) item.image = ctx.cell.image;
		ctx.output.insert(item);
	},

	/**
	 * ‏842 הפעלות בקורפוס (‏12 בלוחות-הדגימה, מהן **5 ב-`org-3`** — כולן בדף
	 * "פיל פילון", שיר מוקלט שורה-שורה).
	 *
	 * 🔑 **הקלטה, לא TTS.** ‏`filedata` ב-749 מ-842, וערכו `.mp3` ב-748 מ-749
	 * — כלומר **סיומת**, לא תוכן ולא שם-קובץ. הנתיב המלא בארכיון חושב כבר
	 * ב-`assignEmbeddedPaths` ויושב ב-`embeddedPath`; חמשת נתיבי `org-3`
	 * שהכלל חזה (`Grids/פיל פילון/4-0-0-filedata.mp3` וכו') נמצאו בארכיון
	 * **חמישה מתוך חמישה**.
	 *
	 * 🛑 **‏93 מ-842 מגיעות בלי `filedata` כלל.** אין קובץ, אין מה לנגן, ואין
	 * שגיאה — יוצאים בשקט. מי שהיה מדווח כאן `reportUnimplemented` היה מזהם
	 * את דוח הכיסוי בפקודה שדווקא כן ממומשת.
	 *
	 * ⚠️ **‏`wait` נקרא ואינו נצרך — לא-מאומת מול Grid.** ‏`0` ×597 · `1` ×242.
	 * הפקודה אחרונה או לבדה ב-822 מ-842 (‏97.6%), ולכן כמעט תמיד אין לה מה
	 * להשהות; ומה Grid ממתין לו בדיוק לא נמדד. החזרת `CommandPause` הייתה
	 * דורשת את **אורך הקובץ**, שאינו ידוע לפני שהוא נטען. בדיוק כמו
	 * `cancellable` — נמדד, מתועד, לא מומצא.
	 */
	SpeechPlaySound: (params, ctx) => {
		const value = params.filedata;
		// ‏`{ data }` הוא הצורה היחידה שנמדדה; `embeddedPath` נוסף במעבר
		// שאחרי הפרסור, ואינו קיים על `GridSet` שנבנה מ-JSON או ב-fixture.
		const path =
			typeof value === 'object' && value !== null && 'embeddedPath' in value
				? value.embeddedPath
				: undefined;
		if (!path) return;
		ctx.playSound(path);
	},

	/*
	 * ── `Settings.Rest*` — no-op **מתועד**, ‏11,734 הפעלות ────────────────
	 *
	 * 🛑 זו אינה "פקודה שלא הספקנו". ההכרעה מעוגנת בשלוש מדידות, והנימוק
	 * המלא + מה שנשאר לא-מאומת יושבים ב-`gridset-core-design.md` §1.
	 *
	 * בקצרה: אין **שום** פרמטר-משך ב-11,734 המופעים (רק `indicatorenabled`,
	 * ו-`action=Toggle` ב-2,449) — כלומר **מצב**, לא השהיה למשך X. והמצב
	 * שהוא משהה הוא **הפעלה מקרית ממודאליות פסיבית** (dwell, סריקה): ארבעת
	 * המזהים מתחלקים בדיוק לפי שיטת-גישה. ‏`WEB_FEATURES` מוציא את `Dwell`
	 * במפורש, אין ב-`src/` dwell ולא לולאת-סריקה, וההפעלה היא `onclick`.
	 * **לחיצה כבר מכוונת — אין כאן מה להשהות.**
	 *
	 * 🛑 ומימוש "אמיתי" היה הרסני: אצלנו הקלט היחיד הוא הלחיצה, ולכן חסימתה
	 * הייתה נועלת את הלוח **בלי דרך חזרה** — גם לא דרך תא-המנוחה עצמו.
	 *
	 * נשארות ברג'יסטרי כדי שלא תיספרנה כלא-ממומשות, בדיוק כמו
	 * `Settings.RequiredFeature`.
	 *
	 * ℹ️ ‏`Settings.RestTouch` נמדד **פעם אחת** בקורפוס ואינו כאן (אינו באף
	 * לוח-ארגון). ‏🛑 ‏`Settings.Restart` (‏8) אינה מהמשפחה למרות התחילית.
	 */

	/** ‏2,781 בקורפוס · **32 ב-`org-3`**, כולן על תא "מנוחה" ב-(6,2). */
	'Settings.RestAll': () => {},
	/** ‏3,099 בקורפוס · ‏0 בלוחות-הארגון. */
	'Settings.RestEyeGaze': () => {},
	/** ‏3,092 בקורפוס · ‏0 בלוחות-הארגון. */
	'Settings.RestPointer': () => {},
	/** ‏2,762 בקורפוס · ‏0 בלוחות-הארגון. */
	'Settings.RestSwitch': () => {}
};

/** מזהי הפקודות שיש להן handler. */
export function implementedCommandIds(): CommandId[] {
	return Object.keys(commandRegistry);
}

// ── המריץ ────────────────────────────────────────────────────────────────

/** המתנה אמיתית. מוזרקת כדי שהמריץ ייבדק בלי טיימר אמיתי. */
const realDelay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface ExecuteOptions {
	/** הזרקה לבדיקות; ברירת המחדל היא הרג'יסטרי הגלובלי. */
	registry?: Partial<Record<CommandId, CommandHandler>>;
	/** ההשהיה שמריצה `CommandExecution.Wait`. ברירת מחדל: `setTimeout`. */
	delay?: (ms: number) => Promise<void>;
}

/**
 * מריץ שרשרת-פקודות. ‏handler שמחזיר `'halt'` מפסיק את השרשרת; ‏handler
 * שמחזיר `CommandPause` **משהה את המשך השרשרת** ואז ממשיך.
 *
 * פקודה בלי handler נספרת ב-`ctx.reportUnimplemented` והשרשרת ממשיכה:
 * לעולם לא זורקים, ולעולם לא שותקים.
 *
 * 🔑 נקרא **רק על תא זמין** — `isCellAvailable` הוא השער, לא המריץ.
 *
 * 🛑 **הפונקציה `async`, אבל שרשרת בלי `Wait` רצה סינכרונית לחלוטין.**
 * ב-`async function` כל מה שלפני ה-`await` הראשון מתבצע בקריאה עצמה; ומכיוון
 * שה-`await` היחיד כאן הוא בתוך `if (isCommandPause(...))`, שרשרת שאין בה
 * ‏`CommandExecution.Wait` אינה נוגעת בתור-המיקרו. זה **לא** פרט-מימוש אגבי:
 * הוא מה שמשאיר 30 טסטים סינכרוניים קיימים ירוקים, ומונע השהיית-frame בכל
 * לחיצה על תא. אל להפוך את ה-`for` ל-`for await` ואל להוסיף `await` בראשו.
 */
export async function executeCommandChain(
	commands: readonly CommandInvocation[],
	ctx: RuntimeContext,
	options: ExecuteOptions = {}
): Promise<void> {
	const { registry = commandRegistry, delay = realDelay } = options;

	for (const inv of commands) {
		const handler = registry[inv.id];
		if (!handler) {
			ctx.reportUnimplemented(inv.id);
			continue;
		}
		const result: CommandResult = handler(inv.params, ctx);
		if (result === 'halt') return;
		if (isCommandPause(result) && result.pauseMs > 0) await delay(result.pauseMs);
	}
}

/**
 * מריץ את שרשרת-הפקודות של תא — כולל השרשרת שתא `AutoContent` שואב מהדף.
 *
 * @param item הפריט שהמשבצת מציגה (‏`WordListSlot` מסוג `item`). בלעדיו
 *             `AutoContent.Activate` אינה יודעת מה להכניס.
 */
export function executeCommands(
	cell: Cell,
	ctx: RuntimeContext,
	item?: WordListItem,
	options?: ExecuteOptions
): Promise<void> {
	return executeCommandChain(cellCommands(cell, ctx.page), withCellContext(ctx, cell, item), options);
}
