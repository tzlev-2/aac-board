import {
	readPageXml,
	type CellEdit,
	type GridSetSource,
	type PageXmlSource
} from '$lib/gridset/gridSetSource';
import { parsePageXml } from '$lib/gridset/parse';
import { createStyleResolver } from '$lib/gridset/resolveStyle';
import type { Page, Style } from '$lib/gridset/types';
import { applyCellEditXml, type CellColourField } from '$lib/gridset/xmlEdit';

export interface CellAddress {
	page: string;
	x: number;
	y: number;
}
export const COLOUR_FIELDS: readonly CellColourField[] = [
	'BackColour',
	'BorderColour',
	'TileColour',
	'FontColour'
];
export const COLOUR_PROPERTIES = {
	BackColour: 'backColour',
	BorderColour: 'borderColour',
	TileColour: 'tileColour',
	FontColour: 'fontColour'
} as const;
export interface GridSetEditSession {
	preview(page: string, edits: readonly CellEdit[]): Page;
}

export function validateCellEdit(edit: CellEdit): void {
	if (
		!edit ||
		typeof edit.page !== 'string' ||
		!edit.page ||
		!Number.isInteger(edit.x) ||
		!Number.isInteger(edit.y) ||
		edit.x < 0 ||
		edit.y < 0
	)
		throw new Error('invalid-address');
	if (Object.keys(edit).some((k) => !['page', 'x', 'y', 'caption', 'colours'].includes(k)))
		throw new Error('unknown-edit-field');
	if (edit.caption !== undefined) {
		if (typeof edit.caption !== 'string') throw new Error('invalid-caption');
		for (const char of edit.caption) {
			const cp = char.codePointAt(0)!;
			if (
				!(
					cp === 9 ||
					cp === 10 ||
					cp === 13 ||
					(cp >= 0x20 && cp <= 0xd7ff) ||
					(cp >= 0xe000 && cp <= 0xfffd) ||
					(cp >= 0x10000 && cp <= 0x10ffff)
				)
			)
				throw new Error('invalid-caption');
		}
	}
	if (edit.colours !== undefined) {
		if (!edit.colours || typeof edit.colours !== 'object' || Array.isArray(edit.colours))
			throw new Error('invalid-colour');
		for (const [field, value] of Object.entries(edit.colours)) {
			if (!COLOUR_FIELDS.includes(field as CellColourField)) throw new Error('unknown-edit-field');
			if (typeof value !== 'string' || !/^#[0-9a-f]{8}$/i.test(value))
				throw new Error('invalid-colour');
		}
	}
}

export function hasCellPatch(edit: CellEdit): boolean {
	return edit.caption !== undefined || Object.keys(edit.colours ?? {}).length > 0;
}

export function upsertCellEdit(edits: readonly CellEdit[], edit: CellEdit): CellEdit[] {
	validateCellEdit(edit);
	if (!hasCellPatch(edit)) return [...edits];
	const index = edits.findIndex((e) => e.page === edit.page && e.x === edit.x && e.y === edit.y);
	const result = [...edits];
	const previous = index < 0 ? undefined : edits[index];
	const merged: CellEdit = { page: edit.page, x: edit.x, y: edit.y };
	if (edit.caption !== undefined || previous?.caption !== undefined)
		merged.caption = edit.caption ?? previous?.caption;
	if (previous?.colours || edit.colours) merged.colours = { ...previous?.colours, ...edit.colours };
	if (index < 0) result.push(merged);
	else result[index] = merged;
	return result;
}

export function createGridSetEditSession(
	source: GridSetSource,
	styles: Record<string, Style>
): GridSetEditSession {
	const cache = new Map<string, { input: PageXmlSource; page: Page }>();
	const resolve = createStyleResolver(styles);
	return {
		preview(name, edits) {
			let cached = cache.get(name);
			if (!cached) {
				const input = readPageXml(source, name);
				cached = { input, page: parsePageXml(name, input.xml, resolve, input.zipDir) };
				cache.set(name, cached);
			}
			let xml = cached.input.xml;
			for (const edit of edits) {
				validateCellEdit(edit);
				if (edit.page !== name || !hasCellPatch(edit)) continue;
				const matches = cached.page.cells.filter((c) => c.x === edit.x && c.y === edit.y);
				if (matches.length !== 1)
					throw new Error(matches.length ? 'ambiguous-cell' : 'missing-cell');
				if (edit.caption !== undefined && matches[0].contentType)
					throw new Error('dynamic-caption');
				xml = applyCellEditXml(xml, edit.x, edit.y, edit);
			}
			return parsePageXml(name, xml, resolve, cached.input.zipDir);
		}
	};
}

export function editedFilename(name: string): string {
	const basename =
		name
			.split(/[\\/]/)
			.at(-1)
			?.replace(/[\u0000-\u001f\u007f]/g, '') ?? '';
	const stem = basename.replace(/\.[^.]*$/, '').replace(/(?:-edited)+$/, '');
	return `${stem || 'gridset'}-edited.gridset`;
}
