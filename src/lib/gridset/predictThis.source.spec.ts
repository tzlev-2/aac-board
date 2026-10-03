/**
 * Private-source gate for PredictThis. Reads b104/Actions from the licensed
 * corpus when present; skips otherwise. Does not copy .gridset bytes into Git.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import {
	B104_BODY_DOCUMENTED,
	B104_BODY_PAGE1,
	B104_BODY_PAGE2,
	B104_BODY_PAGE3,
	B104_FOOD_PAGE1
} from './__fixtures__/predictThisSource';

const B104 = '/home/user/projects/aac-materials/corpus-116/bundled/b104.gridset';

function itemTexts(xml: string, commandId: string, caption: string): string[] {
	const cell = [...xml.matchAll(/<Cell\b[^>]*>[\s\S]*?<\/Cell>/g)].find((match) =>
		match[0].includes(`<Caption>${caption}</Caption>`)
	);
	if (!cell) return [];
	const command = [...cell[0].matchAll(/<Command ID="([^"]+)"[^>]*>([\s\S]*?)<\/Command>/g)].find(
		(match) => match[1] === commandId
	);
	if (!command) return [];
	return [...command[2].matchAll(/<WordListItem>[\s\S]*?<r>([\s\S]*?)<\/r>/g)].map((match) =>
		match[1].replace(/\s+/g, ' ').trim()
	);
}

describe.skipIf(!existsSync(B104))('b104/Actions PredictThis source extract', () => {
	const xml = strFromU8(unzipSync(new Uint8Array(readFileSync(B104)))['Grids/Actions/grid.xml']);

	it('Body actions carries 84 verbs and the three documented pages in XML order', () => {
		const texts = itemTexts(xml, 'Prediction.PredictThis', 'Body actions');
		expect(texts).toHaveLength(84);
		expect(texts.slice(0, 21)).toEqual([...B104_BODY_DOCUMENTED]);
		expect(texts.slice(0, 7)).toEqual([...B104_BODY_PAGE1]);
		expect(texts.slice(7, 14)).toEqual([...B104_BODY_PAGE2]);
		expect(texts.slice(14, 21)).toEqual([...B104_BODY_PAGE3]);
	});

	it('Food actions starts with the documented first page', () => {
		const texts = itemTexts(xml, 'Prediction.PredictThis', 'Food actions');
		expect(texts.slice(0, 7)).toEqual([...B104_FOOD_PAGE1]);
	});

	it('Questions is ChangeWordList empty then PredictThis with 13 phrases', () => {
		const change = itemTexts(xml, 'Prediction.ChangeWordList', 'Questions');
		const predict = itemTexts(xml, 'Prediction.PredictThis', 'Questions');
		expect(change).toEqual([]);
		expect(predict).toHaveLength(13);
		expect(predict[0]).toContain('What');
		expect(predict.slice(1, 7)).toEqual(['Who', 'what', 'when', 'where', 'how', 'why']);
	});
});
