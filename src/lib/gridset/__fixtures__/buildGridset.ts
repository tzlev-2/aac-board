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

function sentenceXml(sentence: FixtureSentence): string {
	const attrs = sentence.image ? ` Image="${escapeAttr(sentence.image)}"` : '';
	const runs = sentence.runs.map((r) => `<r>${escapeXml(r)}</r>`).join('');
	return `<s${attrs}>${runs}</s>`;
}

function paramValueXml(value: FixtureParamValue): string {
	if (typeof value === 'string') return escapeXml(value);

	if (value.shape === 'p/s/r') {
		return `<p>${value.sentences.map(sentenceXml).join('')}</p>`;
	}
	if (value.shape === 's/r') {
		return value.sentences.map(sentenceXml).join('');
	}
	// shape === 'r'
	return value.runs.map((r) => `<r>${escapeXml(r)}</r>`).join('');
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

	const content: string[] = [];

	if (cell.caption === null) {
		content.push('<CaptionAndImage nil="true" />');
	} else if (cell.caption !== undefined || cell.image !== undefined) {
		const inner = [
			cell.caption !== undefined ? `<Caption>${escapeXml(cell.caption)}</Caption>` : '',
			cell.image !== undefined ? `<Image>${escapeXml(cell.image)}</Image>` : ''
		].join('');
		content.push(`<CaptionAndImage>${inner}</CaptionAndImage>`);
	}

	if (cell.commands?.length) {
		content.push(`<Commands>${cell.commands.map(commandXml).join('')}</Commands>`);
	}

	if (cell.contentType) content.push(`<ContentType>${escapeXml(cell.contentType)}</ContentType>`);
	if (cell.contentSubType)
		content.push(`<ContentSubType>${escapeXml(cell.contentSubType)}</ContentSubType>`);
	if (cell.contentSubSubType)
		content.push(`<ContentSubSubType>${escapeXml(cell.contentSubSubType)}</ContentSubSubType>`);

	if (cell.basedOnStyle !== undefined || cell.styleOverrides) {
		const style: string[] = [];
		if (cell.basedOnStyle !== undefined)
			style.push(`<BasedOnStyle>${escapeXml(cell.basedOnStyle)}</BasedOnStyle>`);
		const o = cell.styleOverrides ?? {};
		if (o.backColour) style.push(`<BackColour>${o.backColour}</BackColour>`);
		if (o.fontColour) style.push(`<FontColour>${o.fontColour}</FontColour>`);
		if (o.borderColour) style.push(`<BorderColour>${o.borderColour}</BorderColour>`);
		if (o.fontName) style.push(`<FontName>${escapeXml(o.fontName)}</FontName>`);
		if (o.fontSize !== undefined) style.push(`<FontSize>${o.fontSize}</FontSize>`);
		if (o.backgroundShape !== undefined)
			style.push(`<BackgroundShape>${o.backgroundShape}</BackgroundShape>`);
		if (o.tileColour) style.push(`<TileColour>${o.tileColour}</TileColour>`);
		content.push(`<Style>${style.join('')}</Style>`);
	}

	const siblings = [`<Content>${content.join('')}</Content>`];
	if (cell.visibility) siblings.push(`<Visibility>${cell.visibility}</Visibility>`);

	const attrString = attrs.length ? ` ${attrs.join(' ')}` : '';
	return `<Cell${attrString}>${siblings.join('')}</Cell>`;
}

function wordListItemXml(item: FixtureWordListItem): string {
	const parts = [`<Text><s><r>${escapeXml(item.text)}</r></s></Text>`];
	if (item.image) parts.push(`<Image>${escapeXml(item.image)}</Image>`);
	if (item.partOfSpeech) parts.push(`<PartOfSpeech>${escapeXml(item.partOfSpeech)}</PartOfSpeech>`);
	return `<WordListItem>${parts.join('')}</WordListItem>`;
}

function gridXml(page: FixturePage): string {
	const columnDefs = Array.from({ length: page.columns }, () => '<ColumnDefinition />').join('');
	const rowDefs = Array.from({ length: page.rows }, () => '<RowDefinition />').join('');
	const cells = page.cells.map(cellXml).join('');

	const parts = [
		`<ColumnDefinitions>${columnDefs}</ColumnDefinitions>`,
		`<RowDefinitions>${rowDefs}</RowDefinitions>`,
		`<Cells>${cells}</Cells>`
	];

	if (page.wordList?.length) {
		parts.push(
			`<WordList><Items>${page.wordList.map(wordListItemXml).join('')}</Items></WordList>`
		);
	}
	if (page.predictionSource) {
		parts.push(`<PredictionSource>${page.predictionSource}</PredictionSource>`);
	}
	if (page.autoContentCommands) {
		const collections = Object.entries(page.autoContentCommands)
			.map(
				([type, commands]) =>
					`<AutoContentCommandCollection AutoContentType="${escapeAttr(type)}"><Commands>${commands
						.map(commandXml)
						.join('')}</Commands></AutoContentCommandCollection>`
			)
			.join('');
		parts.push(`<AutoContentCommands>${collections}</AutoContentCommands>`);
	}
	if (page.commands?.length) {
		parts.push(`<Commands>${page.commands.map(commandXml).join('')}</Commands>`);
	}

	return `<?xml version="1.0" encoding="utf-8"?><Grid>${parts.join('')}</Grid>`;
}

function namedStyleXml(style: FixtureNamedStyle): string {
	const parts: string[] = [];
	if (style.name) parts.push(`<Name>${escapeXml(style.name)}</Name>`);
	if (style.backColour) parts.push(`<BackColour>${style.backColour}</BackColour>`);
	if (style.fontColour) parts.push(`<FontColour>${style.fontColour}</FontColour>`);
	if (style.borderColour) parts.push(`<BorderColour>${style.borderColour}</BorderColour>`);
	if (style.fontName) parts.push(`<FontName>${escapeXml(style.fontName)}</FontName>`);
	if (style.fontSize !== undefined) parts.push(`<FontSize>${style.fontSize}</FontSize>`);
	if (style.backgroundShape !== undefined)
		parts.push(`<BackgroundShape>${style.backgroundShape}</BackgroundShape>`);
	if (style.tileColour) parts.push(`<TileColour>${style.tileColour}</TileColour>`);
	return `<Style Key="${escapeAttr(style.key)}">${parts.join('')}</Style>`;
}

function stylesXml(styles: FixtureNamedStyle[]): string {
	return `<?xml version="1.0" encoding="utf-8"?><StyleData><Styles>${styles
		.map(namedStyleXml)
		.join('')}</Styles></StyleData>`;
}

function settingsXml(spec: GridsetSpec): string {
	const startGrid = spec.startGrid ?? spec.pages[0].name;
	const language = spec.language ?? 'he-IL';
	return `<?xml version="1.0" encoding="utf-8"?><GridSetSettings><StartGrid>${escapeXml(
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
	}
	return zipSync(files);
}

export type { GridsetSpec } from './spec';
