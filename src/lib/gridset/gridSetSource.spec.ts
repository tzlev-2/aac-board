import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { crc32 } from './crc32';
import { writeGridSet, type GridSetSource } from './gridSetSource';
import { readZipIndex, rebuildZip } from './zipArchive';
import { setCellCaption } from './xmlEdit';

function sourceOf(bytes: Uint8Array): GridSetSource {
	const index = readZipIndex(bytes);
	const pageEntry = new Map<string, string>();
	for (const entry of index.entries) {
		const match = /(^|\/)Grids\/(.+)\/grid\.xml$/i.exec(entry.name);
		if (match) pageEntry.set(match[2], entry.name);
	}
	return { bytes, index, pageEntry };
}

function assertPreserved(
	source: GridSetSource,
	output: Uint8Array,
	changedName: string,
	unchanged: number
) {
	const next = readZipIndex(output);
	const before = unzipSync(source.bytes);
	const after = unzipSync(output);
	// שמות, סדר, בייטים מפורשים וטווח מקומי גולמי: שתי רמות נאמנות.
	expect(Object.keys(after)).toEqual(Object.keys(before));
	expect(next.entries.map((e) => e.name)).toEqual(source.index.entries.map((e) => e.name));
	const changed: string[] = [];
	let preserved = 0;
	for (let i = 0; i < source.index.entries.length; i++) {
		const entry = source.index.entries[i];
		const replacement = next.entries[i];
		if (!Buffer.from(after[entry.name]).equals(Buffer.from(before[entry.name])))
			changed.push(entry.name);
		if (entry.name === changedName) continue;
		preserved++;
		expect(
			Buffer.compare(Buffer.from(after[entry.name]), Buffer.from(before[entry.name])),
			entry.name
		).toBe(0);
		expect(
			Buffer.compare(
				Buffer.from(output.subarray(replacement.rawStart, replacement.rawEnd)),
				Buffer.from(source.bytes.subarray(entry.rawStart, entry.rawEnd))
			),
			entry.name
		).toBe(0);
		const central = replacement.centralRecord.slice();
		new DataView(central.buffer).setUint32(42, entry.localHeaderOffset, true);
		expect(central, entry.name).toEqual(entry.centralRecord);
	}
	expect(preserved).toBe(unchanged);
	expect(changed).toEqual([changedName]);
}

describe('כתיבת מקור סינתטי', () => {
	it('BOM בייטי נשמר, שתי עריכות באותו דף, מקור לא משתנה ושגיאות מזהים', () => {
		const xml =
			'<Grid>\r\n <Cells><Cell Y="4"><Content><CaptionAndImage><Caption>old</Caption><Image>keep</Image></CaptionAndImage><Style><BasedOnStyle>Default</BasedOnStyle></Style></Content></Cell></Cells>\r\n <Unknown a="1" />\r\n</Grid>';
		const data = new Uint8Array(strToU8(xml).length + 3);
		data.set([0xef, 0xbb, 0xbf]);
		data.set(strToU8(xml), 3);
		const source = sourceOf(
			zipSync({ 'prefix/gRiDs/page/GRID.xml': data, 'opaque.bin': strToU8('untouched') })
		);
		const original = source.bytes.slice();
		expect(writeGridSet(source, [])).toEqual(source.bytes);
		const output = writeGridSet(source, [
			{ page: 'page', x: 0, y: 4, caption: 'first' },
			{ page: 'page', x: 0, y: 4, caption: 'new &<>' }
		]);
		const edited = unzipSync(output)['prefix/gRiDs/page/GRID.xml'];
		expect(edited.subarray(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
		expect(strFromU8(edited.subarray(3))).toBe(
			xml.replace('<Caption>old</Caption>', '<Caption>new &amp;&lt;&gt;</Caption>')
		);
		assertPreserved(source, output, 'prefix/gRiDs/page/GRID.xml', 1);
		expect(source.bytes).toEqual(original);
		expect(() => writeGridSet(source, [{ page: 'missing', x: 0, y: 4, caption: 'x' }])).toThrow(
			/הדף אינו קיים/
		);
		expect(() => writeGridSet(source, [{ page: 'page', x: 99, y: 99, caption: 'x' }])).toThrow(
			/התא/
		);
	});
	it('stored, extras נפרדים, חותמות שונות והערות נשמרים גם בהחלפה', () => {
		const bytes = zipSync({
			'a.xml': [
				strToU8('old'),
				{ level: 0, extra: { 0xcafe: new Uint8Array([1, 2]) }, comment: 'entry comment' }
			]
		});
		const first = readZipIndex(bytes);
		const v = new DataView(bytes.buffer);
		v.setUint16(10, 0x1234, true);
		v.setUint16(first.centralDirOffset + 12, 0x4321, true);
		// אותה מסגרת extra, תוכן שונה במקומי ובמרכזי.
		bytes[30 + first.entries[0].nameBytes.length + 4] = 9;
		const commented = new Uint8Array(bytes.length + 4);
		commented.set(bytes);
		commented.set(strToU8('tail'), bytes.length);
		new DataView(commented.buffer).setUint16(bytes.length - 2, 4, true);
		const index = readZipIndex(commented);
		expect(rebuildZip(commented, index, new Map())).toEqual(commented);
		const out = rebuildZip(commented, index, new Map([['a.xml', strToU8('new text')]]));
		const next = readZipIndex(out);
		const ov = new DataView(out.buffer);
		expect(next.entries[0].method).toBe(8);
		expect(unzipSync(out)['a.xml']).toEqual(strToU8('new text'));
		expect(ov.getUint16(10, true)).toBe(0x1234);
		expect(
			new DataView(
				next.entries[0].centralRecord.buffer,
				next.entries[0].centralRecord.byteOffset
			).getUint16(12, true)
		).toBe(0x4321);
		expect(out.subarray(30, 30 + index.entries[0].nameBytes.length + 6)).toEqual(
			commented.subarray(30, 30 + index.entries[0].nameBytes.length + 6)
		);
		expect(next.entries[0].centralRecord.subarray(46)).toEqual(
			index.entries[0].centralRecord.subarray(46)
		);
		expect(next.eocd.subarray(20)).toEqual(index.eocd.subarray(20));
	});
});

const corpus = join(homedir(), 'work', 'grid-mapping', 'raw');
const local = existsSync(join(corpus, 'bundled', 'b094.gridset'));
const load = (name: string) =>
	sourceOf(new Uint8Array(readFileSync(join(corpus, name.startsWith('b') ? 'bundled' : '', name))));
const captionList = (xml: string) =>
	[...xml.matchAll(/<Caption>([\s\S]*?)<\/Caption>/g)].map((m) => m[1]);

function captionCell(xml: string) {
	const match = [...xml.matchAll(/<Cell\b([^>]*)>[\s\S]*?<\/Cell>/g)].find((m) =>
		m[0].includes('<Caption>')
	)!;
	return {
		x: Number(/\bX="(\d+)"/.exec(match[1])?.[1] ?? 0),
		y: Number(/\bY="(\d+)"/.exec(match[1])?.[1] ?? 0)
	};
}

describe.skipIf(!local)('שערי שימור כתיבה מקומיים', () => {
	it('b037: תא עם X חסר, 36 כתוביות ורק רשומה אחת שונה', () => {
		const source = load('b037.gridset');
		const page = 'מקלדת פשוטה';
		const name = source.pageEntry.get(page)!;
		const xml = strFromU8(unzipSync(source.bytes)[name]);
		expect(xml).toContain('<Cell Y="4"');
		const output = writeGridSet(source, [{ page, x: 0, y: 4, caption: 'new &<>' }]);
		assertPreserved(source, output, name, 5);
		const after = strFromU8(unzipSync(output)[name]);
		expect(after).toBe(setCellCaption(xml, 0, 4, 'new &<>'));
		const beforeCaptions = captionList(xml);
		const afterCaptions = captionList(after);
		expect(beforeCaptions).toHaveLength(36);
		expect(afterCaptions).toHaveLength(36);
		expect(afterCaptions.filter((caption, i) => caption !== beforeCaptions[i])).toEqual([
			'new &amp;&lt;&gt;'
		]);
	});
	it('org-3: 53/54 רשומות נשמרות, כולל מדיה ו-XML לא מוכר', () => {
		const source = load('org-3.gridset');
		const [page, name] = [...source.pageEntry][0];
		const cell = captionCell(
			strFromU8(unzipSync(source.bytes, { filter: (e) => e.name === name })[name])
		);
		const output = writeGridSet(source, [{ page, ...cell, caption: 'saved copy' }]);
		assertPreserved(source, output, name, 53);
		expect(source.index.entries.some((e) => e.name.endsWith('thumbnail.bmp'))).toBe(true);
		expect(source.index.entries.some((e) => e.name.endsWith('autoreplacements.xml'))).toBe(true);
		if (process.env.AAC_GRIDSET_SAVE_OUTPUT)
			writeFileSync(join(process.env.AAC_GRIDSET_SAVE_OUTPUT, 'org-3-edited.gridset'), output);
		console.info('org-3 preserved 53/54');
	}, 30000);
	it('b094: החלפת דף עם descriptor, CRC/גדלים נכונים ו-862/863 נשמרות', () => {
		const source = load('b094.gridset');
		const pages = source.index.entries.filter((e) => e.name.endsWith('/grid.xml') && e.flag & 8);
		expect(pages).toHaveLength(69);
		const entry = pages[0];
		const page = [...source.pageEntry].find(([, name]) => name === entry.name)![0];
		const xml = strFromU8(
			unzipSync(source.bytes, { filter: (e) => e.name === entry.name })[entry.name]
		);
		const cell = captionCell(xml);
		const output = writeGridSet(source, [{ page, ...cell, caption: 'descriptor saved' }]);
		assertPreserved(source, output, entry.name, 862);
		const next = readZipIndex(output).entries.find((e) => e.name === entry.name)!;
		const data = unzipSync(output, { filter: (e) => e.name === entry.name })[entry.name];
		const ov = new DataView(output.buffer);
		expect(next.flag & 8).toBe(0);
		expect(ov.getUint16(next.rawStart + 6, true) & 8).toBe(0);
		expect(next.crc).toBe(crc32(data));
		expect(next.uncompressedSize).toBe(data.length);
		expect(ov.getUint32(next.rawStart + 14, true)).toBe(next.crc);
		expect(ov.getUint32(next.rawStart + 18, true)).toBe(next.compressedSize);
		expect(ov.getUint32(next.rawStart + 22, true)).toBe(next.uncompressedSize);
		expect(next.rawEnd - next.rawStart).toBe(
			30 +
				ov.getUint16(next.rawStart + 26, true) +
				ov.getUint16(next.rawStart + 28, true) +
				next.compressedSize
		);
		expect(strFromU8(data)).toBe(setCellCaption(xml, cell.x, cell.y, 'descriptor saved'));
		const directory =
			process.env.AAC_GRIDSET_SAVE_OUTPUT ?? mkdtempSync(join(tmpdir(), 'aac-save-'));
		const file = join(directory, 'b094-edited.gridset');
		writeFileSync(file, output);
		try {
			const result = execFileSync('unzip', ['-t', file], {
				env: { ...process.env, LC_ALL: 'C.UTF-8' },
				maxBuffer: 1024 * 1024
			}).toString();
			expect(result).toContain('No errors detected');
			console.info('b094 preserved 862/863; descriptor removed; unzip -t: No errors detected');
		} finally {
			if (!process.env.AAC_GRIDSET_SAVE_OUTPUT) rmSync(directory, { recursive: true });
		}
	}, 30000);
});
