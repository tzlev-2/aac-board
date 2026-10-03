/**
 * מחולל `.gridset` סינתטי — ZIP בזיכרון (fflate) שנבנה מתוך `GridsetSpec`,
 * לפי המבנה האמפירי ב-gridset-schema.tsv. אין קובץ `.gridset` אמיתי על
 * המכונה; זהו התחליף היחיד לבדיקת הפרסר (סלייס 2).
 */

import { zipSync, strToU8 } from 'fflate';
import type {
	GridsetSpec,
	FixturePage,
	FixtureCell,
	FixtureCommand,
	FixtureParamValue,
	FixtureRichText,
	FixtureNamedStyle,
	FixtureWordListItem,
	FixtureSentence
} from './spec';

function escapeXml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
	return escapeXml(value).replace(/"/g, '&quot;');
}

// כל שלושת שורשי ה-XML האמיתיים מכריזים על ה-namespace הזה (אומת מול
// org-1.gridset). `xsi:nil` (fixture `nilCaption`) דורש הכרזה על אלמנט-אב,
// אחרת ה-parser זורק על prefix לא-מוכרז.
const XSI_XMLNS = 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';

function sentenceXml(sentence: FixtureSentence): string {
	const attrs = sentence.image ? ` Image="${escapeAttr(sentence.image)}"` : '';
	const runs = sentence.runs.map((r) => `<r>${escapeXml(r)}</r>`).join('');
	return `<s${attrs}>${runs}</s>`;
}

/** ארבע הצורות המשותפות לשני הנשאים (Parameter ישיר, ו-WordListItem/Text
 * שעוטף את זה ב-<Text>). `d/p/s/r` הוא `<d>` שקוף סביב צורת p/s/r. */
function richTextXml(value: FixtureRichText): string {
	if (value.shape === 'p/s/r') {
		return `<p>${value.sentences.map(sentenceXml).join('')}</p>`;
	}
	if (value.shape === 's/r') {
		return value.sentences.map(sentenceXml).join('');
	}
	if (value.shape === 'r') {
		return value.runs.map((r) => `<r>${escapeXml(r)}</r>`).join('');
	}
	// shape === 'd/p/s/r'
	return `<d><p>${value.sentences.map(sentenceXml).join('')}</p></d>`;
}

function paramValueXml(value: FixtureParamValue): string {
	if (typeof value === 'string') return escapeXml(value);
	return richTextXml(value);
}

function commandXml(command: FixtureCommand): string {
	const entries = Object.entries(command.params ?? {});
	if (entries.length === 0) return `<Command ID="${escapeAttr(command.id)}" />`;
	const params = entries
		.map(
			([key, value]) => `<Parameter Key="${escapeAttr(key)}">${paramValueXml(value)}</Parameter>`
		)
		.join('');
	return `<Command ID="${escapeAttr(command.id)}">${params}</Command>`;
}

function cellXml(cell: FixtureCell): string {
	const attrs: string[] = [];
	if (cell.x !== undefined) attrs.push(`X="${cell.x}"`);
	if (cell.y !== undefined) attrs.push(`Y="${cell.y}"`);
	if (cell.columnSpan !== undefined) attrs.push(`ColumnSpan="${cell.columnSpan}"`);
	if (cell.rowSpan !== undefined) attrs.push(`RowSpan="${cell.rowSpan}"`);

	// 🛑 סדר-הבנים אומת מול org-1.gridset (b005.gridset למקרה עם Commands+ContentType
	// יחד): ContentType → ContentSubType → ContentSubSubType → Commands →
	// CaptionAndImage → Style. לא הסדר "האינטואיטיבי".
	const content: string[] = [];

	if (cell.contentType) content.push(`<ContentType>${escapeXml(cell.contentType)}</ContentType>`);
	if (cell.contentSubType)
		content.push(`<ContentSubType>${escapeXml(cell.contentSubType)}</ContentSubType>`);
	if (cell.contentSubSubType)
		content.push(`<ContentSubSubType>${escapeXml(cell.contentSubSubType)}</ContentSubSubType>`);

	if (cell.commands?.length) {
		content.push(`<Commands>${cell.commands.map(commandXml).join('')}</Commands>`);
	}

	if (cell.caption === null) {
		// 🛑 xsi:nil, לא nil גולמי — כך זה נכתב בפועל (org-1.gridset), ודורש
		// את הכרזת ה-namespace על <Grid> (XSI_XMLNS).
		content.push('<CaptionAndImage xsi:nil="true" />');
	} else if (cell.caption !== undefined || cell.image !== undefined) {
		const inner = [
			cell.caption !== undefined ? `<Caption>${escapeXml(cell.caption)}</Caption>` : '',
			cell.image !== undefined ? `<Image>${escapeXml(cell.image)}</Image>` : ''
		].join('');
		content.push(`<CaptionAndImage>${inner}</CaptionAndImage>`);
	}

	if (cell.basedOnStyle !== undefined || cell.styleOverrides) {
		const style: string[] = [];
		if (cell.basedOnStyle !== undefined)
			style.push(`<BasedOnStyle>${escapeXml(cell.basedOnStyle)}</BasedOnStyle>`);
		const o = cell.styleOverrides ?? {};
		if (o.backColour) style.push(`<BackColour>${o.backColour}</BackColour>`);
		if (o.borderColour) style.push(`<BorderColour>${o.borderColour}</BorderColour>`);
		if (o.fontColour) style.push(`<FontColour>${o.fontColour}</FontColour>`);
		if (o.fontName) style.push(`<FontName>${escapeXml(o.fontName)}</FontName>`);
		if (o.fontSize !== undefined) style.push(`<FontSize>${o.fontSize}</FontSize>`);
		if (o.backgroundShape !== undefined)
			style.push(`<BackgroundShape>${o.backgroundShape}</BackgroundShape>`);
		if (o.tileColour) style.push(`<TileColour>${o.tileColour}</TileColour>`);
		content.push(`<Style>${style.join('')}</Style>`);
	}

	// 🛑 Visibility הוא אח של Content, ולפניו — לא אחריו (אומת מול b005.gridset).
	const siblings: string[] = [];
	if (cell.visibility) siblings.push(`<Visibility>${cell.visibility}</Visibility>`);
	siblings.push(`<Content>${content.join('')}</Content>`);

	const attrString = attrs.length ? ` ${attrs.join(' ')}` : '';
	return `<Cell${attrString}>${siblings.join('')}</Cell>`;
}

function wordListItemXml(item: FixtureWordListItem): string {
	// 🛑 <Text> עוטף רק כאן — תחת Parameter הבנים יושבים ישירות עליו (§4).
	const textInner =
		typeof item.text === 'string'
			? `<s><r>${escapeXml(item.text)}</r></s>`
			: richTextXml(item.text);
	const parts = [`<Text>${textInner}</Text>`];
	if (item.image) parts.push(`<Image>${escapeXml(item.image)}</Image>`);
	if (item.partOfSpeech) parts.push(`<PartOfSpeech>${escapeXml(item.partOfSpeech)}</PartOfSpeech>`);
	return `<WordListItem>${parts.join('')}</WordListItem>`;
}

// 🛑 סדר-הבנים של <Grid> אומת מול org-1.gridset + b001/b033.gridset (bundled):
// [PredictionSource?] → ColumnDefinitions → RowDefinitions → [Commands דף?] →
// AutoContentCommands (תמיד, גם ריק) → Cells → WordList (תמיד, Items ריק אם אין).
function gridXml(page: FixturePage): string {
	const columnDefs = Array.from({ length: page.columns }, () => '<ColumnDefinition />').join('');
	const rowDefs = Array.from({ length: page.rows }, () => '<RowDefinition />').join('');
	const cells = page.cells.map(cellXml).join('');

	const parts: string[] = [];

	if (page.predictionSource) {
		parts.push(`<PredictionSource>${page.predictionSource}</PredictionSource>`);
	}

	parts.push(`<ColumnDefinitions>${columnDefs}</ColumnDefinitions>`);
	parts.push(`<RowDefinitions>${rowDefs}</RowDefinitions>`);

	if (page.commands?.length) {
		parts.push(`<Commands>${page.commands.map(commandXml).join('')}</Commands>`);
	}

	const collections = Object.entries(page.autoContentCommands ?? {})
		.map(
			([type, commands]) =>
				`<AutoContentCommandCollection AutoContentType="${escapeAttr(type)}"><Commands>${commands
					.map(commandXml)
					.join('')}</Commands></AutoContentCommandCollection>`
		)
		.join('');
	parts.push(`<AutoContentCommands>${collections}</AutoContentCommands>`);

	parts.push(`<Cells>${cells}</Cells>`);

	const items = page.wordList?.length
		? `<Items>${page.wordList.map(wordListItemXml).join('')}</Items>`
		: '<Items />';
	const sorting = page.wordListSorting
		? `<Sorting>${escapeXml(page.wordListSorting)}</Sorting>`
		: '';
	parts.push(`<WordList>${items}${sorting}</WordList>`);

	return `<?xml version="1.0" encoding="utf-8"?><Grid ${XSI_XMLNS}>${parts.join('')}</Grid>`;
}

// 🛑 סדר-הבנים אומת מול org-1.gridset: Name → BackColour → BorderColour →
// FontColour → FontName → FontSize → BackgroundShape (TileColour לא נצפה
// בקבצים שנבדקו — הושאר אחרון, ללא עיגון).
function namedStyleXml(style: FixtureNamedStyle): string {
	const parts: string[] = [];
	if (style.name) parts.push(`<Name>${escapeXml(style.name)}</Name>`);
	if (style.backColour) parts.push(`<BackColour>${style.backColour}</BackColour>`);
	if (style.borderColour) parts.push(`<BorderColour>${style.borderColour}</BorderColour>`);
	if (style.fontColour) parts.push(`<FontColour>${style.fontColour}</FontColour>`);
	if (style.fontName) parts.push(`<FontName>${escapeXml(style.fontName)}</FontName>`);
	if (style.fontSize !== undefined) parts.push(`<FontSize>${style.fontSize}</FontSize>`);
	if (style.backgroundShape !== undefined)
		parts.push(`<BackgroundShape>${style.backgroundShape}</BackgroundShape>`);
	if (style.tileColour) parts.push(`<TileColour>${style.tileColour}</TileColour>`);
	return `<Style Key="${escapeAttr(style.key)}">${parts.join('')}</Style>`;
}

function stylesXml(styles: FixtureNamedStyle[]): string {
	return `<?xml version="1.0" encoding="utf-8"?><StyleData ${XSI_XMLNS}><Styles>${styles
		.map(namedStyleXml)
		.join('')}</Styles></StyleData>`;
}

function settingsXml(spec: GridsetSpec): string {
	const startGrid = spec.startGrid ?? spec.pages[0].name;
	const language = spec.language ?? 'he-IL';
	return `<?xml version="1.0" encoding="utf-8"?><GridSetSettings ${XSI_XMLNS}><StartGrid>${escapeXml(
		startGrid
	)}</StartGrid><Language>${escapeXml(language)}</Language></GridSetSettings>`;
}

/** בונה `.gridset` סינתטי כ-ZIP בזיכרון, לפי המבנה: Settings0/settings.xml ·
 * Settings0/Styles/styles.xml · Grids/\<שם הדף\>/grid.xml */
export function buildGridset(spec: GridsetSpec): Uint8Array {
	const files: Record<string, Uint8Array> = {
		'Settings0/settings.xml': strToU8(settingsXml(spec)),
		'Settings0/Styles/styles.xml': strToU8(stylesXml(spec.styles ?? []))
	};
	for (const page of spec.pages) {
		files[`Grids/${page.name}/grid.xml`] = strToU8(gridXml(page));
		// מדיה מוטמעת יושבת **לצד** ה-grid.xml, באותה ספרייה — כך זה בקובץ
		// האמיתי (`Grids/לקרוא/2-2-0-text-0.jpeg`), ועל זה נשען שחזור הנתיב.
		for (const [name, bytes] of Object.entries(page.media ?? {})) {
			files[`Grids/${page.name}/${name}`] = bytes;
		}
	}
	return zipSync(files);
}

export type { GridsetSpec } from './spec';
