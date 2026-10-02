import {
	test,
	expect,
	type Page,
	type SavedUICopy,
	saveUIBlob
} from '../../../tests/owned-browser';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { buildGridset } from '../../lib/gridset/__fixtures__/buildGridset';
import { readZipIndex } from '../../lib/gridset/zipArchive';

const artifacts = process.env.AAC_TEST_ARTIFACTS ?? '/tmp/aac-gridset-edit-20-qa';
mkdirSync(artifacts, { recursive: true });
const colours = {
	'מילוי תא': '#227744FF',
	מסגרת: '#DD3322FF',
	'רקע אחורי של התא': '#3355AAFF',
	'צבע כיתוב': '#FFBB22FF'
};
function synthetic() {
	return buildGridset({
		startGrid: 'P',
		language: 'he',
		styles: [
			{
				key: 'shared',
				backColour: '#EEDDCC80',
				tileColour: '#77889900',
				fontColour: '#000000FF',
				borderColour: '#334455FF',
				fontSize: 20,
				fontName: 'Arial',
				backgroundShape: 1
			}
		],
		pages: [
			{
				name: 'P',
				columns: 4,
				rows: 2,
				cells: [
					{
						x: 0,
						y: 0,
						caption: 'go',
						basedOnStyle: 'shared',
						commands: [{ id: 'Jump.To', params: { grid: 'Q' } }]
					},
					{ x: 1, y: 0, caption: 'disabled', visibility: 'Disabled', basedOnStyle: 'shared' },
					{ x: 2, y: 0, caption: 'hidden', visibility: 'Hidden', basedOnStyle: 'shared' },
					{
						x: 3,
						y: 0,
						contentType: 'AutoContent',
						contentSubType: 'WordList',
						basedOnStyle: 'shared'
					},
					{
						x: 0,
						y: 1,
						caption: 'text',
						columnSpan: 2,
						basedOnStyle: 'shared',
						commands: [{ id: 'Action.InsertText', params: { text: 'word' } }]
					}
				]
			},
			{
				name: 'Q',
				columns: 2,
				rows: 1,
				cells: [
					{ x: 0, y: 0, caption: 'back', basedOnStyle: 'shared', commands: [{ id: 'Jump.Back' }] },
					{ x: 1, y: 0, caption: 'Q', basedOnStyle: 'shared' }
				]
			}
		]
	});
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
	const list: string[] = [];
	errors.set(page, list);
	page.on('pageerror', (e) => list.push(e.message));
});
test.afterEach(async ({ page }) => {
	expect(errors.get(page)).toEqual([]);
});
async function start(page: Page) {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
}
async function upload(page: Page, bytes: Uint8Array, name = 'probe.gridset') {
	await page
		.locator('input[type=file]')
		.setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
	await expect(page.getByTestId('grid-source')).toContainText(name);
	await expect(page.getByTestId('grid-loading')).toHaveCount(0);
}
async function edit(page: Page) {
	await page.getByRole('button', { name: 'עריכה', exact: true }).click();
}
function select(page: Page, x: number, y: number) {
	return page.locator(`[data-testid=edit-cell][data-cell-x="${x}"][data-cell-y="${y}"]`);
}
function cell(page: Page, x: number, y: number) {
	return page.locator(`[data-testid=grid-cell][data-cell-x="${x}"][data-cell-y="${y}"]`);
}
async function save(page: Page, name: string) {
	const event = page.waitForEvent('download');
	await page.getByRole('button', { name: 'שמור עותק', exact: true }).click();
	const d = await event;
	return saveUIBlob(page, d, resolve(artifacts, name));
}
async function reopen(page: Page, d: SavedUICopy, name?: string) {
	await upload(
		page,
		new Uint8Array(readFileSync((await d.path())!)),
		name ?? d.suggestedFilename()
	);
}
function assertArchive(source: Uint8Array, output: Uint8Array, changedNames: string[]) {
	const old = readZipIndex(source),
		next = readZipIndex(output);
	const before = unzipSync(source),
		after = unzipSync(output);
	expect(next.entries.map((e) => e.name)).toEqual(old.entries.map((e) => e.name));
	let changed = 0;
	for (let i = 0; i < old.entries.length; i++) {
		const a = old.entries[i],
			b = next.entries[i];
		if (changedNames.includes(a.name)) {
			expect(Buffer.from(after[a.name]).equals(Buffer.from(before[a.name]))).toBe(false);
			changed++;
			continue;
		}
		expect(Buffer.from(after[a.name]).equals(Buffer.from(before[a.name]))).toBe(true);
		expect(
			Buffer.from(output.subarray(b.rawStart, b.rawEnd)).equals(
				Buffer.from(source.subarray(a.rawStart, a.rawEnd))
			)
		).toBe(true);
		const central = b.centralRecord.slice();
		new DataView(central.buffer).setUint32(42, a.localHeaderOffset, true);
		expect(Buffer.from(central).equals(Buffer.from(a.centralRecord))).toBe(true);
	}
	expect(changed).toBe(changedNames.length);
}
function externalCheck(path: string, original?: string) {
	const result = spawnSync('unzip', ['-t', path]);
	if (original) {
		const before = spawnSync('unzip', ['-t', original]);
		expect(result.status).toBe(before.status);
		const warnings = (data: Buffer) =>
			data.toString('utf8').match(/mismatching "local" filename/g)?.length ?? 0;
		expect(warnings(result.stdout)).toBe(warnings(before.stdout));
		expect(result.stdout.toString('utf8')).not.toMatch(
			/bad CRC|invalid compressed|error:|unsupported compression/
		);
		expect(
			execFileSync('python3', [
				'-c',
				'import zipfile,sys; assert zipfile.ZipFile(sys.argv[1]).testzip() is None',
				path
			]).length
		).toBe(0);
	} else {
		expect(result.status).toBe(0);
		expect(result.stdout.toString('utf8')).toContain('No errors detected');
	}
}
function captionXml(output: Uint8Array, page: string) {
	return strFromU8(unzipSync(output)[`Grids/${page}/grid.xml`]);
}

test('1 b037 UI: top-right sparse coordinate, four colours, download and reopen', async ({
	page
}) => {
	await start(page);
	const source = readFileSync('static/b037.gridset');
	await upload(page, source, 'b037.gridset');
	await edit(page);
	await select(page, 0, 4).click();
	await page.getByLabel('כתובית', { exact: true }).fill('בדיקה20');
	for (const [label, value] of Object.entries(colours))
		await page.getByLabel(label, { exact: true }).fill(value);
	const d = await save(page, 'b037-ui-edited.gridset');
	expect(d.suggestedFilename()).toBe('b037-edited.gridset');
	const output = new Uint8Array(readFileSync((await d.path())!));
	assertArchive(source, output, ['Grids/מקלדת פשוטה/grid.xml']);
	externalCheck(resolve(artifacts, 'b037-ui-edited.gridset'));
	await reopen(page, d);
	await edit(page);
	await select(page, 0, 4).click();
	await expect(page.getByLabel('כתובית', { exact: true })).toHaveValue('בדיקה20');
	for (const [label, value] of Object.entries(colours))
		await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
});
test.describe('touch selection', () => {
	test.use({ hasTouch: true });
	test('2 inert selection via pointer, Enter and Space; Hidden/Disabled and span; Jump resumes', async ({
		page
	}) => {
		await start(page);
		await upload(page, synthetic());
		await edit(page);
		await select(page, 0, 0).focus();
		await page.keyboard.press('Enter');
		await page.keyboard.press('Space');
		await expect(page.getByLabel('דף', { exact: true })).toHaveValue('P');
		await select(page, 1, 0).click();
		await select(page, 2, 0).click();
		await select(page, 0, 1).tap();
		await expect(select(page, 0, 1)).toHaveAttribute('aria-pressed', 'true');
		await expect(select(page, 0, 1)).toHaveCSS('grid-column-end', 'span 2');
		await page.getByRole('button', { name: 'שימוש', exact: true }).click();
		await cell(page, 0, 0).click();
		await expect(page.getByText('Q', { exact: true })).toBeVisible();
	});
});
test('3 runtime output survives draft/cancel/save and mode changes on a non-home page', async ({
	page
}) => {
	await start(page);

	const svg = strToU8(
		'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>'
	);
	const source = buildGridset({
		pages: [
			{
				name: 'P',
				columns: 1,
				rows: 1,
				cells: [{ caption: 'go', commands: [{ id: 'Jump.To', params: { grid: 'Q' } }] }]
			},
			{
				name: 'Q',
				columns: 5,
				rows: 2,
				cells: [
					{
						x: 0,
						y: 0,
						caption: 'back',
						styleOverrides: { backColour: '#FFFFFFFF' },
						commands: [{ id: 'Jump.Back' }]
					},
					...Array.from({ length: 4 }, (_, i) => ({
						x: i + 1,
						y: 0,
						caption: `word${i}`,
						commands: [
							{
								id: 'Action.InsertText',
								params: {
									text: {
										shape: 's/r' as const,
										sentences: [{ image: '.svg', runs: [`word${i}`] }]
									},
									pos: 'Noun',
									gender: 'female',
									number: 'singular'
								}
							}
						]
					})),
					{ x: 0, y: 1, columnSpan: 5, contentType: 'Workspace', contentSubType: 'Chat' }
				],
				media: Object.fromEntries(
					Array.from({ length: 4 }, (_, i) => [`${i + 1}-0-0-text-.svg`, svg])
				)
			}
		]
	});
	await upload(page, source);
	await cell(page, 0, 0).click();
	for (let i = 1; i <= 4; i++) await cell(page, i, 0).click();
	const chat = page.getByTestId('chat-cell');
	await expect(chat).toContainText('word0 word1 word2 word3');
	const before = await chat.innerHTML();
	const preserve = async () => {
		expect(await chat.innerHTML()).toBe(before);
		if (await page.getByLabel('דף', { exact: true }).count())
			await expect(page.getByLabel('דף', { exact: true })).toHaveValue('Q');
	};
	await edit(page);
	await select(page, 0, 0).click();
	await page.getByLabel('מילוי תא', { exact: true }).fill('#12345680');
	await preserve();
	await page.getByRole('button', { name: 'בטל שינוי זה', exact: true }).click();
	await preserve();
	await page.getByLabel('מילוי תא', { exact: true }).fill('#12345680');
	await page.getByRole('button', { name: 'החל', exact: true }).click();
	await preserve();
	await save(page, 'output-state.gridset');
	await preserve();
	await page.getByRole('button', { name: 'שימוש', exact: true }).click();
	await preserve();
	await cell(page, 0, 0).click();
	await expect(cell(page, 0, 0)).toContainText('go');
});
test('4 V1 org-1 second-page words and pager persist across preview/cancel/apply/save/use', async ({
	page
}) => {
	await start(page);
	await edit(page);
	await page.getByLabel('דף', { exact: true }).selectOption('בגדים - עוד');
	await page.getByRole('button', { name: 'שימוש', exact: true }).click();
	await cell(page, 3, 3).click();
	const second = async () => {
		await expect(cell(page, 2, 1)).toContainText('כפכפים');
		await expect(cell(page, 1, 2)).toContainText('תכשיטים');
		await expect(cell(page, 3, 3)).toContainText('חזור');
	};
	await second();
	await edit(page);
	await select(page, 2, 1).click();
	await expect(page.getByLabel('כתובית', { exact: true })).toBeDisabled();
	await page.getByLabel('מילוי תא', { exact: true }).fill('#AA2244FF');
	await second();
	await page.getByRole('button', { name: 'בטל שינוי זה', exact: true }).click();
	await second();
	await page.getByLabel('מילוי תא', { exact: true }).fill('#AA2244FF');
	await page.getByRole('button', { name: 'החל', exact: true }).click();
	await second();
	await save(page, 'org1-pager.gridset');
	await second();
	await select(page, 3, 3).click();
	await second();
	await page.getByRole('button', { name: 'שימוש', exact: true }).click();
	await second();
	await edit(page);
	await page.getByLabel('דף', { exact: true }).selectOption('דף ראשי');
	await page.getByLabel('דף', { exact: true }).selectOption('בגדים - עוד');
	await expect(cell(page, 3, 3)).toContainText('עוד');
});
test('5 inherited style: no-op editor and explicit single override preserve the neighbour and styles', async ({
	page
}) => {
	await start(page);
	const source = synthetic();
	await upload(page, source);
	await edit(page);
	await select(page, 0, 0).click();
	await expect(page.getByRole('button', { name: 'החל', exact: true })).toBeDisabled();
	const noOp = await save(page, 'synthetic-noop.gridset');
	expect(new Uint8Array(readFileSync((await noOp.path())!))).toEqual(source);
	await page.getByLabel('מילוי תא', { exact: true }).fill('#778899FF');
	const changed = await save(page, 'single-override.gridset');
	const output = new Uint8Array(readFileSync((await changed.path())!));
	assertArchive(source, output, ['Grids/P/grid.xml']);
	const xml = captionXml(output, 'P');
	expect(xml.match(/<BackColour>/g)).toHaveLength(1);
	expect(xml).not.toContain('<FontColour>');
});
test('6 exact Hebrew/emoji/escaping, empty and space; invalid XML input blocks save', async ({
	page
}) => {
	await start(page);
	await upload(page, synthetic());
	await edit(page);
	await select(page, 0, 0).click();
	for (const [i, value] of ['אֵ🙂&<>', '', ' '].entries()) {
		await page.getByLabel('כתובית', { exact: true }).fill(value);
		const d = await save(page, `caption-${i}.gridset`);
		await reopen(page, d);
		await edit(page);
		await select(page, 0, 0).click();
		await expect(page.getByLabel('כתובית', { exact: true })).toHaveValue(value);
	}
	await page.getByLabel('כתובית', { exact: true }).fill('legal');
	await page.getByLabel('כתובית', { exact: true }).fill('\u0001');
	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page.getByRole('button', { name: 'שמור עותק', exact: true })).toBeDisabled();
	await expect(cell(page, 0, 0)).toContainText('legal');
});
test('7 V2 same session: applied A, cancelled B, applied B, second A save and final upload', async ({
	page
}) => {
	await start(page);
	const source = readFileSync('static/b037.gridset');
	await upload(page, source, 'b037.gridset');
	await edit(page);
	await select(page, 0, 4).click();
	await page.getByLabel('כתובית', { exact: true }).fill('A');
	await page.getByRole('button', { name: 'החל', exact: true }).click();
	await page.getByLabel('דף', { exact: true }).selectOption('מקלדת פשוטה - סימנים');
	await select(page, 9, 4).click();
	await page.getByLabel('כתובית', { exact: true }).fill('B draft');
	await page.getByRole('button', { name: 'בטל שינוי זה', exact: true }).click();
	await expect(page.getByLabel('כתובית', { exact: true })).toHaveValue('?');
	await page.getByLabel('דף', { exact: true }).selectOption('מקלדת פשוטה');
	await expect(cell(page, 0, 4)).toContainText('A');
	await page.getByLabel('דף', { exact: true }).selectOption('מקלדת פשוטה - סימנים');
	await select(page, 9, 4).click();
	await page.getByLabel('כתובית', { exact: true }).fill('B');
	await page.getByRole('button', { name: 'החל', exact: true }).click();
	await save(page, 'b037-two-pages-first.gridset');
	await page.getByLabel('דף', { exact: true }).selectOption('מקלדת פשוטה');
	await select(page, 0, 4).click();
	await page.getByLabel('כתובית', { exact: true }).fill('A final');
	const d = await save(page, 'b037-two-pages-final.gridset');
	const output = new Uint8Array(readFileSync((await d.path())!));
	assertArchive(source, output, [
		'Grids/מקלדת פשוטה/grid.xml',
		'Grids/מקלדת פשוטה - סימנים/grid.xml'
	]);
	externalCheck(resolve(artifacts, 'b037-two-pages-final.gridset'));
	await reopen(page, d);
	await expect(cell(page, 0, 4)).toContainText('A final');
	await edit(page);
	await page.getByLabel('דף', { exact: true }).selectOption('מקלדת פשוטה - סימנים');
	await expect(cell(page, 9, 4)).toContainText('B');
});
test('8 org-3 UI edit preserves 53/54 raw records and navigation after reopen', async ({
	page
}) => {
	await start(page);
	const source = readFileSync('static/org-3.gridset');
	await upload(page, source, 'org-3.gridset');
	await edit(page);
	await select(page, 6, 0).click();
	await page.getByLabel('כתובית', { exact: true }).fill('חזרה20');
	for (const [label, value] of Object.entries(colours))
		await page.getByLabel(label, { exact: true }).fill(value);
	const d = await save(page, 'org3-ui-edited.gridset');
	const output = new Uint8Array(readFileSync((await d.path())!));
	assertArchive(source, output, ['Grids/עמוד ראשי/grid.xml']);
	externalCheck(resolve(artifacts, 'org3-ui-edited.gridset'), 'static/org-3.gridset');
	await reopen(page, d);
	await expect(page.getByTestId('grid-source')).toContainText('34');
	await expect(cell(page, 6, 0)).toContainText('חזרה20');
	await page.getByText('לאכול', { exact: true }).click();
	await expect(page.getByText('לחם', { exact: true })).toBeVisible();
	await cell(page, 6, 0).click();
	await expect(page.getByText('לאכול', { exact: true })).toBeVisible();
});
test('9 b094 UI descriptor entry roundtrip preserves 862/863 records and valid CRC', async ({
	page
}) => {
	test.skip(
		!existsSync('static/b094.gridset'),
		'Private b094 corpus fixture is unavailable; synthetic descriptor/CRC tests still run.'
	);
	const source = readFileSync('static/b094.gridset');
	const probe = JSON.parse(
		execFileSync(
			'python3',
			[
				'-c',
				`import zipfile,xml.etree.ElementTree as E,json
z=zipfile.ZipFile('static/b094.gridset')
for i in z.infolist():
 if i.filename.endswith('/grid.xml') and i.flag_bits&8:
  root=E.fromstring(z.read(i))
  for c in root.findall('./Cells/Cell'):
   if c.find('./Content/CaptionAndImage/Caption') is not None:
    print(json.dumps({'entry':i.filename,'page':i.filename[6:-9],'x':int(c.get('X',0)),'y':int(c.get('Y',0))}));exit()
`
			],
			{ encoding: 'utf8' }
		)
	);
	await start(page);
	await upload(page, source, 'b094.gridset');
	await edit(page);
	await page.getByLabel('דף', { exact: true }).selectOption(probe.page);
	await select(page, probe.x, probe.y).click();
	await page.getByLabel('כתובית', { exact: true }).fill('b094 edit20');
	for (const [label, value] of Object.entries(colours))
		await page.getByLabel(label, { exact: true }).fill(value);
	const d = await save(page, 'b094-ui-edited.gridset');
	const output = new Uint8Array(readFileSync((await d.path())!));
	assertArchive(source, output, [probe.entry]);
	expect(readZipIndex(output).entries.find((e) => e.name === probe.entry)!.flag & 8).toBe(0);
	externalCheck(resolve(artifacts, 'b094-ui-edited.gridset'));
	await reopen(page, d);
	await expect(page.getByTestId('grid-source')).toContainText('427');
	await edit(page);
	await page.getByLabel('דף', { exact: true }).selectOption(probe.page);
	await select(page, probe.x, probe.y).click();
	await expect(page.getByLabel('כתובית', { exact: true })).toHaveValue('b094 edit20');
});
test('10 synthetic BOM, unknown XML and embedded carriers survive UI output', async ({ page }) => {
	const files = unzipSync(synthetic());
	files['Grids/P/grid.xml'] = strToU8(
		'\uFEFF' +
			strFromU8(files['Grids/P/grid.xml'])
				.replace('<Caption>go</Caption>', '<Caption>go</Caption><Image>.svg</Image>')
				.replace(
					'<Command ID="Jump.To">',
					'<Command ID="SpeechPlaySound"><Parameter Key="filedata"><data>.mp3</data></Parameter></Command><Command ID="Action.InsertText"><Parameter Key="text"><s Image=".svg"><r>rich</r></s></Parameter></Command><Command ID="Jump.To">'
				)
				.replace(
					'<Items />',
					'<Items><WordListItem><Text><s><r>word</r></s></Text><Image>.svg</Image></WordListItem></Items>'
				)
				.replace('</Grid>', '\r\n<Unknown tag="keep"/>\n</Grid>')
	);
	files['opaque.bin'] = new Uint8Array([8, 7, 6]);
	for (const name of ['0-0.svg', '0-0-1-text-.svg', 'wordlist-0.svg'])
		files[`Grids/P/${name}`] = strToU8(
			'<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><rect width="12" height="12" fill="red"/></svg>'
		);
	files['Grids/P/0-0-0-filedata.mp3'] = new Uint8Array([73, 68, 51]);
	const source = zipSync(files);
	await start(page);
	await upload(page, source);
	await edit(page);
	await select(page, 0, 0).click();
	await page.getByLabel('כתובית', { exact: true }).fill('unknown retained');
	const d = await save(page, 'synthetic-bom.gridset');
	const output = new Uint8Array(readFileSync((await d.path())!));
	assertArchive(source, output, ['Grids/P/grid.xml']);
	const xml = unzipSync(output)['Grids/P/grid.xml'];
	expect(xml.subarray(0, 3)).toEqual(new Uint8Array([239, 187, 191]));
	expect(strFromU8(xml)).toContain('\r\n<Unknown tag="keep"/>\n');
});
test('11 colour alpha 00/80/FF, RGB preserves alpha, transparency preserves RGB and cancel restores', async ({
	page
}) => {
	await start(page);
	await upload(page, synthetic());
	await edit(page);
	await select(page, 0, 0).click();
	const initial = await page.getByLabel('מילוי תא', { exact: true }).inputValue();
	await page.getByLabel('מילוי תא', { exact: true }).fill('#12345680');
	await page.getByLabel('מילוי תא RGB', { exact: true }).fill('#abcdef');
	await expect(page.getByLabel('מילוי תא', { exact: true })).toHaveValue('#abcdef80');
	await page.locator('fieldset').first().getByRole('button', { name: 'שקוף', exact: true }).click();
	await expect(page.getByLabel('מילוי תא', { exact: true })).toHaveValue('#abcdef00');
	await page.getByLabel('מילוי תא אטימות 0–255', { exact: true }).fill('255');
	await page.getByLabel('מילוי תא אטימות 0–255', { exact: true }).blur();
	await expect(page.getByLabel('מילוי תא', { exact: true })).toHaveValue('#abcdefff');
	await page.getByRole('button', { name: 'בטל שינוי זה', exact: true }).click();
	await expect(page.getByLabel('מילוי תא', { exact: true })).toHaveValue(initial);
});
test('12 PK sniffing, filename cases and same filename reopen', async ({ page }) => {
	await start(page);
	for (const [name, expected] of [
		['noextension', 'noextension-edited.gridset'],
		['odd.json', 'odd-edited.gridset'],
		['אב-edited.gridset', 'אב-edited.gridset']
	]) {
		await upload(page, synthetic(), name);
		const d = await save(page, `filename-${expected}`);
		expect(d.suggestedFilename()).toBe(expected);
		await reopen(page, d, name);
		await expect(page.getByTestId('grid-source')).toContainText(name);
	}
});
test('13 invalid colour/PK/zip64 and missing Content preserve the last legal board', async ({
	page
}) => {
	await start(page);
	await upload(page, synthetic());
	await edit(page);
	await select(page, 0, 0).click();
	await page.getByLabel('מסגרת', { exact: true }).fill('#abc');
	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page.getByRole('button', { name: 'שמור עותק', exact: true })).toBeDisabled();
	await page.getByRole('button', { name: 'בטל שינוי זה', exact: true }).click();
	await page.locator('input[type=file]').setInputFiles({
		name: 'bad.gridset',
		mimeType: 'application/zip',
		buffer: Buffer.from([80, 75, 0, 0])
	});
	await expect(page.getByRole('alert')).toContainText('ZIP');
	await expect(page.getByTestId('grid-source')).toContainText('probe.gridset');
	const zip64 = synthetic().slice();
	new DataView(zip64.buffer).setUint16(zip64.length - 22 + 10, 0xffff, true);
	await page.locator('input[type=file]').setInputFiles({
		name: 'zip64.gridset',
		mimeType: 'application/zip',
		buffer: Buffer.from(zip64)
	});
	await expect(page.getByRole('alert')).toContainText('zip64');
	await expect(page.getByTestId('grid-source')).toContainText('probe.gridset');
	const files = unzipSync(synthetic());
	files['Grids/P/grid.xml'] = strToU8(
		'<Grid><ColumnDefinitions><ColumnDefinition/></ColumnDefinitions><RowDefinitions><RowDefinition/></RowDefinitions><Cells><Cell/></Cells></Grid>'
	);
	await upload(page, zipSync(files), 'missing-content.gridset');
	await edit(page);
	await select(page, 0, 0).click();
	await page.getByLabel('כתובית', { exact: true }).fill('bad');
	await expect(page.getByRole('alert')).toBeVisible();
	await expect(page.getByRole('button', { name: 'שמור עותק', exact: true })).toBeDisabled();
	await expect(cell(page, 0, 0)).not.toContainText('bad');
});
test('F1 Action.Letter warns about the displayed command letter, but a static cell does not', async ({
	page
}) => {
	await start(page);
	await upload(page, readFileSync('static/b037.gridset'), 'b037.gridset');
	await edit(page);
	await select(page, 0, 4).click();
	await expect(page.getByTestId('action-letter-caption-notice')).toContainText('Action.Letter');
	await expect(page.getByTestId('action-letter-caption-notice')).toContainText('Grid 3');
	await upload(page, readFileSync('static/org-3.gridset'), 'org-3.gridset');
	await edit(page);
	await select(page, 0, 0).click();
	await expect(page.getByTestId('action-letter-caption-notice')).toHaveCount(0);
});
test('F2 invalid JSON preserves the loaded board atomically and a valid JSON model loads', async ({
	page
}) => {
	await start(page);
	await upload(page, readFileSync('static/b037.gridset'), 'b037.gridset');
	await page.locator('input[type=file]').setInputFiles({
		name: 'bad.json',
		mimeType: 'application/json',
		buffer: Buffer.from('{"pages":{},"startGrid":"missing"}')
	});
	await expect(page.getByRole('alert')).toContainText('דף פתיחה קיים');
	await expect(page.getByTestId('grid-source')).toContainText('b037.gridset');

	await page.locator('input[type=file]').setInputFiles({
		name: 'valid.json',
		mimeType: 'application/json',
		buffer: readFileSync('src/routes/grid/__fixtures__/sample-gridset.json')
	});
	await expect(page.getByTestId('grid-source')).toContainText('valid.json');
	await expect(page.getByText('פריט-בדיקה')).toBeVisible();
});
test('14 delayed auto-fetch loses to manual upload and successful second load clears editing', async ({
	page
}) => {
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route('**/org-1.gridset', async (route) => {
		await gate;
		await route.fulfill({ body: Buffer.from(readFileSync('static/org-1.gridset')) });
	});
	const request = page.waitForRequest('**/org-1.gridset');
	await page.goto('/grid', { waitUntil: 'domcontentloaded' });
	await request;
	await upload(page, synthetic(), 'manual.gridset');
	release();
	await page.waitForTimeout(200);
	await expect(page.getByTestId('grid-source')).toContainText('manual.gridset');
	await edit(page);
	await select(page, 0, 0).click();
	await upload(page, synthetic(), 'next.gridset');
	await expect(page.getByTestId('edit-cell')).toHaveCount(0);
	await expect(page.getByTestId('grid-dirty')).toContainText('ללא שינויים');
});
test('15 live build at demo viewports: editor accessibility, screenshots and no horizontal overflow', async ({
	page
}) => {
	await start(page);
	await upload(page, synthetic());
	await edit(page);
	await select(page, 0, 0).click();
	for (const [width, height] of [
		[1920, 1080],
		[1024, 768]
	]) {
		await page.setViewportSize({ width, height });
		await expect(page.getByLabel('כתובית', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'בטל שינוי זה', exact: true })).toBeVisible();
		await page.mouse.move(0, 0);
		await page.screenshot({ path: resolve(artifacts, `editor-${width}.png`) });
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
	}
});
test('draft modal apply/cancel/stay keeps selection, controls and load warnings coherent', async ({
	page
}) => {
	await start(page);
	await upload(page, synthetic());
	await edit(page);
	await select(page, 0, 0).click();
	await page.getByLabel('כתובית', { exact: true }).fill('draft');
	await select(page, 1, 0).click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'הישאר', exact: true }).click();
	await expect(select(page, 0, 0)).toHaveAttribute('aria-pressed', 'true');
	await page.getByLabel('דף', { exact: true }).selectOption('Q');
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'הישאר', exact: true }).click();
	await expect(page.getByLabel('דף', { exact: true })).toHaveValue('P');
	await select(page, 1, 0).click();
	await dialog.getByRole('button', { name: 'החל', exact: true }).click();
	await expect(cell(page, 0, 0)).toContainText('draft');
	await page.locator('input[type=file]').setInputFiles({
		name: 'new.gridset',
		mimeType: 'application/zip',
		buffer: Buffer.from(synthetic())
	});
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'הישאר', exact: true }).click();
	await expect(page.getByTestId('grid-source')).toContainText('probe.gridset');
});

test('F1 org-3 non-home repeated preview cancel apply and mode changes stay stable', async ({
	page
}) => {
	await start(page);
	await upload(page, readFileSync('static/org-3.gridset'), 'org-3.gridset');
	await page.getByText('לאכול', { exact: true }).click();
	await expect(page.getByText('לחם', { exact: true })).toBeVisible();
	await edit(page);
	const name = await page.getByLabel('דף', { exact: true }).inputValue();
	await select(page, 0, 0).click();
	for (const value of ['#123456FF', '#65432180']) {
		await page.getByLabel('מילוי תא', { exact: true }).fill(value);
		await page.waitForTimeout(300);
		await expect(page.getByLabel('דף', { exact: true })).toHaveValue(name);
	}
	await page.getByRole('button', { name: 'בטל שינוי זה', exact: true }).click();
	await page.getByLabel('מילוי תא', { exact: true }).fill('#123456FF');
	await page.getByRole('button', { name: 'החל', exact: true }).click();
	await page.getByRole('button', { name: 'שימוש', exact: true }).click();
	await page.waitForTimeout(2500);
	await expect(page.getByText('לחם', { exact: true })).toBeVisible();
	await edit(page);
	await expect(page.getByLabel('דף', { exact: true })).toHaveValue(name);
});

test('pixel evidence: four separate colour surfaces, baseline preview cancel and UI reopen', async ({
	page
}) => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	await start(page);
	await upload(page, readFileSync('static/b037.gridset'), 'b037.gridset');
	const states: Record<string, unknown> = {};
	const capture = async (name: string) => {
		await page.mouse.move(0, 0);
		await page.waitForTimeout(100);
		states[name] = await cell(page, 0, 4).evaluate((el) => {
			const r = el.getBoundingClientRect();
			const label = el.querySelector('[data-testid=cell-caption]');
			const lr = label?.getBoundingClientRect();
			const style = getComputedStyle(el);
			return {
				cell: { x: r.x, y: r.y, width: r.width, height: r.height },
				label: lr ? { x: lr.x, y: lr.y, width: lr.width, height: lr.height } : null,
				background: style.backgroundImage,
				border: style.borderColor,
				font: style.color,
				borderWidth: style.borderWidth
			};
		});
		await page.screenshot({ path: resolve(artifacts, `pixels-${name}.png`) });
	};
	await capture('baseline');
	await edit(page);
	await select(page, 0, 4).click();
	for (const [label, value] of Object.entries(colours))
		await page.getByLabel(label, { exact: true }).fill(value);
	await capture('preview');
	await page.getByRole('button', { name: 'בטל שינוי זה', exact: true }).click();
	await page.getByRole('button', { name: 'שימוש', exact: true }).click();
	await capture('cancel');
	await edit(page);
	await select(page, 0, 4).click();
	for (const [label, value] of Object.entries(colours))
		await page.getByLabel(label, { exact: true }).fill(value);
	const d = await save(page, 'b037-pixel-ui-edited.gridset');
	await reopen(page, d);
	await capture('reopen');
	writeFileSync(resolve(artifacts, 'pixel-geometry.json'), JSON.stringify(states, null, 2));
});
