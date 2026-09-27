/**
 * שרשרת-הפקודות של gridset — רג'יסטרי, מריץ, ושער-זמינות.
 *
 * 🔑 **רג'יסטרי, לא `switch`.** הקטלוג מונה 353 פקודות, 63 בשימוש בלוחות
 * שנותחו, ותשע מהן מכסות 91.5% מההפעלות. הוספת אחת מ-54 הנותרות חייבת
 * להיות **ערך במפה** — בלי לגעת במריץ.
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
 * הקשר-ריצה שנושא את **הפריט שהתא מציג כרגע**. ‏`AutoContent.Activate` היא
 * פקודה אחת שמשרתת תא אחד לכל פריט — מה שמבדיל בין ההפעלות אינו הפרמטרים
 * (אין לה כאלה) אלא הפריט שבמשבצת.
 *
 * 🔑 **האצלה מפורשת ולא `Object.create`/spread:** ‏`GridRuntime` מחזיק שדות
 * פרטיים (`#history`, ‏`#pageName`), וקריאה למתודה שלו דרך אובייקט-נגזר
 * הייתה זורקת. כאן כל קריאה חוזרת ל-`ctx` המקורי כמקבל.
 */
export function withAutoContentItem(
	ctx: RuntimeContext,
	item: WordListItem | undefined
): RuntimeContext {
	if (!item) return ctx;
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
		autoContentItem: item,
		navigate: (name) => ctx.navigate(name),
		back: () => ctx.back(),
		home: () => ctx.home(),
		speak: (text, opts) => ctx.speak(text, opts),
		stopSpeaking: () => ctx.stopSpeaking(),
		reportUnimplemented: (id) => ctx.reportUnimplemented(id)
	};
}

// ── רג'יסטרי הפקודות ─────────────────────────────────────────────────────
// תשע פקודות = 3,709 מתוך 4,052 ההפעלות בלוחות-הדגימה (91.5%).

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
	}
};

/** מזהי הפקודות שיש להן handler. */
export function implementedCommandIds(): CommandId[] {
	return Object.keys(commandRegistry);
}

// ── המריץ ────────────────────────────────────────────────────────────────

/**
 * מריץ שרשרת-פקודות. handler שמחזיר `'halt'` מפסיק את השרשרת — המנגנון
 * נשאר בחוזה (`CommandResult`) עבור פקודות עתידיות, אף שאף אחת מתשע
 * הפקודות של הסבב אינה משתמשת בו.
 *
 * פקודה בלי handler נספרת ב-`ctx.reportUnimplemented` והשרשרת ממשיכה:
 * לעולם לא זורקים, ולעולם לא שותקים.
 *
 * 🔑 נקרא **רק על תא זמין** — `isCellAvailable` הוא השער, לא המריץ.
 *
 * @param registry הזרקה לבדיקות; ברירת המחדל היא הרג'יסטרי הגלובלי.
 */
export function executeCommandChain(
	commands: readonly CommandInvocation[],
	ctx: RuntimeContext,
	registry: Partial<Record<CommandId, CommandHandler>> = commandRegistry
): void {
	for (const inv of commands) {
		const handler = registry[inv.id];
		if (!handler) {
			ctx.reportUnimplemented(inv.id);
			continue;
		}
		const result: CommandResult = handler(inv.params, ctx);
		if (result === 'halt') return;
	}
}

/**
 * מריץ את שרשרת-הפקודות של תא — כולל השרשרת שתא `AutoContent` שואב מהדף.
 *
 * @param item הפריט שהמשבצת מציגה (‏`WordListSlot` מסוג `item`). בלעדיו
 *             `AutoContent.Activate` אינה יודעת מה להכניס.
 */
export function executeCommands(cell: Cell, ctx: RuntimeContext, item?: WordListItem): void {
	executeCommandChain(cellCommands(cell, ctx.page), withAutoContentItem(ctx, item));
}
