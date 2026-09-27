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
// 🛑 שני נשאים, ארבע צורות בכל אחד, וההתפלגות הפוכה ביניהם:
//   Command/Parameter ישיר : p/s/r 137,448 · r 9,072 · d/p/s/r 2,125 · s/r 1,516
//   WordListItem/Text      : p/s/r 28,078 · s/r 27,927 · d/p/s/r 2,060 · r 206
// <Text> עוטף קיים רק תחת WordListItem. הפרסר מנרמל את כולן לצורה אחת.
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
// Settings.RequiredFeature (4,155 מופעים) היא הצהרת-דרישה של התא בתחביר של
// פקודה — אחרונה בשרשרת ב-96.6% מהמופעים, ולכן שער *רינדור* ולא עצירת-הרצה.
// ראו gridset-core-design.md §1. הקבוצה מוצהרת במקום אחד.

/**
 * רשימה סגורה שנמדדה מ-116 קובצי .gridset (סך 3,875 מופעים עם פרמטר).
 * 🛑 אין לנחש שמות: EyeGaze / Environment / Phone אינם קיימים בנתונים.
 */
export type FeatureId =
	| 'Dwell' // 3,581 — 92.4%
	| 'SecondScreen' // 77
	| 'ComputerControl' // 65
	| 'EyeGazeAccess' // 59
	| 'TouchAccess' // 27
	| 'PointerAccess' // 23
	| 'SwitchAccess' // 21
	| 'MusicVideo' // 17
	| 'EnvironmentControl' // 2
	| 'ShareCommand' // 1
	| 'WebBrowser' // 1
	| 'Email'; // 1

// ── סגנון ────────────────────────────────────────────────────────────────
// 🛑 תוקן 27.9.2026: סדר הפתירה הוא **שתי רמות**, לא שרשרת —
//    DEFAULT → הסגנון הנקוב (רשומה שטוחה) → עקיפות התא.
//    BasedOnStyle קיים רק על התא (gridset-schema.tsv:96), ולא בתוך
//    StyleData/Styles/Style. ראו gridset-core-design.md §5.

export interface Style {
	/** ⚠️ זהו ה-`Key` (המזהה שאליו `BasedOnStyle` מפנה), לא שם-התצוגה.
	 *  `<Name>` נשמר בנפרד תחת המפתח `Name`, והוא שונה מה-`Key` ב-92.6%
	 *  מהסגנונות (2,396 מ-2,587) — למשל Key="style 18" / Name="Netflix 3". */
	name: string;
	backColour?: string; // #RRGGBBAA — 🛑 אלפא בסוף
	fontColour?: string;
	borderColour?: string;
	fontName?: string;
	/**
	 * 🛑 **אינו רשימה סגורה של 20 שלמים.** נמדד ב-styles.tsv: 26 ערכים שונים,
	 * מהם 6 שברים (18.666… ×75 · 14.666… ×35 · 26.666… ×13 ועוד) — 132 סגנונות.
	 * parseInt לא רק מקטע אלא **מתנגש**: 14.666… הופך ל-14.
	 * הנפוץ ביותר הוא 24 (439/2,221) — כלומר ברירת-המחדל אינה שרירותית.
	 */
	fontSize?: number;
	/** enum. ברמת התא קיים גם **0** (5,984 מופעים); בקטלוג 1–7, 9, 10 — לא 1..10 רצוף. הסמנטיקה טרם פוענחה (plan.md שלב C). */
	backgroundShape?: number;
	/** 🔑 צבע רביעי, נפרד מ-BackColour. ברמת התא 3,356 מופעים — פי 15 מהקטלוג (228). */
	tileColour?: string;
	[k: string]: unknown; // שדות שטרם מופו — נשמרים ולא נזרקים
}

/** סגנון אחרי הפתירה הדו-שלבית. כל שדה סופי. */
export interface ResolvedStyle {
	backColour: string;
	fontColour: string;
	borderColour: string;
	fontName: string;
	fontSize: number;
	backgroundShape: number;
	tileColour: string;
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

/**
 * מידת עמודה/שורה. חסר = רגיל.
 * נמדד: Width מפורש ב-11,400 מ-58,701 הגדרות-עמודה (29.7% מהדפים),
 * Height ב-4,575 מ-44,667. 🔑 בלוחות-הדגימה עצמם: 0 מ-1,963 — הרשתות
 * שלנו אחידות, ואי-האחידות כולה בלוחות המובנים של Grid.
 */
export type SizeName = 'ExtraSmall' | 'Small' | 'Large' | 'ExtraLarge';

// ── דף ───────────────────────────────────────────────────────────────────

export interface Page {
	name: string; // המפתח ב-GridSet.pages, והוא גם יעד Jump.To{grid}
	guid?: string;
	columns: number; // אורך <ColumnDefinitions>, לא מאפיין
	rows: number;
	/** מאפיין Width של כל <ColumnDefinition> לפי הסדר; null = רגיל. */
	columnWidths: (SizeName | null)[];
	/** מאפיין Height של כל <RowDefinition> לפי הסדר; null = רגיל. */
	rowHeights: (SizeName | null)[];
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
	/** `<Appearance><CellSpacing>` — רק ExtraLarge נמדד ל-k; שאר הערכים לא-מאומתים. */
	cellSpacing?: SizeName;
	/** `<Appearance><TextAtTop>1</TextAtTop>` — חסר ⇒ תווית מתחת (נמדד org-1). */
	textAtTop?: boolean;
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
