import { deflateSync, strFromU8 } from 'fflate';
import { crc32 } from './crc32';

export interface ZipEntry {
	name: string;
	nameBytes: Uint8Array;
	flag: number;
	method: number;
	crc: number;
	compressedSize: number;
	uncompressedSize: number;
	localHeaderOffset: number;
	rawStart: number;
	rawEnd: number;
	centralRecord: Uint8Array;
}

export interface ZipIndex {
	entries: ZipEntry[];
	centralDirOffset: number;
	eocd: Uint8Array;
}

function fail(reason: string, name = 'ארכיון'): never {
	throw new Error(`ZIP לא נתמך או פגום (${name}): ${reason}`);
}

/** קורא רק כותרות; גדלים ו-CRC נקראים מהספרייה המרכזית גם כשיש descriptor. */
export function readZipIndex(bytes: Uint8Array): ZipIndex {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const bounds = (start: number, size: number, name?: string) => {
		if (start < 0 || start + size > bytes.length) fail('קובץ קטוע', name);
	};
	let end = -1;
	for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 22 - 0xffff); p--) {
		if (
			view.getUint32(p, true) === 0x06054b50 &&
			p + 22 + view.getUint16(p + 20, true) === bytes.length
		) {
			end = p;
			break;
		}
	}
	if (end < 0) fail('חסרה חתימת סוף ZIP');
	if (end >= 20 && view.getUint32(end - 20, true) === 0x07064b50) fail('zip64');
	const count = view.getUint16(end + 10, true);
	const size = view.getUint32(end + 12, true);
	const offset = view.getUint32(end + 16, true);
	if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) fail('zip64');
	if (
		view.getUint16(end + 4, true) ||
		view.getUint16(end + 6, true) ||
		view.getUint16(end + 8, true) !== count
	)
		fail('ארכיון רב-דיסקי');
	bounds(offset, size);
	if (offset + size !== end) fail('גבולות הספרייה המרכזית');
	const entries: ZipEntry[] = [];
	const names = new Set<string>();
	let p = offset;
	for (let i = 0; i < count; i++) {
		bounds(p, 46);
		if (view.getUint32(p, true) !== 0x02014b50) fail('חתימת ספרייה מרכזית');
		const nameLength = view.getUint16(p + 28, true);
		const extraLength = view.getUint16(p + 30, true);
		const recordLength = 46 + nameLength + extraLength + view.getUint16(p + 32, true);
		bounds(p, recordLength);
		const nameBytes = bytes.subarray(p + 46, p + 46 + nameLength);
		const flag = view.getUint16(p + 8, true);
		const name = strFromU8(nameBytes, !(flag & 0x800));
		const method = view.getUint16(p + 10, true);
		const compressedSize = view.getUint32(p + 20, true);
		const uncompressedSize = view.getUint32(p + 24, true);
		const localHeaderOffset = view.getUint32(p + 42, true);
		if ([compressedSize, uncompressedSize, localHeaderOffset].includes(0xffffffff))
			fail('zip64', name);
		if (flag & 1) fail('הצפנה', name);
		if (view.getUint16(p + 34, true)) fail('ארכיון רב-דיסקי', name);
		if (method !== 0 && method !== 8) fail(`שיטת דחיסה ${method}`, name);
		if (names.has(name)) fail('שם רשומה כפול', name);
		names.add(name);
		for (let e = p + 46 + nameLength; e < p + 46 + nameLength + extraLength; ) {
			if (e + 4 > p + 46 + nameLength + extraLength) fail('extra קטוע', name);
			if (view.getUint16(e, true) === 1) fail('zip64', name);
			e += 4 + view.getUint16(e + 2, true);
			if (e > p + 46 + nameLength + extraLength) fail('extra קטוע', name);
		}
		if (entries.length && localHeaderOffset <= entries[entries.length - 1].rawStart)
			fail('סדר היסטים לא עולה', name);
		bounds(localHeaderOffset, 30, name);
		if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) fail('חתימה מקומית', name);
		if (view.getUint16(localHeaderOffset + 6, true) & 1) fail('הצפנה', name);
		entries.push({
			name,
			nameBytes,
			flag,
			method,
			crc: view.getUint32(p + 16, true),
			compressedSize,
			uncompressedSize,
			localHeaderOffset,
			rawStart: localHeaderOffset,
			rawEnd: 0,
			centralRecord: bytes.subarray(p, p + recordLength)
		});
		p += recordLength;
	}
	if (p !== end) fail('גודל ספרייה שגוי');
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		entry.rawEnd = entries[i + 1]?.rawStart ?? offset;
		const dataStart =
			entry.rawStart +
			30 +
			view.getUint16(entry.rawStart + 26, true) +
			view.getUint16(entry.rawStart + 28, true);
		if (dataStart + entry.compressedSize > entry.rawEnd) fail('רשומה קטועה או חופפת', entry.name);
	}
	return { entries, centralDirOffset: offset, eocd: bytes.subarray(end) };
}

/** דלתא בלבד: רשומות שלא הוחלפו מועתקות בשלמותן, כולל descriptor ו-extra. */
export function rebuildZip(
	bytes: Uint8Array,
	index: ZipIndex,
	replacements: ReadonlyMap<string, Uint8Array>
): Uint8Array {
	const names = new Set(index.entries.map((entry) => entry.name));
	for (const name of replacements.keys())
		if (!names.has(name)) fail('רשומה להחלפה אינה קיימת', name);
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const locals: Uint8Array[] = [
		bytes.subarray(0, index.entries[0]?.rawStart ?? index.centralDirOffset)
	];
	const centrals: Uint8Array[] = [];
	let offset = locals[0].length;
	for (const entry of index.entries) {
		const central = entry.centralRecord.slice();
		const cv = new DataView(central.buffer);
		cv.setUint32(42, offset, true);
		let local: Uint8Array;
		const data = replacements.get(entry.name);
		if (data !== undefined) {
			const compressed = deflateSync(data, { level: 6 });
			const headerLength =
				30 + view.getUint16(entry.rawStart + 26, true) + view.getUint16(entry.rawStart + 28, true);
			local = new Uint8Array(headerLength + compressed.length);
			local.set(bytes.subarray(entry.rawStart, entry.rawStart + headerLength));
			local.set(compressed, headerLength);
			const lv = new DataView(local.buffer);
			lv.setUint16(6, lv.getUint16(6, true) & ~8, true);
			cv.setUint16(8, cv.getUint16(8, true) & ~8, true);
			lv.setUint16(8, 8, true);
			cv.setUint16(10, 8, true);
			const crc = crc32(data);
			for (const [l, c, value] of [
				[14, 16, crc],
				[18, 20, compressed.length],
				[22, 24, data.length]
			]) {
				lv.setUint32(l, value, true);
				cv.setUint32(c, value, true);
			}
		} else local = bytes.subarray(entry.rawStart, entry.rawEnd);
		locals.push(local);
		centrals.push(central);
		offset += local.length;
	}
	const centralSize = centrals.reduce((sum, record) => sum + record.length, 0);
	if (offset + centralSize + index.eocd.length >= 0xffffffff) fail('הפלט דורש zip64');
	const eocd = index.eocd.slice();
	const ev = new DataView(eocd.buffer);
	ev.setUint32(12, centralSize, true);
	ev.setUint32(16, offset, true);
	const out = new Uint8Array(offset + centralSize + eocd.length);
	let p = 0;
	for (const part of [...locals, ...centrals, eocd]) {
		out.set(part, p);
		p += part.length;
	}
	return out;
}
