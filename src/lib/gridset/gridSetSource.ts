import { inflateSync, strFromU8, strToU8 } from 'fflate';
import { parseGridSet, type ParseGridSetOptions } from './parse';
import type { GridSet } from './types';
import { readZipIndex, rebuildZip, type ZipIndex } from './zipArchive';
import {
	applyCellEditXml,
	applyWordListEditXml,
	type CellColourField,
	type WordListEdit
} from './xmlEdit';
export type { WordListEdit };

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

export interface PageXmlSource {
	readonly entryName: string;
	readonly zipDir: string;
	readonly xml: string;
	readonly hasBom: boolean;
}

export function readPageXml(source: GridSetSource, page: string): PageXmlSource {
	const entryName = source.pageEntry.get(page);
	if (!entryName) throw new Error(`הדף אינו קיים: ${page}`);
	const entry = source.index.entries.find((entry) => entry.name === entryName);
	if (!entry) throw new Error(`הרשומה אינה קיימת: ${entryName}`);
	const view = new DataView(source.bytes.buffer, source.bytes.byteOffset, source.bytes.byteLength);
	const dataStart =
		entry.rawStart +
		30 +
		view.getUint16(entry.rawStart + 26, true) +
		view.getUint16(entry.rawStart + 28, true);
	const compressed = source.bytes.subarray(dataStart, dataStart + entry.compressedSize);
	const data = entry.method === 0 ? compressed : inflateSync(compressed);
	const hasBom = data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf;
	return {
		entryName,
		zipDir: entryName.slice(0, entryName.lastIndexOf('/')),
		xml: strFromU8(hasBom ? data.subarray(3) : data),
		hasBom
	};
}

/** פורש רק דפים שנערכו, פעם אחת לדף, ומשאיר את המקור ללא שינוי. */
export function writeGridSet(
	source: GridSetSource,
	edits: readonly CellEdit[],
	wordListEdits: readonly WordListEdit[] = []
): Uint8Array {
	const cellByEntry = new Map<string, CellEdit[]>();
	const wordByEntry = new Map<string, WordListEdit[]>();
	const pageByEntry = new Map<string, string>();
	for (const edit of edits) {
		const name = source.pageEntry.get(edit.page);
		if (!name) throw new Error(`הדף אינו קיים: ${edit.page}`);
		const group = cellByEntry.get(name) ?? [];
		group.push(edit);
		cellByEntry.set(name, group);
		pageByEntry.set(name, edit.page);
	}
	for (const edit of wordListEdits) {
		const name = source.pageEntry.get(edit.page);
		if (!name) throw new Error(`הדף אינו קיים: ${edit.page}`);
		const group = wordByEntry.get(name) ?? [];
		group.push(edit);
		wordByEntry.set(name, group);
		pageByEntry.set(name, edit.page);
	}
	const replacements = new Map<string, Uint8Array>();
	for (const [name, page] of pageByEntry) {
		const { xml: originalXml, hasBom: bom } = readPageXml(source, page);
		let xml = originalXml;
		for (const edit of cellByEntry.get(name) ?? [])
			xml = applyCellEditXml(xml, edit.x, edit.y, edit);
		for (const edit of wordByEntry.get(name) ?? []) xml = applyWordListEditXml(xml, edit);
		const encoded = strToU8(xml);
		const replacement = new Uint8Array(encoded.length + (bom ? 3 : 0));
		if (bom) replacement.set([0xef, 0xbb, 0xbf]);
		replacement.set(encoded, bom ? 3 : 0);
		replacements.set(name, replacement);
	}
	return rebuildZip(source.bytes, source.index, replacements);
}
