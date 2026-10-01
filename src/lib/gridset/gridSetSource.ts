import { inflateSync, strFromU8, strToU8 } from 'fflate';
import { parseGridSet, type ParseGridSetOptions } from './parse';
import type { GridSet } from './types';
import { readZipIndex, rebuildZip, type ZipIndex } from './zipArchive';
import { setCellCaption, setCellStyleColour, type CellColourField } from './xmlEdit';

export interface GridSetSource {
	readonly bytes: Uint8Array;
	readonly index: ZipIndex;
	readonly pageEntry: ReadonlyMap<string, string>;
}

export async function openGridSet(
	bytes: Uint8Array,
	opts?: ParseGridSetOptions
): Promise<{ gridSet: GridSet; source: GridSetSource }> {
	const index = readZipIndex(bytes);
	const pageEntry = new Map<string, string>();
	for (const entry of index.entries) {
		const match = /(^|\/)Grids\/(.+)\/grid\.xml$/i.exec(entry.name);
		if (match) pageEntry.set(match[2], entry.name);
	}
	return { gridSet: await parseGridSet(bytes, opts), source: { bytes, index, pageEntry } };
}

export interface CellEdit {
	page: string;
	x: number;
	y: number;
	caption?: string;
	colours?: Partial<Record<CellColourField, string>>;
}

/** פורש רק דפים שנערכו, פעם אחת לדף, ומשאיר את המקור ללא שינוי. */
export function writeGridSet(source: GridSetSource, edits: readonly CellEdit[]): Uint8Array {
	const grouped = new Map<string, CellEdit[]>();
	for (const edit of edits) {
		const name = source.pageEntry.get(edit.page);
		if (!name) throw new Error(`הדף אינו קיים: ${edit.page}`);
		const group = grouped.get(name) ?? [];
		group.push(edit);
		grouped.set(name, group);
	}
	const replacements = new Map<string, Uint8Array>();
	const view = new DataView(source.bytes.buffer, source.bytes.byteOffset, source.bytes.byteLength);
	const entries = new Map(source.index.entries.map((entry) => [entry.name, entry]));
	for (const [name, group] of grouped) {
		const entry = entries.get(name);
		if (!entry) throw new Error(`הרשומה אינה קיימת: ${name}`);
		const dataStart =
			entry.rawStart +
			30 +
			view.getUint16(entry.rawStart + 26, true) +
			view.getUint16(entry.rawStart + 28, true);
		const compressed = source.bytes.subarray(dataStart, dataStart + entry.compressedSize);
		const data = entry.method === 0 ? compressed : inflateSync(compressed);
		const bom = data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf;
		let xml = strFromU8(bom ? data.subarray(3) : data);
		for (const edit of group) {
			if (edit.caption !== undefined) xml = setCellCaption(xml, edit.x, edit.y, edit.caption);
			for (const [field, colour] of Object.entries(edit.colours ?? {})) {
				if (colour !== undefined)
					xml = setCellStyleColour(xml, edit.x, edit.y, field as CellColourField, colour);
			}
		}
		const encoded = strToU8(xml);
		const replacement = new Uint8Array(encoded.length + (bom ? 3 : 0));
		if (bom) replacement.set([0xef, 0xbb, 0xbf]);
		replacement.set(encoded, bom ? 3 : 0);
		replacements.set(name, replacement);
	}
	return rebuildZip(source.bytes, source.index, replacements);
}
