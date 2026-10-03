import type { GridSet } from './types';
type RecordValue = Record<string, unknown>;
function record(v: unknown): v is RecordValue {
	return !!v && typeof v === 'object' && !Array.isArray(v);
}
const string = (v: unknown) => typeof v === 'string';
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const integer = (v: unknown, min = 0) => Number.isInteger(v) && (v as number) >= min;
const optional = (v: RecordValue, key: string, check: (v: unknown) => boolean) =>
	v[key] === undefined || check(v[key]);
const array = (v: unknown, check: (v: unknown) => boolean) => Array.isArray(v) && v.every(check);
const image = (v: unknown): boolean =>
	record(v) && string(v.library) && string(v.path) && optional(v, 'embeddedPath', string);
function rich(v: unknown): boolean {
	return (
		record(v) &&
		array(
			v.paragraphs,
			(p) =>
				record(p) &&
				array(p.sentences, (s) => record(s) && array(s.runs, string) && optional(s, 'image', image))
		)
	);
}
function word(v: unknown): boolean {
	return (
		record(v) &&
		rich(v.text) &&
		optional(v, 'image', image) &&
		optional(v, 'partOfSpeech', string) &&
		optional(v, 'grammar', (g) => record(g) && Object.values(g).every(string))
	);
}
function param(v: unknown): boolean {
	return (
		string(v) ||
		rich(v) ||
		(record(v) && string(v.data) && optional(v, 'embeddedPath', string)) ||
		array(v, word)
	);
}
const params = (v: unknown) => record(v) && Object.values(v).every(param);
const commands = (v: unknown) => array(v, (c) => record(c) && string(c.id) && params(c.params));
function style(v: unknown): boolean {
	return (
		record(v) &&
		['backColour', 'fontColour', 'borderColour', 'fontName', 'tileColour'].every((k) =>
			string(v[k])
		) &&
		finite(v.fontSize) &&
		finite(v.backgroundShape)
	);
}
function cell(v: unknown): boolean {
	return (
		record(v) &&
		integer(v.x) &&
		integer(v.y) &&
		integer(v.columnSpan, 1) &&
		integer(v.rowSpan, 1) &&
		commands(v.commands) &&
		style(v.style) &&
		['caption', 'contentType', 'contentSubType', 'contentSubSubType', 'visibility'].every((k) =>
			optional(v, k, string)
		) &&
		optional(v, 'image', image) &&
		optional(v, 'scanBlock', finite) &&
		optional(v, 'contentParameters', params)
	);
}
const size = (v: unknown) => ['ExtraSmall', 'Small', 'Large', 'ExtraLarge'].includes(v as string);
function page(v: unknown, name: string): boolean {
	return (
		record(v) &&
		v.name === name &&
		integer(v.columns, 1) &&
		integer(v.rows, 1) &&
		array(v.columnWidths, (s) => s === null || size(s)) &&
		(v.columnWidths as unknown[]).length === v.columns &&
		array(v.rowHeights, (s) => s === null || size(s)) &&
		(v.rowHeights as unknown[]).length === v.rows &&
		array(v.cells, cell) &&
		array(v.wordList, word) &&
		string(v.predictionSource) &&
		record(v.autoContentCommands) &&
		Object.values(v.autoContentCommands).every(commands) &&
		record(v.background) &&
		optional(v.background, 'colour', string) &&
		optional(v.background, 'image', image) &&
		optional(v, 'guid', string)
	);
}
/** Validate the JSON fields consumed by renderers/commands, without adding command support. */
export function validateJsonGridSet(v: unknown): asserts v is GridSet {
	if (
		!record(v) ||
		!string(v.startGrid) ||
		!v.startGrid ||
		!record(v.pages) ||
		!Object.hasOwn(v.pages, v.startGrid as string) ||
		!Object.entries(v.pages).every(([n, p]) => page(p, n)) ||
		!record(v.styles) ||
		!string(v.language) ||
		!array(v.symbolSearchKeys, string) ||
		!optional(v, 'theme', string) ||
		!optional(v, 'cellSpacing', size) ||
		!optional(v, 'textAtTop', (x) => typeof x === 'boolean') ||
		!optional(
			v,
			'media',
			(x) => x instanceof Map && [...x].every(([k, b]) => string(k) && b instanceof Uint8Array)
		)
	)
		throw new Error('invalid-json');
}
