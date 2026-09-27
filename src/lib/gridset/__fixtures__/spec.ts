/**
 * מבנה-קלט למחולל ה-fixtures — משקף את ה-XML הגולמי של `.gridset` כפי שהוא
 * נכתב על-ידי Grid (ראו gridset-schema.tsv), ולא את המודל המפורסר
 * (src/lib/gridset/types.ts). זהו קובץ פנימי ל-__fixtures__ בלבד.
 */

// ── טקסט עשיר בפרמטר-פקודה ──────────────────────────────────────────────
// שלוש הצורות שמופיעות בפועל ב-<Parameter> של פקודה (לא ב-Caption, שהוא
// טקסט פשוט): p/s/r (28,078) · s/r בלי p (27,927) · r ישיר (206).

export interface FixtureSentence {
	image?: string;
	runs: string[];
}

export type FixtureRichText =
	| { shape: 'p/s/r'; sentences: FixtureSentence[] }
	| { shape: 's/r'; sentences: FixtureSentence[] }
	| { shape: 'r'; runs: string[] };

export type FixtureParamValue = string | FixtureRichText;

export interface FixtureCommand {
	id: string;
	params?: Record<string, FixtureParamValue>;
}

export interface FixtureStyleOverrides {
	backColour?: string;
	fontColour?: string;
	borderColour?: string;
	fontName?: string;
	fontSize?: number;
	backgroundShape?: number;
	tileColour?: string;
}

export interface FixtureCell {
	/** חסר = לא נכתב מאפיין X/Y כלל (ברירת מחדל בפרסר: 0) — ראו fixture `sparseCoords`. */
	x?: number;
	y?: number;
	columnSpan?: number;
	rowSpan?: number;
	/**
	 * undefined = בלי `<CaptionAndImage>` כלל · null = `<CaptionAndImage nil="true" />`
	 * · string = כיתוב רגיל.
	 */
	caption?: string | null;
	image?: string;
	commands?: FixtureCommand[];
	contentType?: string;
	contentSubType?: string;
	contentSubSubType?: string;
	visibility?: 'Hidden' | 'Disabled' | 'PointerAndTouchOnly';
	/** שם הסגנון הנקוב (`StyleData/Styles/Style@Key`) — רשומה שטוחה, לא שרשרת. */
	basedOnStyle?: string;
	/** עקיפות מקומיות של התא, מעל הסגנון הנקוב. */
	styleOverrides?: FixtureStyleOverrides;
}

/** רשומה שטוחה תחת `StyleData/Styles/Style` — אינה יורשת מסגנון אחר. */
export interface FixtureNamedStyle {
	key: string;
	name?: string;
	backColour?: string;
	fontColour?: string;
	borderColour?: string;
	fontName?: string;
	fontSize?: number;
	backgroundShape?: number;
	tileColour?: string;
}

export interface FixtureWordListItem {
	text: string;
	image?: string;
	partOfSpeech?: string;
}

export interface FixturePage {
	name: string;
	columns: number;
	rows: number;
	cells: FixtureCell[];
	wordList?: FixtureWordListItem[];
	predictionSource?: 'None' | 'WordList' | 'WordListAndPredictor' | 'LastSuggestedAndWordList';
	/** מפתח = AutoContentType (למשל "Chat.History"). */
	autoContentCommands?: Record<string, FixtureCommand[]>;
	commands?: FixtureCommand[];
}

export interface GridsetSpec {
	/** ברירת מחדל: שם הדף הראשון. */
	startGrid?: string;
	language?: string;
	pages: FixturePage[];
	styles?: FixtureNamedStyle[];
}
