import { describe, it, expect } from 'vitest';
import { strToU8, zipSync, unzipSync } from 'fflate';
import { openGridSet, writeGridSet, type CellEdit } from '$lib/gridset/gridSetSource';
import { readZipIndex } from '$lib/gridset/zipArchive';
import { createGridSetEditSession, upsertCellEdit } from './gridset-edit-session';

function fixture() {
	const page =
		'<Grid><ColumnDefinitions><ColumnDefinition/><ColumnDefinition/></ColumnDefinitions><RowDefinitions><RowDefinition/></RowDefinitions><Cells><Cell><Content><CaptionAndImage><Caption>old</Caption><Image>.png</Image></CaptionAndImage><Style><BasedOnStyle>shared</BasedOnStyle></Style><Commands><Command ID="SpeechPlaySound"><Parameter Key="filedata"><data>.mp3</data></Parameter></Command><Command ID="Action.InsertText"><Parameter Key="text"><s Image=".png"><r>symbol</r></s></Parameter></Command></Commands></Content></Cell><Cell X="1"><Content><CaptionAndImage><Caption>neighbour</Caption></CaptionAndImage><Style><BasedOnStyle>shared</BasedOnStyle></Style></Content></Cell></Cells><WordList><Items><WordListItem><Text>word</Text><Image>.png</Image></WordListItem></Items></WordList><Unknown flag="yes"/></Grid>';
	return zipSync({
		'Settings0/settings.xml': strToU8(
			'<GridSetSettings><StartGrid>P</StartGrid></GridSetSettings>'
		),
		'Settings0/Styles/styles.xml': strToU8(
			'<StyleCatalog><Styles><Style Key="shared"><BackColour>#AABBCC80</BackColour><FontName>Arial</FontName><FontSize>20</FontSize></Style></Styles></StyleCatalog>'
		),
		'Grids/P/grid.xml': strToU8('\uFEFF' + page.replace('</Cells>', '</Cells>\r\n')),
		'Grids/Q/grid.xml': strToU8(page),
		'Grids/P/0-0.png': new Uint8Array([1, 2]),
		'Grids/P/wordlist-0.png': new Uint8Array([3, 4]),
		'Grids/P/0-0-0-filedata.mp3': new Uint8Array([5, 6]),
		'Grids/P/0-0-1-text-.png': new Uint8Array([9, 10]),
		'opaque.bin': new Uint8Array([7, 8])
	});
}

describe('transactional page preview', () => {
	it('isolates two pages, cancellation and the second save, while preserving refs/styles/source', async () => {
		const bytes = fixture();
		const opened = await openGridSet(bytes);
		const session = createGridSetEditSession(opened.source, opened.gridSet.styles);
		const a: CellEdit = {
			page: 'P',
			x: 0,
			y: 0,
			caption: 'אֵ🙂&<>',
			colours: { BackColour: '#12345680' }
		};
		const b: CellEdit = {
			page: 'Q',
			x: 1,
			y: 0,
			caption: 'B',
			colours: { TileColour: '#FEDCBA00' }
		};
		let applied = upsertCellEdit([], a);
		const before = session.preview('P', applied);
		expect(session.preview('Q', upsertCellEdit(applied, b)).cells[1].caption).toBe('B');
		expect(session.preview('Q', applied)).toEqual(opened.gridSet.pages.Q);
		expect(session.preview('P', applied)).toEqual(before);
		applied = upsertCellEdit(applied, b);
		const first = await openGridSet(writeGridSet(opened.source, applied));
		expect(first.gridSet.pages.P).toEqual(session.preview('P', applied));
		expect(first.gridSet.pages.Q).toEqual(session.preview('Q', applied));
		const last = upsertCellEdit(applied, { ...a, caption: 'A second' });
		const final = await openGridSet(writeGridSet(opened.source, last));
		expect(final.gridSet.pages.P.cells[0].caption).toBe('A second');
		expect(final.gridSet.pages.Q.cells[1].caption).toBe('B');
		expect(final.gridSet.pages.P.cells[1]).toEqual(opened.gridSet.pages.P.cells[1]);
		expect(final.gridSet.pages.P.cells[0].commands).toEqual(
			opened.gridSet.pages.P.cells[0].commands
		);
		expect(final.gridSet.pages.P.cells[0].image).toEqual(opened.gridSet.pages.P.cells[0].image);
		expect(final.gridSet.pages.P.wordList).toEqual(opened.gridSet.pages.P.wordList);
		expect(final.gridSet.pages.P.cells[0].image?.embeddedPath).toBe('Grids/P/0-0.png');
		expect(final.gridSet.pages.P.wordList[0].image?.embeddedPath).toBe('Grids/P/wordlist-0.png');
		expect(final.gridSet.pages.P.cells[0].commands[0].params.filedata).toEqual({
			data: '.mp3',
			embeddedPath: 'Grids/P/0-0-0-filedata.mp3'
		});
		expect(final.gridSet.pages.P.cells[0].commands[1].params.text).toMatchObject({
			paragraphs: [{ sentences: [{ image: { embeddedPath: 'Grids/P/0-0-1-text-.png' } }] }]
		});
		expect(final.gridSet.media?.size).toBe(4);

		expect(final.gridSet.styles).toEqual(opened.gridSet.styles);
		expect(final.gridSet.media).toEqual(opened.gridSet.media);
		expect(opened.source.bytes).toEqual(bytes);
		expect(writeGridSet(opened.source, [])).toEqual(bytes);
	});
	it('invalid patches and duplicate coordinates never publish a candidate', async () => {
		const opened = await openGridSet(fixture());
		const session = createGridSetEditSession(opened.source, opened.gridSet.styles);
		const before = session.preview('P', []);
		expect(() => session.preview('P', [{ page: 'P', x: 9, y: 0, caption: 'x' }])).toThrow(
			'missing-cell'
		);
		expect(() =>
			session.preview('P', [{ page: 'P', x: 0, y: 0, colours: { BackColour: 'red' } }])
		).toThrow('invalid-colour');
		expect(session.preview('P', [])).toEqual(before);
		const missingSource = { ...opened.source, pageEntry: new Map<string, string>() };
		expect(() =>
			createGridSetEditSession(missingSource, {}).preview('P', [
				{ page: 'P', x: 0, y: 0, caption: 'x' }
			])
		).toThrow();
		expect(session.preview('P', [])).toEqual(before);

		const files = unzipSync(fixture());
		files['Grids/P/grid.xml'] = strToU8('<Grid><Cells><Cell/><Cell/></Cells></Grid>');
		const duplicate = await openGridSet(zipSync(files));
		expect(() =>
			createGridSetEditSession(duplicate.source, {}).preview('P', [
				{ page: 'P', x: 0, y: 0, caption: 'x' }
			])
		).toThrow('ambiguous-cell');
	});
	it('b037 real P/Q: cancellation preserves applied A, both deltas and four raw/central records survive', async () => {
		const bytes = new Uint8Array(await (await fetch('/b037.gridset')).arrayBuffer());
		const opened = await openGridSet(bytes);
		const session = createGridSetEditSession(opened.source, opened.gridSet.styles);
		const a: CellEdit = { page: 'מקלדת פשוטה', x: 0, y: 4, caption: 'A' };
		const b: CellEdit = { page: 'מקלדת פשוטה - סימנים', x: 9, y: 4, caption: 'B' };
		let edits = upsertCellEdit([], a);
		const savedA = writeGridSet(opened.source, edits);
		session.preview(b.page, upsertCellEdit(edits, b));
		expect(session.preview(b.page, edits)).toEqual(opened.gridSet.pages[b.page]);
		expect(writeGridSet(opened.source, edits)).toEqual(savedA);
		edits = upsertCellEdit(edits, b);
		writeGridSet(opened.source, edits);
		edits = upsertCellEdit(edits, { ...a, caption: 'A final' });
		const output = writeGridSet(opened.source, edits);
		const reopened = await openGridSet(output);
		const next = readZipIndex(output);
		const before = unzipSync(bytes);
		const after = unzipSync(output);
		let changed = 0;
		let preserved = 0;
		for (const entry of opened.source.index.entries) {
			const replacement = next.entries.find((e) => e.name === entry.name)!;
			if (
				entry.name === opened.source.pageEntry.get(a.page) ||
				entry.name === opened.source.pageEntry.get(b.page)
			) {
				changed++;
				continue;
			}
			expect(after[entry.name]).toEqual(before[entry.name]);
			expect(output.subarray(replacement.rawStart, replacement.rawEnd)).toEqual(
				bytes.subarray(entry.rawStart, entry.rawEnd)
			);
			const central = replacement.centralRecord.slice();
			new DataView(central.buffer).setUint32(42, entry.localHeaderOffset, true);
			expect(central).toEqual(entry.centralRecord);
			preserved++;
		}
		expect(changed).toBe(2);
		expect(preserved).toBe(4);
		expect(reopened.gridSet.pages[a.page]).toEqual(session.preview(a.page, edits));
		expect(reopened.gridSet.pages[b.page]).toEqual(session.preview(b.page, edits));
		expect(opened.source.bytes).toEqual(bytes);
	});
});
