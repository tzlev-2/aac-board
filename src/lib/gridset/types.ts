/**
 * חוזה המודל של ליבת gridset — הגשר מ-.gridset של Grid 3 לקוד הקלון.
 *
 * מקור: docs/plans/gridset-core-design.md (התכנון), והמפרט הארגוני
 * tzlev-docs-repo/aac-board/board-model.md + grid-reference/derived/.
 *
 * 🛑 זהו קובץ-חוזה. סלייס שצריך לשנות אותו מעדכן קודם את מסמך התכנון,
 *    כי חמישה סלייסים מקבילים נשענים עליו.
 *
 * 🛑 המודל הזה אינו מרחיב את src/lib/types/board.ts ואינו מומר אליו.
 *    שני המודלים חיים זה לצד זה — ראו §0 במסמך התכנון.
 */

// ── טקסט עשיר ────────────────────────────────────────────────────────────
// ב-XML קיימות שלוש צורות: Text/p/s/r (28,078) · Text/s/r (27,927) · Text/r (206).
// הפרסר מנרמל את שלושתן לצורה אחת; מה שחסר נעטף במרומז.
// 🔑 הסמל יושב על המשפט (<s Image=…>), לא על התא.

export interface RichText {
	paragraphs: Paragraph[];
}
export interface Paragraph {
	sentences: Sentence[];
}
export interface Sentence {
	image?: ImageRef;
	runs: string[];
}

/** "[widgit]widgit rebus\h\have.emf" → { library: 'widgit', path: 'widgit rebus\h\have.emf' } */
export interface ImageRef {
	library: string;
	path: string;
}

// ── דקדוק ────────────────────────────────────────────────────────────────
// Action.InsertText נושאת gender/number/person/pos עם ערכים עבריים (gender=זכר),
// ו-WordListItem נושא PartOfSpeech/Number/Person. חוקי הנטייה הם plan.md שלב E
// ואינם בסבב הזה — אבל המודל נושא את השדות מהיום.

export interface Grammar {
	gender?: string;
	number?: 'singular' | 'plural' | string;
	person?: 'first' | 'second' | 'third' | string;
	pos?: string;
}

// ── פקודות ───────────────────────────────────────────────────────────────

export type CommandId = string; // "Jump.To" | "Action.InsertText" | … (353 בקטלוג)

export type ParamValue = string | RichText | { data: string } | WordListItem[];

export interface CommandInvocation {
	id: CommandId;
	params: Record<string, ParamValue>;
}

/** void = המשך לפקודה הבאה · 'halt' = עצור את השרשרת (פקודת-שומר) */
export type CommandResult = void | 'halt';

export type CommandHandler = (
	params: Record<string, ParamValue>,
	ctx: RuntimeContext
) => CommandResult;

// ── תכונות ───────────────────────────────────────────────────────────────
// Settings.RequiredFeature (4,155 הפעלות) עוצרת שרשרת כשהתכונה אינה זמינה.
// הקבוצה מוצהרת במקום אחד — לא נבדקת ad-hoc בכל handler.

export type FeatureId =
	| 'ComputerControl'
	| 'EyeGaze'
	| 'Environment'
	| 'Phone'
	| 'Email'
	| 'Music'
	| 'Camera'
	| (string & {});

// ── סגנון ────────────────────────────────────────────────────────────────
// סדר הפתירה: Default → שרשרת BasedOnStyle → הסגנון הנקוב → עקיפות התא.

export interface Style {
	name: string;
	basedOnStyle?: string;
	backColour?: string; // #RRGGBBAA — 🛑 אלפא בסוף
	fontColour?: string;
	borderColour?: string;
	fontName?: string;
	fontSize?: number;
	backgroundShape?: number; // enum 1..10, הסמנטיקה טרם פוענחה (plan.md שלב C)
	tileGap?: string;
	[k: string]: unknown; // שדות שטרם מופו — נשמרים ולא נזרקים
}

/** סגנון אחרי פתירת שרשרת הירושה. כל שדה סופי. */
export interface ResolvedStyle {
	backColour: string;
	fontColour: string;
	borderColour: string;
	fontName: string;
	fontSize: number;
	backgroundShape: number;
}

/**
 * מה שהפרסר קורא מה-XML של התא לפני פתירת הירושה:
 * שם הסגנון הנקוב (<BasedOnStyle>) + העקיפות המקומיות של התא.
 */
export interface CellStyleSource {
	basedOnStyle?: string;
	overrides: Partial<Style>;
}

/**
 * 🔑 הפרדת-תלות בין הפרסר לפותר-הסגנונות: הפרסר אינו יודע לפתור ירושה,
 * הוא מקבל פותר בהזרקה. כך שני הסלייסים נכתבים במקביל.
 * ברירת-מחדל (בלי פותר) — DEFAULT_RESOLVED_STYLE.
 */
export type StyleResolver = (source: CellStyleSource) => ResolvedStyle;

// ── תא ───────────────────────────────────────────────────────────────────

export type ContentType = 'AutoContent' | 'Workspace' | 'LiveCell';
export type CellVisibility = 'Hidden' | 'Disabled' | 'PointerAndTouchOnly';

export interface Cell {
	/** 🛑 X=0 הוא התא הימני (RTL). מאפיין חסר ב-XML = 0. */
	x: number;
	y: number;
	columnSpan: number; // חסר = 1
	rowSpan: number; // חסר = 1
	caption?: string;
	image?: ImageRef;
	/** שרשרת מסודרת. תא "תיקייה" הוא תא שנושא Jump.To — אין שדה type. */
	commands: CommandInvocation[];
	contentType?: ContentType;
	contentSubType?: string; // WordList | Chat | Prediction | Camera | …
	contentSubSubType?: string;
	contentParameters?: Record<string, ParamValue>;
	visibility?: CellVisibility;
	scanBlock?: number; // נשמר, לא מרונדר בסבב הזה
	style: ResolvedStyle;
}

// ── רשימת מילים ──────────────────────────────────────────────────────────

export interface WordListItem {
	text: RichText;
	image?: ImageRef;
	partOfSpeech?: string;
	grammar?: Grammar;
}

export type PredictionSource =
	| 'None'
	| 'WordList'
	| 'WordListAndPredictor'
	| 'LastSuggestedAndWordList';

// ── דף ───────────────────────────────────────────────────────────────────

export interface Page {
	name: string; // המפתח ב-GridSet.pages, והוא גם יעד Jump.To{grid}
	guid?: string;
	columns: number; // אורך <ColumnDefinitions>, לא מאפיין
	rows: number;
	cells: Cell[]; // רק תאים שנכתבו; השאר ריקים

	/** 🔑 המנוע נגזר מהדף, לא גלובלי. /Grid/WordList — אחד לכל אחד מ-7,057 הדפים. */
	wordList: WordListItem[];
	predictionSource: PredictionSource;

	/**
	 * 🔑 תא AutoContent שואב את שרשרת הפקודות שלו מכאן לפי ה-contentSubType שלו,
	 * ולא מתוך עצמו. המפתח הוא AutoContentType ("Chat.History", "Contacts.Contacts"…).
	 */
	autoContentCommands: Record<string, CommandInvocation[]>;

	/** /Grid/Commands — פקודות ברמת הדף (419 מופעים) */
	commands?: CommandInvocation[];

	background: { style?: 'Image' | 'SolidColor'; colour?: string; image?: string };
	horizontalAlignment?: 'Left' | 'Right';
	verticalAlignment?: 'Centre' | 'Top';
	selfClosing?: boolean;
}

// ── הלוח כולו ────────────────────────────────────────────────────────────

export interface GridSet {
	startGrid: string; // settings.xml <StartGrid>
	language: string; // "he-IL"
	theme?: string;
	symbolSearchKeys: string[]; // ["widgit","sstix#","dbr#he"] — סדר עדיפות
	pages: Record<string, Page>;
	styles: Record<string, Style>; // הגולמיים; הפתירה כבר בתוך Cell.style
}

// ── הקשר-ריצה ────────────────────────────────────────────────────────────
// מה שפקודה יכולה לעשות. כל handler מקבל את זה ותו לא — אין import של stores
// מתוך handler, כדי ש-commands.ts יישאר נבדק בלי DOM.

export interface RuntimeContext {
	readonly gridSet: GridSet;
	readonly page: Page;
	readonly features: ReadonlySet<FeatureId>;

	navigate(pageName: string): void;
	back(): void;
	home(): void;

	output: {
		insert(item: OutputItem): void;
		insertLetter(letter: string): void;
		clear(): void;
		deleteWord(): void;
		deleteLetter(): void;
		readonly items: readonly OutputItem[];
	};

	speak(text?: string, opts?: { auditory?: boolean; wait?: boolean }): void;
	stopSpeaking(): void;

	/** פקודה שאין לה handler — נספרת, לעולם לא זורקת ולא שותקת. */
	reportUnimplemented(id: CommandId): void;
}

/** 🔑 חוצץ-הפלט הוא רשימת פריטים עם דקדוק, לא מחרוזת. */
export interface OutputItem extends Grammar {
	text: string;
	image?: ImageRef;
	showInCellLabel?: boolean;
}
