/** CRC-32/ISO-HDLC, כפי שנשמר ב-ZIP. */
const table = new Uint32Array(256);
for (let i = 0; i < table.length; i++) {
	let c = i;
	for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
	table[i] = c;
}

export function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
	return (crc ^ 0xffffffff) >>> 0;
}
