/**
 * מבנה-קלט למחולל ה-fixtures — משקף את ה-XML הגולמי של `.gridset` כפי שהוא
 * נכתב על-ידי Grid (ראו gridset-schema.tsv), ולא את המודל המפורסר
 * (src/lib/gridset/types.ts). זהו קובץ פנימי ל-__fixtures__ בלבד.
 */

// ── טקסט עשיר — שני נשאים, ארבע צורות בכל אחד ────────────────────────────
// 🛑 אין להסתמך על ההתפלגות: היא הפוכה בין Command/Parameter ל-WordListItem/Text
// (gridset-core-design.md §4). ארבע הצורות קיימות בשני הנשאים: p/s/r · s/r
// (בלי p) · r ישיר · d/p/s/r (עטיפה שקופה של <d>). <Text> עוטף רק תחת
// WordListItem — תחת Parameter הבנים יושבים ישירות עליו.

export interface FixtureSentence {
	image?: string;
	runs: string[];
}

export type FixtureRichText =
	| { shape: 'p/s/r'; sentences: FixtureSentence[] }
	| { shape: 's/r'; sentences: FixtureSentence[] }
	| { shape: 'r'; runs: string[] }
	| { shape: 'd/p/s/r'; sentences: FixtureSentence[] };

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
	/** string = צורת s/r פשוטה (הנפוצה ביותר בנשא הזה). ל-p/s/r · r · d/p/s/r
	 * העבירו FixtureRichText מפורש. */
	text: string | FixtureRichText;
	image?: string;
	partOfSpeech?: string;
}

export interface FixturePage {
	name: string;
	columns: number;
	rows: number;
	cells: FixtureCell[];
	wordList?: FixtureWordListItem[];
	wordListSorting?: string;
	predictionSource?: 'None' | 'WordList' | 'WordListAndPredictor' | 'LastSuggestedAndWordList';
	/** מפתח = AutoContentType (למשל "Chat.History"). */
	autoContentCommands?: Record<string, FixtureCommand[]>;
	commands?: FixtureCommand[];
	/**
	 * קבצי מדיה **מוטמעים** שיושבים בספריית הדף — מפתח = שם-הקובץ בלבד
	 * (`2-0-0-text-0.jpg`), בלי `Grids/<דף>/`.
	 *
	 * 🛑 השם כאן הוא **השם המלא**, בעוד ה-`<Image>` שבתא נושא רק את **הזנב**
	 * שלו (`-0-text-0.jpg`). זו בדיוק המלכודת שהבדיקות אמורות לתפוס, ולכן
	 * המחולל **אינו** מחשב אחד מהשני.
	 */
	media?: Record<string, Uint8Array>;
}

export interface GridsetSpec {
	/** ברירת מחדל: שם הדף הראשון. */
	startGrid?: string;
	language?: string;
	pages: FixturePage[];
	styles?: FixtureNamedStyle[];
}
