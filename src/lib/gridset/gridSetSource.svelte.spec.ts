import { describe, expect, it } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { openGridSet, writeGridSet } from './gridSetSource';

const xml =
	'<Grid><ColumnDefinitions><ColumnDefinition /><ColumnDefinition /></ColumnDefinitions><RowDefinitions><RowDefinition /><RowDefinition /></RowDefinitions><Cells><Cell Y="1"><Content><CaptionAndImage><Caption>old</Caption></CaptionAndImage><Style><BasedOnStyle>Default</BasedOnStyle></Style></Content></Cell></Cells><WordList><Items /></WordList></Grid>';

describe('פתיחה ושמירה בדפדפן', () => {
	it('סבב עריכה, צבעים, BOM והזרקת פותר סגנונות', async () => {
		const bytes = zipSync({
			'Settings0/settings.xml': strToU8(
				'<GridSetSettings><StartGrid>page</StartGrid></GridSetSettings>'
			),
			'Grids/page/grid.xml': strToU8('\uFEFF' + xml),
			'unknown.xml': strToU8('<Unknown />')
		});
		const opened = await openGridSet(bytes);
		expect(opened.gridSet.pages.page.cells[0].caption).toBe('old');
		const output = writeGridSet(opened.source, [
			{
				page: 'page',
				x: 0,
				y: 1,
				caption: 'new &<>',
				colours: {
					BackColour: '#12345678',
					TileColour: '#87654321',
					BorderColour: '#ABCDEF12',
					FontColour: '#FEDCBA98'
				}
			}
		]);
		const reopened = await openGridSet(output);
		expect(Object.keys(reopened.gridSet.pages)).toEqual(Object.keys(opened.gridSet.pages));
		expect(reopened.gridSet.pages.page.cells).toHaveLength(opened.gridSet.pages.page.cells.length);
		expect(reopened.gridSet.media?.size).toBe(opened.gridSet.media?.size);
		expect(reopened.gridSet.pages.page.cells[0].caption).toBe('new &<>');
		expect(unzipSync(output)['Grids/page/grid.xml'].subarray(0, 3)).toEqual(
			new Uint8Array([0xef, 0xbb, 0xbf])
		);
		expect(reopened.gridSet.pages.page.cells[0].style.backColour).toBe('#12345678');
		let calls = 0;
		const custom = await openGridSet(bytes, {
			resolveStyle: () => {
				calls++;
				return reopened.gridSet.pages.page.cells[0].style;
			}
		});
		expect(calls).toBe(1);
		expect(custom.gridSet.pages.page.cells[0].style.backColour).toBe('#12345678');
	});
	it('דוחה ZIP פגום לפני הפרסור', async () => {
		await expect(openGridSet(strToU8('not zip'))).rejects.toThrow(/ZIP/);
	});
});

// קובצי הרישוי מקומיים בלבד; CI מדלג כשהם אינם נמצאים ב-static.
const localFiles = Object.keys(
	import.meta.glob('/static/*.gridset', { query: '?url', import: 'default' })
);
describe('פתיחה מחדש של לוחות מקומיים', () => {
	for (const name of ['org-3.gridset', 'b094.gridset']) {
		it.skipIf(!localFiles.includes(`/static/${name}`))(
			`${name}: דפים, תאים ומדיה נשמרים והכתובית חוזרת`,
			async () => {
				const bytes = new Uint8Array(await (await fetch(`/${name}`)).arrayBuffer());
				const memory = () =>
					(performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
						?.usedJSHeapSize ?? null;
				const beforeHeap = memory();
				const start = performance.now();
				const opened = await openGridSet(bytes);
				const openMs = performance.now() - start;
				const page =
					name === 'b094.gridset'
						? [...opened.source.pageEntry].find(([, entryName]) =>
								opened.source.index.entries.some((e) => e.name === entryName && e.flag & 8)
							)![0]
						: opened.gridSet.startGrid;
				const cell = opened.gridSet.pages[page].cells.find((c) => c.caption !== undefined)!;
				const writeStart = performance.now();
				const output = writeGridSet(opened.source, [
					{ page, x: cell.x, y: cell.y, caption: 'browser saved &<>' }
				]);
				const writeMs = performance.now() - writeStart;
				const afterWriteHeap = memory();
				const reopened = await openGridSet(output);
				expect(Object.keys(reopened.gridSet.pages)).toEqual(Object.keys(opened.gridSet.pages));
				for (const p of Object.keys(opened.gridSet.pages))
					expect(reopened.gridSet.pages[p].cells.length, p).toBe(
						opened.gridSet.pages[p].cells.length
					);
				expect(reopened.gridSet.media?.size).toBe(opened.gridSet.media?.size);
				expect(
					reopened.gridSet.pages[page].cells.find((c) => c.x === cell.x && c.y === cell.y)?.caption
				).toBe('browser saved &<>');
				const noOp = writeGridSet(opened.source, []);
				expect(noOp.length).toBe(bytes.length);
				let firstMismatch = -1;
				for (let i = 0; i < bytes.length; i++) {
					if (noOp[i] !== bytes[i]) {
						firstMismatch = i;
						break;
					}
				}
				expect(firstMismatch, name).toBe(-1);
				console.info(
					JSON.stringify({
						file: name,
						pages: Object.keys(opened.gridSet.pages).length,
						media: opened.gridSet.media?.size,
						openMs,
						writeMs,
						beforeHeap,
						afterWriteHeap,
						afterReopenHeap: memory(),
						sourceBytes: bytes.length
					})
				);
			},
			30000
		);
	}
});

describe('single page preview pipeline', () => {
	it('keeps source text, inherited styles, embedded refs and matches reopened output', async () => {
		const { readPageXml } = await import('./gridSetSource');
		const { parsePageXml } = await import('./parse');
		const { createStyleResolver } = await import('./resolveStyle');
		const { applyCellEditXml } = await import('./xmlEdit');
		const pageXml = xml.replace(
			'<Caption>old</Caption>',
			'<Caption>old</Caption><Image>probe.png</Image>'
		);
		const bytes = zipSync({
			'Settings0/settings.xml': strToU8(
				'<GridSetSettings><StartGrid>page</StartGrid></GridSetSettings>'
			),
			'Settings0/Styles/styles.xml': strToU8(
				'<StyleCatalog><Styles><Style Key="Default"><BackColour>#11223380</BackColour><FontName>Arial</FontName></Style></Styles></StyleCatalog>'
			),
			'prefix/gRiDs/page/GRID.xml': strToU8('\uFEFF' + pageXml),
			'prefix/gRiDs/page/0-1probe.png': new Uint8Array([1, 2, 3])
		});
		const opened = await openGridSet(bytes);
		const input = readPageXml(opened.source, 'page');
		expect(input.xml).toBe(pageXml);
		expect(input.hasBom).toBe(true);
		expect(input.zipDir).toBe('prefix/gRiDs/page');
		const edit = {
			page: 'page',
			x: 0,
			y: 1,
			caption: 'אֵ &<>🙂',
			colours: { FontColour: '#FEDCBA80' }
		};
		const candidate = parsePageXml(
			'page',
			applyCellEditXml(input.xml, 0, 1, edit),
			createStyleResolver(opened.gridSet.styles),
			input.zipDir
		);
		const reopened = await openGridSet(writeGridSet(opened.source, [edit]));
		expect(candidate).toEqual(reopened.gridSet.pages.page);
		expect(candidate.cells[0].image?.embeddedPath).toBe('prefix/gRiDs/page/0-1probe.png');
		expect(candidate.cells[0].style.backColour).toBe('#11223380');
		expect(opened.source.bytes).toEqual(bytes);
		expect(() => parsePageXml('page', '<Other/>', createStyleResolver({}), 'Grids/page')).toThrow(
			'invalid-grid-root'
		);
	});
});
