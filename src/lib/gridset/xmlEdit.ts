import type { ImageRef, RichText, Sentence, WordListItem } from './types';

/** עריכה בטווחי מחרוזת בלבד. אין serialization או נרמול XML. */
interface ElementRange {
	name: string;
	start: number;
	openEnd: number;
	closeStart: number;
	end: number;
	children: ElementRange[];
}

function elements(xml: string): ElementRange[] {
	const roots: ElementRange[] = [];
	const stack: ElementRange[] = [];
	// מדלגים על הערות ו-CDATA כדי שטקסט דמוי תג לא יהפוך לאלמנט.
	const tokens =
		/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?[A-Za-z_][\w:.-]*(?:\s+(?:"[^"]*"|'[^']*'|[^'">])*)?\s*\/?\s*>/g;
	for (const match of xml.matchAll(tokens)) {
		const tag = match[0];
		if (tag.startsWith('<!') || tag.startsWith('<?')) continue;
		const name = /^<\/?([\w:.-]+)/.exec(tag)![1];
		if (tag.startsWith('</')) {
			const node = stack.pop();
			if (!node || node.name !== name) throw new Error('XML פגום: סדר תגיות');
			node.closeStart = match.index;
			node.end = match.index + tag.length;
		} else {
			const node: ElementRange = {
				name,
				start: match.index,
				openEnd: match.index + tag.length,
				closeStart: match.index + tag.length,
				end: match.index + tag.length,
				children: []
			};
			(stack.at(-1)?.children ?? roots).push(node);
			if (!/\/\s*>$/.test(tag)) stack.push(node);
		}
	}
	if (stack.length) throw new Error('XML פגום: תגית לא נסגרה');
	return roots;
}

function child(node: ElementRange, name: string): ElementRange | undefined {
	return node.children.find((el) => el.name.split(':').at(-1) === name);
}

function attribute(xml: string, node: ElementRange, name: string): string | undefined {
	const attrs = xml.slice(node.start, node.openEnd);
	for (const m of attrs.matchAll(/\s([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
		if (m[1].split(':').at(-1) === name) return m[2] ?? m[3];
	}
	return undefined;
}

function cellNode(xml: string, x: number, y: number): ElementRange | undefined {
	const grid = elements(xml).find((el) => el.name.split(':').at(-1) === 'Grid');
	const cells = grid && child(grid, 'Cells');
	return cells?.children.find(
		(el) =>
			el.name.split(':').at(-1) === 'Cell' &&
			(Number.parseInt(attribute(xml, el, 'X') ?? '0', 10) || 0) === x &&
			(Number.parseInt(attribute(xml, el, 'Y') ?? '0', 10) || 0) === y
	);
}

export function findCellRange(
	xml: string,
	x: number,
	y: number
): { start: number; end: number } | undefined {
	const node = cellNode(xml, x, y);
	return node && { start: node.start, end: node.end };
}

export function escapeXmlText(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function splice(xml: string, start: number, end: number, text: string): string {
	return xml.slice(0, start) + text + xml.slice(end);
}

function contentOfCell(xml: string, x: number, y: number): ElementRange {
	const cell = cellNode(xml, x, y);
	if (!cell) throw new Error(`התא (${x},${y}) אינו קיים`);
	const content = child(cell, 'Content');
	if (!content) throw new Error(`חסר Content בתא (${x},${y})`);
	return content;
}

/** מפריד לפי השכן המקומי, גם במסמך שסופי השורה בו מעורבים. */
function separator(xml: string, at: number): string {
	return /(?:\r\n|\n|\r)[\t ]*$/.exec(xml.slice(0, at))?.[0] ?? '';
}

function insertBefore(xml: string, before: number, text: string): string {
	return splice(xml, before, before, text + separator(xml, before));
}

function insertFirst(xml: string, parent: ElementRange, text: string): string {
	const first = parent.children[0];
	if (first) return insertBefore(xml, first.start, text);
	const gap = xml.slice(parent.openEnd, parent.closeStart);
	if (!gap.trim() && gap) {
		const closing = separator(xml, parent.closeStart);
		// הסגנון של ילד אח: אחרת נגזרת יחידת ההזחה מהאב והשכן שלו.
		const indent = closing.match(/[\t ]*$/)?.[0] ?? '';
		const openingIndent = separator(xml, parent.start).match(/[\t ]*$/)?.[0] ?? '';
		const unit =
			indent.startsWith(openingIndent) && indent.length > openingIndent.length
				? indent.slice(openingIndent.length)
				: indent.includes('\t')
					? '\t'
					: '  ';
		return splice(xml, parent.openEnd, parent.closeStart, closing + unit + text + closing);
	}
	return splice(xml, parent.openEnd, parent.openEnd, text);
}

export function setCellCaption(xml: string, x: number, y: number, caption: string): string {
	const content = contentOfCell(xml, x, y);
	const cai = child(content, 'CaptionAndImage');
	const text = escapeXmlText(caption);
	const captionNode = cai && child(cai, 'Caption');
	if (captionNode) {
		if (captionNode.end === captionNode.openEnd)
			return splice(xml, captionNode.start, captionNode.end, `<Caption>${text}</Caption>`);
		return splice(xml, captionNode.openEnd, captionNode.closeStart, text);
	}
	if (cai && attribute(xml, cai, 'nil') !== 'true' && cai.end !== cai.openEnd) {
		return insertFirst(xml, cai, `<Caption>${text}</Caption>`);
	}
	const style = child(content, 'Style');
	const neighbour = cai ?? style;
	const outerSeparator = neighbour ? separator(xml, neighbour.start) : '';
	const styleChildSeparator = style?.children[0] ? separator(xml, style.children[0].start) : '';
	const unit =
		styleChildSeparator && outerSeparator
			? styleChildSeparator
					.slice(styleChildSeparator.match(/\r\n|\n|\r/)![0].length)
					.slice(outerSeparator.match(/[\t ]*$/)![0].length)
			: '';
	const innerSeparator = outerSeparator ? outerSeparator + unit : '';
	const replacement = `<CaptionAndImage>${innerSeparator}<Caption>${text}</Caption>${outerSeparator}</CaptionAndImage>`;
	if (cai) return splice(xml, cai.start, cai.end, replacement);
	if (!style) throw new Error(`חסר Style בתא (${x},${y})`);
	return insertBefore(xml, style.start, replacement);
}

export type CellColourField = 'BackColour' | 'BorderColour' | 'TileColour' | 'FontColour';
const styleOrder = [
	'BasedOnStyle',
	'BackColour',
	'TileColour',
	'BorderColour',
	'FontColour',
	'FontName',
	'FontSize',
	'BackgroundShape'
];

export function setCellStyleColour(
	xml: string,
	x: number,
	y: number,
	field: CellColourField,
	colour: string
): string {
	if (!['BackColour', 'BorderColour', 'TileColour', 'FontColour'].includes(field))
		throw new Error(`שדה צבע לא נתמך: ${field}`);
	const content = contentOfCell(xml, x, y);
	const style = child(content, 'Style');
	if (!style) throw new Error(`חסר Style בתא (${x},${y})`);
	const existing = child(style, field);
	const text = escapeXmlText(colour);
	const element = `<${field}>${text}</${field}>`;
	if (existing) {
		return existing.end === existing.openEnd
			? splice(xml, existing.start, existing.end, element)
			: splice(xml, existing.openEnd, existing.closeStart, text);
	}
	if (style.end === style.openEnd)
		return splice(xml, style.start, style.end, `<Style>${element}</Style>`);
	const next = style.children.find((el) => styleOrder.indexOf(el.name) > styleOrder.indexOf(field));
	if (next) return insertBefore(xml, next.start, element);
	const last = style.children.at(-1);
	if (last) return splice(xml, last.end, last.end, separator(xml, last.start) + element);
	return insertFirst(xml, style, element);
}

/** Shared sparse patch for preview and archive output. */
export function applyCellEditXml(
	xml: string,
	x: number,
	y: number,
	patch: { caption?: string; colours?: Partial<Record<CellColourField, string>> }
): string {
	if (patch.caption !== undefined) xml = setCellCaption(xml, x, y, patch.caption);
	for (const [field, colour] of Object.entries(patch.colours ?? {})) {
		if (colour !== undefined) xml = setCellStyleColour(xml, x, y, field as CellColourField, colour);
	}
	return xml;
}

export type WordListArm = 'add' | 'delete';

export type WordListEdit =
	| { page: string; index: number; op: 'replace'; item: WordListItem }
	| { page: string; index: number; op: 'remove' };

function formatImageRef(image: ImageRef): string {
	return image.library ? `[${image.library}]${image.path}` : image.path;
}

function escapeXmlAttr(text: string): string {
	return escapeXmlText(text).replaceAll('"', '&quot;');
}

function serializeSentence(sentence: Sentence): string {
	const image = sentence.image ? ` Image="${escapeXmlAttr(formatImageRef(sentence.image))}"` : '';
	const runs = sentence.runs.map((run) => `<r>${escapeXmlText(run)}</r>`).join('');
	return `<s${image}>${runs}</s>`;
}

function serializeRichText(text: RichText): string {
	return text.paragraphs
		.map((paragraph) => `<p>${paragraph.sentences.map(serializeSentence).join('')}</p>`)
		.join('');
}

/** Compact node for the touched item only. Neighbours keep their original bytes. */
export function serializeWordListItem(item: WordListItem): string {
	let xml = `<WordListItem><Text>${serializeRichText(item.text)}</Text>`;
	if (item.image) xml += `<Image>${escapeXmlText(formatImageRef(item.image))}</Image>`;
	if (item.partOfSpeech) xml += `<PartOfSpeech>${escapeXmlText(item.partOfSpeech)}</PartOfSpeech>`;
	if (item.grammar?.number) xml += `<Number>${escapeXmlText(item.grammar.number)}</Number>`;
	if (item.grammar?.person) xml += `<Person>${escapeXmlText(item.grammar.person)}</Person>`;
	return `${xml}</WordListItem>`;
}

function pageWordListItems(xml: string): ElementRange[] {
	const grid = elements(xml).find((el) => el.name.split(':').at(-1) === 'Grid');
	const wordList = grid && child(grid, 'WordList');
	const items = wordList && child(wordList, 'Items');
	return items?.children.filter((el) => el.name.split(':').at(-1) === 'WordListItem') ?? [];
}

export function findWordListItemRange(
	xml: string,
	index: number
): { start: number; end: number } | undefined {
	const node = pageWordListItems(xml)[index];
	return node && { start: node.start, end: node.end };
}

export function applyWordListEditXml(
	xml: string,
	edit: { index: number; op: 'replace'; item: WordListItem } | { index: number; op: 'remove' }
): string {
	const nodes = pageWordListItems(xml);
	const node = nodes[edit.index];
	if (!node) throw new Error(`missing WordList item ${edit.index}`);
	if (edit.op === 'replace')
		return splice(xml, node.start, node.end, serializeWordListItem(edit.item));
	const next = nodes[edit.index + 1];
	if (next) return splice(xml, node.start, next.start, '');
	const previous = nodes[edit.index - 1];
	if (previous) return splice(xml, previous.end, node.end, '');
	return splice(xml, node.start, node.end, '');
}
