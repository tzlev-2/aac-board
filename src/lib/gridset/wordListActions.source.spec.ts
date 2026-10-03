/**
 * Private-source gate for WordList arming. Reads org-2/החדשות שלי from the
 * licensed shared input when present; skips otherwise. Does not copy .gridset
 * bytes into Git.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { writeGridSet, type GridSetSource } from './gridSetSource';
import { applyWordListEditXml, findWordListItemRange } from './xmlEdit';
import { crc32 } from './crc32';
import { readZipIndex } from './zipArchive';

function sourceOf(bytes: Uint8Array): GridSetSource {
	const index = readZipIndex(bytes);
	const pageEntry = new Map<string, string>();
	for (const entry of index.entries) {
		const match = /(^|\/)Grids\/(.+)\/grid\.xml$/i.exec(entry.name);
		if (match) pageEntry.set(match[2], entry.name);
	}
	return { bytes, index, pageEntry };
}

const ORG2 =
	'/home/user/projects/aac-migration-20261002/orchestrator-h1-20261002/shared-licensed-inputs/org-2.gridset';
const PAGE = 'החדשות שלי';
const FILLER = 'החדשות';

function itemTexts(xml: string): string[] {
	const block = /<WordList>[\s\S]*?<\/WordList>/.exec(xml)?.[0] ?? '';
	return [...block.matchAll(/<WordListItem>[\s\S]*?<\/WordListItem>/g)].map((match) =>
		[...match[0].matchAll(/<r>([\s\S]*?)<\/r>/g)]
			.map((run) => run[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim())
			.filter(Boolean)
			.join(' ')
	);
}

describe.skipIf(!existsSync(ORG2))('org-2 news page WordList source', () => {
	const bytes = new Uint8Array(readFileSync(ORG2));
	const files = unzipSync(bytes);
	const xml = strFromU8(files[`Grids/${PAGE}/grid.xml`]);

	it('has eight filler items and the two arming commands', () => {
		const texts = itemTexts(xml);
		expect(texts).toHaveLength(8);
		expect(texts.every((text) => text.includes(FILLER))).toBe(true);
		expect(xml).toContain('Prediction.AddToWordList');
		expect(xml).toContain('Prediction.DeleteWord');
		expect(xml).not.toContain('Prediction.PredictThis');
		expect((xml.match(/Prediction.AddToWordList/g) ?? []).length).toBe(1);
		expect((xml.match(/Prediction.DeleteWord/g) ?? []).length).toBe(1);
	});

	it('Save Copy splices one item and keeps other pages/media/CRC', () => {
		const originals = itemTexts(xml);
		expect(originals).toHaveLength(8);
		const neighbour = findWordListItemRange(xml, 1)!;
		const neighbourXml = xml.slice(neighbour.start, neighbour.end);
		const replacement = {
			text: { paragraphs: [{ sentences: [{ runs: ['saved-copy'] }] }] }
		};
		const source = sourceOf(bytes);
		const output = writeGridSet(
			source,
			[],
			[{ page: PAGE, index: 0, op: 'replace', item: replacement }]
		);
		expect(source.bytes).toEqual(bytes);
		const afterFiles = unzipSync(output);
		const afterXml = strFromU8(afterFiles[`Grids/${PAGE}/grid.xml`]);
		const afterNeighbour = findWordListItemRange(afterXml, 1)!;
		expect(afterXml.slice(afterNeighbour.start, afterNeighbour.end)).toBe(neighbourXml);
		expect(afterXml.slice(0, afterXml.indexOf('<WordList>'))).toBe(
			xml.slice(0, xml.indexOf('<WordList>'))
		);
		expect(afterXml).toContain('<r>saved-copy</r>');
		expect(itemTexts(afterXml)[0]).toBe('saved-copy');
		expect(
			itemTexts(applyWordListEditXml(xml, { index: 0, op: 'replace', item: replacement }))
		).toEqual(itemTexts(afterXml));
		const beforeIndex = readZipIndex(bytes);
		const afterIndex = readZipIndex(output);
		expect(afterIndex.entries.map((entry) => entry.name)).toEqual(
			beforeIndex.entries.map((entry) => entry.name)
		);
		const changed: string[] = [];
		for (let i = 0; i < beforeIndex.entries.length; i++) {
			const entry = beforeIndex.entries[i];
			if (entry.name === `Grids/${PAGE}/grid.xml`) continue;
			if (Buffer.compare(Buffer.from(afterFiles[entry.name]), Buffer.from(files[entry.name])) !== 0)
				changed.push(entry.name);
			if (crc32(afterFiles[entry.name]) !== crc32(files[entry.name]))
				changed.push(`crc:${entry.name}`);
		}
		expect(changed).toEqual([]);
		expect(itemTexts(strFromU8(files[`Grids/${PAGE}/grid.xml`]))).toEqual(originals);
	}, 30000);

	it('delete shortens Items and leaves the remaining nodes intact', () => {
		const kept = findWordListItemRange(xml, 1)!;
		const keptXml = xml.slice(kept.start, kept.end);
		const after = applyWordListEditXml(xml, { index: 0, op: 'remove' });
		expect(itemTexts(after)).toHaveLength(7);
		expect(after).toContain(keptXml);
	});
});
