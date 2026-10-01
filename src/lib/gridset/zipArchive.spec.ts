import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { inflateSync, strToU8, unzipSync, zipSync } from 'fflate';
import { crc32 } from './crc32';
import { readZipIndex, rebuildZip, type ZipEntry } from './zipArchive';

const corpus = join(homedir(), 'work', 'grid-mapping', 'raw');
const available = existsSync(corpus) && existsSync(join(corpus, 'bundled'));
const load = (name: string) =>
	new Uint8Array(readFileSync(join(corpus, name.startsWith('b') ? 'bundled' : '', name)));

function unpack(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
	const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const start =
		entry.rawStart +
		30 +
		v.getUint16(entry.rawStart + 26, true) +
		v.getUint16(entry.rawStart + 28, true);
	const data = bytes.subarray(start, start + entry.compressedSize);
	return entry.method === 0 ? data : inflateSync(data);
}

describe('CRC ו-ZIP סינתטי', () => {
	it('וקטור CRC מוכר וקלט ריק', () => {
		expect(crc32(strToU8('123456789'))).toBe(0xcbf43926);
		expect(crc32(new Uint8Array())).toBe(0);
	});
	it('descriptor סינתטי נשמר ב-no-op ומוסר רק מהרשומה המוחלפת', () => {
		const bytes = zipSync({ 'a.xml': strToU8('old') });
		const index = readZipIndex(bytes);
		const e = index.entries[0];
		const withDescriptor = new Uint8Array(bytes.length + 16);
		withDescriptor.set(bytes.subarray(0, index.centralDirOffset));
		withDescriptor.set(bytes.subarray(index.centralDirOffset), index.centralDirOffset + 16);
		const v = new DataView(withDescriptor.buffer);
		v.setUint32(index.centralDirOffset, 0x08074b50, true);
		v.setUint32(index.centralDirOffset + 4, e.crc, true);
		v.setUint32(index.centralDirOffset + 8, e.compressedSize, true);
		v.setUint32(index.centralDirOffset + 12, e.uncompressedSize, true);
		v.setUint16(6, v.getUint16(6, true) | 8, true);
		for (const at of [14, 18, 22]) v.setUint32(at, 0, true);
		v.setUint16(index.centralDirOffset + 24, e.flag | 8, true);
		v.setUint32(withDescriptor.length - 6, index.centralDirOffset + 16, true);
		const descriptorIndex = readZipIndex(withDescriptor);
		expect(rebuildZip(withDescriptor, descriptorIndex, new Map())).toEqual(withDescriptor);
		const output = rebuildZip(
			withDescriptor,
			descriptorIndex,
			new Map([['a.xml', strToU8('new')]])
		);
		const next = readZipIndex(output);
		const ov = new DataView(output.buffer);
		expect(next.entries[0].flag & 8).toBe(0);
		expect(ov.getUint16(6, true) & 8).toBe(0);
		expect(unzipSync(output)['a.xml']).toEqual(strToU8('new'));
		expect(next.entries[0].rawEnd).toBe(30 + e.nameBytes.length + next.entries[0].compressedSize);
	});
	it('no-op, תצוגה עם byteOffset אמיתי, החלפה ושמירת המקור', () => {
		const bytes = zipSync({
			'Grids/עמוד/grid.xml': strToU8('<Grid />'),
			'unknown.bin': new Uint8Array([0, 1, 255])
		});
		const padded = new Uint8Array(bytes.length + 13);
		padded.set(bytes, 7);
		const input = padded.subarray(7, 7 + bytes.length);
		const original = input.slice();
		const index = readZipIndex(input);
		expect(index.entries.map((e) => e.name)).toEqual(['Grids/עמוד/grid.xml', 'unknown.bin']);
		expect(rebuildZip(input, index, new Map())).toEqual(bytes);
		const output = rebuildZip(
			input,
			index,
			new Map([['Grids/עמוד/grid.xml', strToU8('<Grid>new</Grid>')]])
		);
		expect(unzipSync(output)['Grids/עמוד/grid.xml']).toEqual(strToU8('<Grid>new</Grid>'));
		expect(unzipSync(output)['unknown.bin']).toEqual(new Uint8Array([0, 1, 255]));
		expect(input).toEqual(original);
	});
	it('דוחה קלט קטוע, הצפנה, zip64, רב-דיסקי, שיטה לא נתמכת והחלפה חסרה', () => {
		const bytes = zipSync({ 'a.xml': strToU8('a'), 'b.xml': strToU8('b') });
		const index = readZipIndex(bytes);
		expect(() => readZipIndex(strToU8('not a zip'))).toThrow(/ZIP/);
		expect(() => readZipIndex(bytes.subarray(0, bytes.length - 1))).toThrow(/חסרה/);
		expect(() => rebuildZip(bytes, index, new Map([['missing.xml', strToU8('x')]]))).toThrow(
			/אינה קיימת/
		);
		for (const [at, value, width, error] of [
			[index.centralDirOffset + 8, 1, 2, /הצפנה/],
			[index.centralDirOffset + 20, 0xffffffff, 4, /zip64/],
			[index.centralDirOffset + 24, 0xffffffff, 4, /zip64/],
			[index.centralDirOffset + 42, 0xffffffff, 4, /zip64/],
			[bytes.length - 18, 1, 2, /רב-דיסקי/],
			[index.centralDirOffset + 10, 99, 2, /שיטת דחיסה/]
		] as const) {
			const bad = bytes.slice();
			const v = new DataView(bad.buffer);
			if (width === 4) v.setUint32(at, value, true);
			else v.setUint16(at, value, true);
			expect(() => readZipIndex(bad)).toThrow(error);
		}
		const reversed = bytes.slice();
		new DataView(reversed.buffer).setUint32(
			index.centralDirOffset + index.entries[0].centralRecord.length + 42,
			0,
			true
		);
		expect(() => readZipIndex(reversed)).toThrow(/סדר היסטים/);
	});
});

describe.skipIf(!available)('שערי קורפוס ZIP מקומי', () => {
	it('ספירת ארבעת הלוחות וטווחים רצופים', () => {
		for (const [name, count] of [
			['b037.gridset', 6],
			['org-1.gridset', 102],
			['org-2.gridset', 137],
			['org-3.gridset', 54]
		] as const) {
			const index = readZipIndex(load(name));
			expect(index.entries.length, name).toBe(count);
			expect(
				index.entries.reduce((sum, e) => sum + e.rawEnd - e.rawStart, 0),
				name
			).toBe(index.centralDirOffset);
		}
	});
	it('no-op זהה בייטית על 116/116 כולל descriptors', () => {
		const files = [
			...readdirSync(corpus)
				.filter((n) => n.endsWith('.gridset'))
				.map((n) => join(corpus, n)),
			...readdirSync(join(corpus, 'bundled'))
				.filter((n) => n.endsWith('.gridset'))
				.map((n) => join(corpus, 'bundled', n))
		];
		const failures: string[] = [];
		for (const file of files) {
			const bytes = new Uint8Array(readFileSync(file));
			const result = rebuildZip(bytes, readZipIndex(bytes), new Map());
			if (!Buffer.from(result).equals(Buffer.from(bytes))) failures.push(file);
		}
		expect(files).toHaveLength(116);
		expect(files.some((f) => f.endsWith('/b094.gridset'))).toBe(true);
		expect(failures).toEqual([]);
		console.info(
			`no-op ${files.length - failures.length}/${files.length}; failures=${JSON.stringify(failures)}`
		);
	}, 30000);
	it('CRC של 1025 רשומות מול הכותב המקורי; שמות מקומיים ומרכזיים זהים', () => {
		let count = 0;
		const failures: string[] = [];
		let nameMismatches = 0;
		for (const name of ['b037.gridset', 'org-1.gridset', 'org-3.gridset', 'b094.gridset']) {
			const bytes = load(name);
			const v = new DataView(bytes.buffer);
			for (const entry of readZipIndex(bytes).entries) {
				count++;
				if (crc32(unpack(bytes, entry)) !== entry.crc) failures.push(`${name}:${entry.name}`);
				const localName = bytes.subarray(
					entry.rawStart + 30,
					entry.rawStart + 30 + v.getUint16(entry.rawStart + 26, true)
				);
				if (!Buffer.from(localName).equals(Buffer.from(entry.nameBytes))) nameMismatches++;
			}
		}
		expect(count).toBe(1025);
		expect(failures).toEqual([]);
		expect(nameMismatches).toBe(0);
		console.info(`CRC ${count}/${count}; name byte mismatches=${nameMismatches}`);
	}, 30000);
});
