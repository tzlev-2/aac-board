/**
 * שרשרת-הפקודות של gridset — רג'יסטרי, מריץ, ושומרים שעוצרים.
 *
 * 🔑 **רג'יסטרי, לא `switch`.** הקטלוג מונה 353 פקודות, 63 בשימוש בלוחות
 * שנותחו, ותשע מהן מכסות 91.5% מההפעלות. הוספת אחת מ-54 הנותרות חייבת
 * להיות **ערך במפה** — בלי לגעת במריץ.
 *
 * 🛑 **הקובץ הזה נבדק בלי DOM.** אין כאן import של stores, של tts, ושל שום
 * דבר שנוגע ב-`window`. כל מה ש-handler יכול לעשות עובר דרך `RuntimeContext`.
 *
 * מקור: docs/plans/gridset-core-design.md §1 · docs/briefs/5-commands-engine.md.
 */

import type {
	Cell,
	CommandHandler,
	CommandId,
	CommandInvocation,
	CommandResult,
	Grammar,
	ImageRef,
	OutputItem,
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
 * דקדוק מפרמטרי `Action.InsertText`. 🔑 הערכים **עבריים** (`gender=זכר`)
 * ונשמרים כפי שהם — חוקי הנטייה הם plan.md שלב E ואינם בסבב הזה, אבל
 * המודל נושא את השדות מהיום.
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

// ── שומרים ───────────────────────────────────────────────────────────────

/**
 * פרדיקט-שומר: `true` = השרשרת ממשיכה, `false` = היא נעצרת.
 *
 * 🔑 מופרד מה-handler בכוונה: `canActivate` צריך **להעריך** את השומר בלי
 * להריץ את השרשרת, כדי שתא חסום ייראה מעומעם ולא ייעלם.
 */
export type GuardPredicate = (params: Record<string, ParamValue>, ctx: RuntimeContext) => boolean;

function requiredFeatureSatisfied(
	params: Record<string, ParamValue>,
	ctx: RuntimeContext
): boolean {
	const feature = paramToText(params.feature).trim();
	// שומר בלי שם-תכונה אינו ניתן להערכה — לא עוצרים על סמך נתון חסר.
	if (!feature) return true;
	return ctx.features.has(feature);
}

/** רג'יסטרי השומרים. שומר חדש = ערך במפה, בדיוק כמו פקודה. */
export const guardRegistry: Partial<Record<CommandId, GuardPredicate>> = {
	'Settings.RequiredFeature': requiredFeatureSatisfied
};

/** האם המזהה הוא פקודת-שומר. */
export function isGuardCommand(id: CommandId): boolean {
	return guardRegistry[id] !== undefined;
}

// ── רג'יסטרי הפקודות ─────────────────────────────────────────────────────
// תשע פקודות = 3,709 מתוך 4,052 ההפעלות בלוחות שלנו (91.5%).

export const commandRegistry: Partial<Record<CommandId, CommandHandler>> = {
	/**
	 * 1,736 הפעלות. `text` הוא טקסט עשיר; `gender`/`number`/`person`/`pos`
	 * נישאים לחוצץ-הפלט, ו-`showincelllabel` נשמר לרינדור.
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
	 * 126 הפעלות. 🛑 **פקודת-שומר** — אינה מאפיין של תא ואינה מתעדת כלום.
	 * תפקידה היחיד הוא לעצור את השרשרת כשהתכונה אינה זמינה.
	 */
	'Settings.RequiredFeature': (params, ctx) => {
		return requiredFeatureSatisfied(params, ctx) ? undefined : 'halt';
	},

	/** 118 הפעלות. בונה מילה אות-אחר-אות בתוך פריט אחד בחוצץ. */
	'Action.Letter': (params, ctx) => {
		const letter = paramToText(params.letter);
		if (!letter) return;
		ctx.output.insertLetter(letter);
	}
};

/** מזהי הפקודות שיש להן handler. */
export function implementedCommandIds(): CommandId[] {
	return Object.keys(commandRegistry);
}

// ── המריץ ────────────────────────────────────────────────────────────────

/**
 * מריץ שרשרת-פקודות. 🛑 **אינו `forEach`** — handler שמחזיר `'halt'`
 * מפסיק את השרשרת, וזה כל המנגנון של `Settings.RequiredFeature`.
 *
 * פקודה בלי handler נספרת ב-`ctx.reportUnimplemented` והשרשרת ממשיכה:
 * לעולם לא זורקים, ולעולם לא שותקים.
 */
export function executeCommandChain(
	commands: readonly CommandInvocation[],
	ctx: RuntimeContext
): void {
	for (const inv of commands) {
		const handler = commandRegistry[inv.id];
		if (!handler) {
			ctx.reportUnimplemented(inv.id);
			continue;
		}
		const result: CommandResult = handler(inv.params, ctx);
		if (result === 'halt') return;
	}
}

/** מריץ את שרשרת-הפקודות של תא. */
export function executeCommands(cell: Cell, ctx: RuntimeContext): void {
	executeCommandChain(cell.commands, ctx);
}

/**
 * האם התא ניתן להפעלה בהקשר הנוכחי.
 *
 * 🔑 בודק **רק את פקודות-השומר שבראש השרשרת** — ברגע שמופיעה פקודה שאינה
 * שומר, הבדיקה נגמרת (אין הרצה, אין תופעות-לוואי). תא שנופל כאן מוצג
 * מעומעם, כמו `Visibility=Disabled`, ו**אינו נעלם**.
 */
export function canActivate(cell: Cell, ctx: RuntimeContext): boolean {
	for (const inv of cell.commands) {
		const guard = guardRegistry[inv.id];
		if (!guard) break;
		if (!guard(inv.params, ctx)) return false;
	}
	return true;
}

/** השומר הראשון שחוסם את התא — למי שרוצה להסביר למשתמש *למה* הוא מעומעם. */
export function blockingGuard(cell: Cell, ctx: RuntimeContext): CommandInvocation | undefined {
	for (const inv of cell.commands) {
		const guard = guardRegistry[inv.id];
		if (!guard) return undefined;
		if (!guard(inv.params, ctx)) return inv;
	}
	return undefined;
}
