/**
 * ‏`.gridset` → מודל `GridSet`. טעינה **Runtime בדפדפן**: fflate ל-ZIP,
 * DOMParser ל-XML. 🛑 אין שלב preprocess ואין Node-only APIs — מורה גוררת
 * קובץ אל האפליקציה והוא נקרא שם. ראו docs/plans/gridset-core-design.md §6.
 *
 * מבנה ה-ZIP:
 * ```
 * Settings0/settings.xml
 * Settings0/Styles/styles.xml
 * Grids/<שם הדף>/grid.xml
 * ```
 *
 * 🔑 **התלות בסגנונות מוזרקת.** הפרסר אינו פותר ירושת-סגנון; הוא מרכיב
 * `CellStyleSource` ומעביר ל-`opts.resolveStyle` (סלייס 3). בלי פותר —
 * `DEFAULT_RESOLVED_STYLE`.
 *
 * מקור האמת לשמות האלמנטים ולשכיחויות שמצוטטות כאן:
 * tzlev-docs-repo/aac-board/grid-reference/derived/gridset-schema.tsv
 * (199 שורות) ו-commands.tsv (353 פקודות).
 */

import { strFromU8, unzipSync } from 'fflate';
import type {
	Cell,
	CellStyleSource,
	CellVisibility,
	CommandInvocation,
	ContentType,
	GridSet,
	Page,
	ParamValue,
	PredictionSource,
	ResolvedStyle,
	SizeName,
	Style,
	StyleResolver,
	WordListItem
} from './types';
import { hasRichTextChildren, normalizeRichText, parseImageRef } from './richText';
import {
	attr,
	childByName,
	childrenByName,
	elementChildren,
	intAttr,
	isNil,
	parseXml,
	rawText,
	textOfChild
} from './xml';

/**
 * ברירת-המחדל כשלא הוזרק פותר-סגנונות.
 *
 * 🔑 הוגדר כאן זמנית עד שסלייס הסגנונות ימוזג, והמיזוג קרה (27.9.2026) —
 * ולכן זה ייצוא-מחדש ולא הגדרה שנייה. **מקור אמת אחד** לערכים חזותיים
 * לא-מאומתים, כפי ש-gridset-core-design.md §5 דורש.
 */
import { DEFAULT_RESOLVED_STYLE } from './visualDefaults';
export { DEFAULT_RESOLVED_STYLE };

export interface ParseGridSetOptions {
	/** פותר ירושת-סגנון (סלייס 3). בלעדיו כל תא מקבל DEFAULT_RESOLVED_STYLE. */
	resolveStyle?: StyleResolver;
}

const PREDICTION_SOURCES: readonly PredictionSource[] = [
	'None',
	'WordList',
	'WordListAndPredictor',
	'LastSuggestedAndWordList'
];

const CONTENT_TYPES: readonly ContentType[] = ['AutoContent', 'Workspace', 'LiveCell'];

const SIZE_NAMES: readonly SizeName[] = ['ExtraSmall', 'Small', 'Large', 'ExtraLarge'];

const VISIBILITIES: readonly CellVisibility[] = ['Hidden', 'Disabled', 'PointerAndTouchOnly'];

const SETTINGS_RE = /(^|\/)settings\.xml$/i;
const STYLES_RE = /(^|\/)styles\.xml$/i;
const GRID_RE = /(^|\/)Grids\/(.+)\/grid\.xml$/i;

// ── נקודת הכניסה ─────────────────────────────────────────────────────────

export async function parseGridSet(
	data: ArrayBuffer | Uint8Array,
	opts: ParseGridSetOptions = {}
): Promise<GridSet> {
	const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
	// unzipSync ולא unzip: הגרסה האסינכרונית של fflate פותחת Worker דרך blob URL.
	// החתימה נשארת async כדי שהמעבר ל-Worker לא ישבור קוראים.
	//
	// ה-filter מונע פרישה של הסמלים המוטמעים (‏emf/png/mp3 — רוב נפח הקובץ).
	// ⚠️ המודל אינו מחזיק blobs, ולכן אין מה לאבד כאן; מי שיצטרך את הקבצים
	// האלה מסיר את ה-filter בשורה אחת.
	const files = unzipSync(bytes, { filter: (file) => /\.xml$/i.test(file.name) });
	// 🔑 מסודר, כדי שריבוי Settings*/ או סדר-ZIP שרירותי לא ישנו את התוצאה
	const paths = Object.keys(files).sort();

	const settingsPath = paths.find((p) => SETTINGS_RE.test(p));
	if (!settingsPath) throw new Error('הקובץ אינו .gridset — אין בו settings.xml');

	const resolve = opts.resolveStyle ?? (() => DEFAULT_RESOLVED_STYLE);

	const stylesPath = paths.find((p) => STYLES_RE.test(p));
	const styles = stylesPath ? parseStyleCatalog(decode(files[stylesPath]), stylesPath) : {};

	const pages: Record<string, Page> = {};
	for (const path of paths) {
		const match = GRID_RE.exec(path);
		if (!match) continue;
		const name = match[2];
		pages[name] = parsePage(name, parseXml(decode(files[path]), path), resolve);
	}

	return {
		...parseSettings(parseXml(decode(files[settingsPath]), settingsPath)),
		pages,
		styles
	};
}

function decode(bytes: Uint8Array | undefined): string {
	return bytes ? strFromU8(bytes) : '';
}

// ── settings.xml ─────────────────────────────────────────────────────────

function parseSettings(root: Element): Omit<GridSet, 'pages' | 'styles'> {
	const appearance = childByName(root, 'Appearance');
	const keys = childByName(childByName(root, 'PictureSearch'), 'PictureSearchKeys');

	const settings: Pick<GridSet, 'startGrid' | 'language' | 'symbolSearchKeys'> & {
		theme?: string;
	} = {
		startGrid: textOfChild(root, 'StartGrid') ?? '',
		language: textOfChild(root, 'Language') ?? '',
		// סדר העדיפות של ספריות הסמלים הוא סדר המסמך — לא לסדר מחדש
		symbolSearchKeys: childrenByName(keys, 'PictureSearchKey')
			.map((el) => (el.textContent ?? '').trim())
			.filter((v) => v !== '')
	};
	const theme = textOfChild(appearance, 'Theme');
	if (theme) settings.theme = theme;
	return settings;
}

// ── styles.xml ───────────────────────────────────────────────────────────

/**
 * קטלוג הסגנונות הגולמי (3,282 סגנונות). ⚠️ **זמני:** סלייס 3 מביא
 * `parseStyles(stylesXml)` ב-`resolveStyle.ts`; במיזוג מוחקים את הפונקציה
 * הזאת ומפנים לשם. עד אז `GridSet.styles` לא היה מתמלא כלל.
 *
 * 🔑 המזהה שאליו תאים מפנים ב-`<BasedOnStyle>` הוא **מאפיין `Key`**, ולא
 * אלמנט `<Name>` (ש-2,587 סגנונות מחזיקים ושהוא מידע אחר). לכן
 * `Style.name = Key`, ואלמנט `<Name>` נשמר כפי שהוא תחת המפתח `Name`.
 */
export function parseStyleCatalog(stylesXml: string, label = 'styles.xml'): Record<string, Style> {
	if (stylesXml.trim() === '') return {};
	const root = parseXml(stylesXml, label);
	const out: Record<string, Style> = {};
	for (const el of childrenByName(childByName(root, 'Styles'), 'Style')) {
		const key = attr(el, 'Key');
		if (key === undefined) continue;
		out[key] = { name: key, ...readStyleProps(el) };
	}
	return out;
}

/**
 * שמות ה-XML של תכונות-סגנון → שמות השדות בחוזה.
 *
 * 🛑 `BasedOnStyle` **אינו כאן במכוון.** הוא קיים רק על `<Style>` של תא
 * (252,974 מופעים) ולא על סגנון-קטלוג — `/StyleData/Styles/Style` אינו מונה
 * אותו כלל בסכמה. הוא נקרא בנפרד ב-readCellStyleSource, ומדולג כאן כדי
 * שלא ייפול לענף "טרם מופה" וייכנס ל-overrides. ראו design §5.
 */
const STYLE_TEXT_FIELDS: Record<string, keyof Style & string> = {
	BackColour: 'backColour',
	FontColour: 'fontColour',
	BorderColour: 'borderColour',
	FontName: 'fontName',
	TileColour: 'tileColour'
};
const STYLE_NUMERIC_FIELDS: Record<string, keyof Style & string> = {
	FontSize: 'fontSize',
	BackgroundShape: 'backgroundShape'
};

/**
 * קורא תכונות-סגנון מ-`<Style>` (של קטלוג או של תא).
 * אלמנט שטרם מופה נשמר תחת **שמו ב-XML** ולא נזרק — `Style` מצהיר
 * `[k: string]: unknown` בדיוק בשביל זה.
 */
function readStyleProps(el: Element | undefined): Partial<Style> {
	const props: Partial<Style> = {};
	if (!el) return props;
	for (const child of elementChildren(el)) {
		if (child.localName === 'BasedOnStyle') continue;
		const text = (child.textContent ?? '').trim();
		const textField = STYLE_TEXT_FIELDS[child.localName];
		if (textField) {
			props[textField] = text;
			continue;
		}
		const numField = STYLE_NUMERIC_FIELDS[child.localName];
		if (numField) {
			// 🛑 parseFloat ולא parseInt: 132 מ-2,221 הסגנונות נושאים FontSize
			// שברי (18.666666666666668 — המרת pt→px). קיטוע אינו רק אובדן
			// דיוק אלא **התנגשות**: 14.666… היה הופך ל-14 ובלתי-מובחן ממנו.
			// אותו readStyleProps משרת גם <FontSize> ברמת התא (17,325 מופעים).
			const n = Number.parseFloat(text);
			if (!Number.isNaN(n)) props[numField] = n;
			continue;
		}
		props[child.localName] = text;
	}
	return props;
}

// ── grid.xml ─────────────────────────────────────────────────────────────

function parsePage(name: string, root: Element, resolve: StyleResolver): Page {
	// 🛑 מלכודת 3: columns/rows הם **ספירת אלמנטים**, לא מאפיין.
	const columnDefs = childrenByName(childByName(root, 'ColumnDefinitions'), 'ColumnDefinition');
	const rowDefs = childrenByName(childByName(root, 'RowDefinitions'), 'RowDefinition');

	const page: Page = {
		name,
		columns: columnDefs.length,
		rows: rowDefs.length,
		// המידה יושבת על ההגדרה ולא על הדף: Width ב-11,400 מ-58,701 ההגדרות,
		// Height ב-4,575 מ-44,667. חסר = רגיל, ולכן null ולא undefined.
		columnWidths: columnDefs.map((el) => readSizeName(el, 'Width')),
		rowHeights: rowDefs.map((el) => readSizeName(el, 'Height')),
		cells: childrenByName(childByName(root, 'Cells'), 'Cell').map((el) => parseCell(el, resolve)),
		// 🔑 מלכודת 6: המנועים הם של הדף. /Grid/WordList קיים בכל אחד מ-7,057 הדפים.
		wordList: parseWordListItems(childByName(root, 'WordList')),
		predictionSource: readPredictionSource(root),
		// 🔑 מלכודת 7: תא AutoContent שואב את פקודותיו מכאן לפי הסוג שלו.
		autoContentCommands: parseAutoContentCommands(root),
		background: readBackground(root)
	};

	const guid = textOfChild(root, 'GridGuid');
	if (guid) page.guid = guid;

	// 🛑 /Grid/Commands (419 — פקודות דף) ו-/Grid/Cells/Cell/Content/Commands הם
	// שני דברים שונים באותו שם. childByName קורא ילדים ישירים בלבד.
	const pageCommands = childByName(root, 'Commands');
	if (pageCommands) page.commands = parseCommandList(pageCommands);

	const horizontal = textOfChild(root, 'HorizontalAlignment');
	if (horizontal === 'Left' || horizontal === 'Right') page.horizontalAlignment = horizontal;
	const vertical = textOfChild(root, 'VerticalAlignment');
	if (vertical === 'Centre' || vertical === 'Top') page.verticalAlignment = vertical;

	const selfClosing = textOfChild(root, 'SelfClosing');
	if (selfClosing !== undefined) page.selfClosing = selfClosing === '1' || selfClosing === 'true';

	return page;
}

function readSizeName(el: Element, name: 'Width' | 'Height'): SizeName | null {
	const raw = attr(el, name);
	return SIZE_NAMES.find((v) => v === raw) ?? null;
}

function readPredictionSource(root: Element): PredictionSource {
	const raw = textOfChild(root, 'PredictionSource');
	const match = PREDICTION_SOURCES.find((v) => v === raw);
	return match ?? 'None';
}

function readBackground(root: Element): Page['background'] {
	const background: Page['background'] = {};
	const style = textOfChild(root, 'BackgroundStyle');
	if (style === 'Image' || style === 'SolidColor') background.style = style;
	const colour = textOfChild(root, 'BackgroundColour');
	if (colour) background.colour = colour;
	const image = textOfChild(root, 'BackgroundImage');
	if (image) background.image = image;
	return background;
}

function parseAutoContentCommands(root: Element): Record<string, CommandInvocation[]> {
	const out: Record<string, CommandInvocation[]> = {};
	const container = childByName(root, 'AutoContentCommands');
	for (const collection of childrenByName(container, 'AutoContentCommandCollection')) {
		const type = attr(collection, 'AutoContentType');
		if (type === undefined || type === '') continue;
		out[type] = parseCommandList(childByName(collection, 'Commands'));
	}
	return out;
}

// ── תא ───────────────────────────────────────────────────────────────────

function parseCell(el: Element, resolve: StyleResolver): Cell {
	const content = childByName(el, 'Content');

	const cell: Cell = {
		// 🛑 מלכודת 1: X=0 הוא התא **הימני**. נשמר כפי שהוא — ההיפוך ב-CSS
		// (direction: rtl), כי columns-1-x נשבר על ColumnSpan.
		// 🛑 מלכודת 2: מאפיין חסר = 0, ו-span חסר = 1.
		x: intAttr(el, 'X', 0),
		y: intAttr(el, 'Y', 0),
		columnSpan: intAttr(el, 'ColumnSpan', 1),
		rowSpan: intAttr(el, 'RowSpan', 1),
		commands: parseCommandList(childByName(content, 'Commands')),
		style: resolve(readCellStyleSource(content))
	};

	// 🛑 מלכודת 5: <CaptionAndImage nil="true"/> — 30,251 מופעים. תא ריק.
	const captionAndImage = childByName(content, 'CaptionAndImage');
	if (captionAndImage && !isNil(captionAndImage)) {
		// 🛑 כתובית נקראת **בלי קיצוץ**: במקלדת AAC מקש-הרווח הוא תא שכתובתו
		// רווח בודד, וקיצוץ היה הופך אותו ל-'' — מוגדר אך ריק.
		const captionEl = childByName(captionAndImage, 'Caption');
		if (captionEl) cell.caption = rawText(captionEl);
		const image = parseImageRef(textOfChild(captionAndImage, 'Image'));
		if (image) cell.image = image;
	}

	const contentType = textOfChild(content, 'ContentType');
	if (CONTENT_TYPES.some((v) => v === contentType)) cell.contentType = contentType as ContentType;
	const subType = textOfChild(content, 'ContentSubType');
	if (subType) cell.contentSubType = subType;
	const subSubType = textOfChild(content, 'ContentSubSubType');
	if (subSubType) cell.contentSubSubType = subSubType;

	const contentParameters = readContentParameters(content);
	if (contentParameters) cell.contentParameters = contentParameters;

	const visibility = textOfChild(el, 'Visibility');
	if (VISIBILITIES.some((v) => v === visibility)) cell.visibility = visibility as CellVisibility;

	const scanBlock = readScanBlock(el);
	if (scanBlock !== undefined) cell.scanBlock = scanBlock;

	return cell;
}

function readCellStyleSource(content: Element | undefined): CellStyleSource {
	const styleEl = childByName(content, 'Style');
	// ‏BasedOnStyle נקרא במפורש, ולא דרך readStyleProps שמדלג עליו — אחרת הוא
	// היה נשפך ל-overrides ומתחזה לעקיפה מקומית.
	const basedOnStyle = textOfChild(styleEl, 'BasedOnStyle');
	const overrides = readStyleProps(styleEl);
	return basedOnStyle ? { basedOnStyle, overrides } : { overrides };
}

/**
 * ‏`ScanBlock` הוא **מאפיין** של התא (122,298 מופעים). קיים גם אלמנט
 * `<ScanBlocks><ScanBlock>` (212) — נקרא כגיבוי, הראשון שבו.
 * 🛑 נשמר במודל ואינו מרונדר בסבב הזה (design §8).
 */
function readScanBlock(el: Element): number | undefined {
	const raw = attr(el, 'ScanBlock');
	if (raw !== undefined && raw.trim() !== '') {
		const n = Number.parseInt(raw, 10);
		if (!Number.isNaN(n)) return n;
	}
	const nested = childrenByName(childByName(el, 'ScanBlocks'), 'ScanBlock')[0];
	if (!nested) return undefined;
	const n = Number.parseInt((nested.textContent ?? '').trim(), 10);
	return Number.isNaN(n) ? undefined : n;
}

/**
 * ‏`/Grid/Cells/Cell/Content/Parameters` (29 מופעים) — לאלמנט עצמו יש מאפיין
 * `ID` (`Settings.Distance`, `Settings.EyeGazeMonitor`…) ולילדיו `Key`.
 * ‏`Cell.contentParameters` הוא `Record<string, ParamValue>` יחיד, ולכן ה-ID
 * נשמר בו תחת המפתח `ID`. ⚠️ הוחלט בסלייס הזה ומדווח לעדכון החוזה.
 */
function readContentParameters(
	content: Element | undefined
): Record<string, ParamValue> | undefined {
	const el = childByName(content, 'Parameters');
	if (!el) return undefined;
	const params: Record<string, ParamValue> = {};
	const id = attr(el, 'ID');
	if (id !== undefined && id !== '') params.ID = id;
	for (const child of childrenByName(el, 'Parameter')) {
		const key = attr(child, 'Key');
		if (key === undefined) continue;
		const value = parseParameterValue(child);
		if (value !== undefined) params[key] = value;
	}
	return params;
}

// ── פקודות ───────────────────────────────────────────────────────────────

function parseCommandList(commands: Element | undefined): CommandInvocation[] {
	return childrenByName(commands, 'Command').map(parseCommand);
}

function parseCommand(el: Element): CommandInvocation {
	// 🔑 רישיות המפתח נשמרת כפי שהיא. היא **אינה** אחידה בנתונים והיא
	// לכן משמעותית: Action.InsertText נושאת `text`, ואילו Symoji.Action
	// נושאת `Action` ו-ComputerControl.Run נושאת `FileName` (commands.tsv).
	const params: Record<string, ParamValue> = {};
	for (const param of childrenByName(el, 'Parameter')) {
		const key = attr(param, 'Key');
		if (key === undefined) continue;
		const value = parseParameterValue(param);
		if (value !== undefined) params[key] = value;
	}
	return { id: attr(el, 'ID') ?? '', params };
}

/**
 * ערך של פרמטר — ארבעה סוגים, לפי הילד שקיים:
 *
 * | ילד | סוג | מופעים |
 * |---|---|---:|
 * | — | טקסט פשוט | 319,737 |
 * | `<p>`/`<s>`/`<r>`/`<d>` | `RichText` (Action.InsertText `Key="text"`) | 44,380 |
 * | `<data>` | `{ data }` (SpeechPlaySound `Key="filedata"`) | 752 |
 * | `<WordList>` | `WordListItem[]` (Prediction.ChangeWordList) | 5,726 |
 *
 * ⚠️ **צורה שאינה אחת מהארבע — הפרמטר מושמט מהמפתחות**, ולא מקבל `''`.
 * מחרוזת ריקה הייתה אומרת שקר: הצרכן אינו יכול להבחין בה בין "צורה לא
 * נתמכת" ל"ערך ריק". שני המקרים בנתונים:
 * `<CommandCollectionParameterValue>` (195 — שרשרת פקודות מקוננת, אינה
 * נתמכת ב-`ParamValue`) ו-`<gridimageref>` (10). לא הומצא כאן טיפוס חדש.
 */
function parseParameterValue(param: Element): ParamValue | undefined {
	const wordList = childByName(param, 'WordList');
	if (wordList) return parseWordListItems(wordList);

	const data = childByName(param, 'data');
	if (data) return { data: (data.textContent ?? '').trim() };

	if (hasRichTextChildren(param)) return normalizeRichText(param);

	// כל צורה אחרת שמגיעה כאלמנט — מושמטת במקום להשתטח למחרוזת ריקה
	if (elementChildren(param).length > 0) return undefined;

	return plainParamText(param);
}

/**
 * טקסט פשוט. ‏`xml:space="preserve"` (285 מופעים) הוא הסימן ששומרים רווחים
 * כפי שהם — ובלעדיו רווח-עטיפה אינו משמעותי ומקוצץ.
 */
function plainParamText(param: Element): string {
	const text = rawText(param);
	return attr(param, 'space') === 'preserve' ? text : text.trim();
}

// ── רשימת מילים ──────────────────────────────────────────────────────────

function parseWordListItems(wordList: Element | undefined): WordListItem[] {
	return childrenByName(childByName(wordList, 'Items'), 'WordListItem').map(parseWordListItem);
}

function parseWordListItem(el: Element): WordListItem {
	const item: WordListItem = { text: normalizeRichText(childByName(el, 'Text')) };

	const image = parseImageRef(textOfChild(el, 'Image'));
	if (image) item.image = image;

	const partOfSpeech = textOfChild(el, 'PartOfSpeech');
	if (partOfSpeech) item.partOfSpeech = partOfSpeech;

	// ‏Number (412) ו-Person (797). `pos` אינו משוכפל לכאן — הוא partOfSpeech.
	const number = textOfChild(el, 'Number');
	const person = textOfChild(el, 'Person');
	if (number || person) {
		item.grammar = {};
		if (number) item.grammar.number = number;
		if (person) item.grammar.person = person;
	}

	return item;
}
