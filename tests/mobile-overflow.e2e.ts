import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { buildGridset } from '../src/lib/gridset/__fixtures__/buildGridset';
import { messages, colourLabels } from '../src/routes/grid/editor-messages';
import { test, expect, type Page } from './owned-browser';

const fixture = buildGridset({
	startGrid: 'Main',
	language: 'he',
	styles: [{ key: 's', backColour: '#FFFFFFFF', tileColour: '#00000000' }],
	pages: [
		{
			name: 'Main',
			columns: 6,
			rows: 4,
			cells: [
				{ x: 0, y: 0, columnSpan: 6, contentType: 'Workspace', contentSubType: 'Chat' },
				...Array.from({ length: 18 }, (_, i) => ({
					x: i % 6,
					y: 1 + Math.floor(i / 6),
					caption: i === 0 ? 'FIRST' : `cell-${i}`,
					basedOnStyle: 's',
					commands: [{ id: 'Action.InsertText', params: { text: `output-${i}` } }]
				}))
			]
		},
		{
			name: 'Words',
			columns: 3,
			rows: 2,
			cells: [
				{ x: 0, y: 0, columnSpan: 3, contentType: 'Workspace', contentSubType: 'Chat' },
				...Array.from({ length: 3 }, (_, x) => ({
					x,
					y: 1,
					contentType: 'AutoContent',
					contentSubType: 'WordList'
				}))
			],
			wordList: Array.from({ length: 8 }, (_, i) => ({ text: `vocabulary-${i}` })),
			autoContentCommands: { WordList: [{ id: 'Action.InsertText' }] }
		}
	]
});

// Hash the ZIP payloads, excluding the ZIP builder's varying timestamp metadata.
// This is the exact controlled model in the accepted H1 native geometry receipt.
const fixturePayloadHash = createHash('sha256')
	.update(
		JSON.stringify(
			Object.entries(unzipSync(fixture)).map(([name, bytes]) => [name, Array.from(bytes)])
		)
	)
	.digest('hex');

test.use({
	viewport: { width: 360, height: 800 },
	deviceScaleFactor: 2,
	isMobile: true,
	hasTouch: true
});

async function expectRemainingFill(page: Page) {
	const result = await page.evaluate(() => {
		const shell = document.querySelector<HTMLElement>('.application-shell')!;
		shell.scrollTo(0, 0);
		const root = document.querySelector<HTMLElement>('.grid-page')!;
		const board = document.querySelector<HTMLElement>('.board')!;
		const status = document.querySelector<HTMLElement>('.session-status')!;
		const r = board.getBoundingClientRect(),
			pageRect = root.getBoundingClientRect();
		const css = getComputedStyle(root);
		return {
			available:
				shell.clientHeight -
				(r.top - pageRect.top) -
				parseFloat(css.paddingBottom) -
				status.getBoundingClientRect().height,
			height: r.height,
			shellExcess: shell.scrollHeight - shell.clientHeight
		};
	});
	expect(Math.abs(result.height - result.available)).toBeLessThanOrEqual(1);
	expect(result.shellExcess).toBeLessThanOrEqual(1);
}

async function geometry(page: Page) {
	return page.evaluate(() => {
		const bounds = (el: Element) => {
			const r = el.getBoundingClientRect();
			return { left: r.left, right: r.right, width: r.width, height: r.height };
		};
		const grid = document.querySelector('[data-testid=grid-board]')!;
		return {
			touch: navigator.maxTouchPoints,
			dpr: devicePixelRatio,
			rtl: getComputedStyle(grid).direction,
			grid: bounds(grid),
			containers: ['.grid-page', '.workspace', '.board', '.grid-wrap', '.grid'].map((s) => {
				const el = document.querySelector(s)!;
				return { selector: s, client: el.clientWidth, scroll: el.scrollWidth };
			}),
			cells: [...document.querySelectorAll('[data-testid=grid-cell]')].map(bounds),
			overlays: [...document.querySelectorAll('[data-testid=edit-cell]')].map(bounds)
		};
	});
}

test('360px touch editing keeps 44px targets inside the grid through save and reopen', async ({
	page
}) => {
	await page.goto('/');
	await page.locator('input[type=file]').setInputFiles({
		name: 'six-column.gridset',
		mimeType: 'application/zip',
		buffer: Buffer.from(fixture)
	});
	await expect(page.getByTestId('grid-source')).toContainText('six-column.gridset');
	const lastCell = page.locator('[data-testid=grid-cell][data-cell-x="5"][data-cell-y="1"]');
	await lastCell.tap();
	await expect(page.getByTestId('chat-cell')).toContainText('output-5');
	expect(fixturePayloadHash).toBe(
		'0d3427b281ce84b9cf09186615214acaa9c8910e1ccac15716243cec1850cb91'
	);
	await expectRemainingFill(page);
	const baseline = await geometry(page);
	await page.getByRole('button', { name: messages.edit, exact: true }).tap();
	const lastOverlay = page.locator('[data-testid=edit-cell][data-cell-x="5"][data-cell-y="1"]');
	await lastOverlay.scrollIntoViewIfNeeded();
	const edge = await lastOverlay.evaluate((el) => {
		const r = el.getBoundingClientRect();
		const x = r.left + 1;
		const y = r.top + r.height / 2;
		return { x, y, containsHit: el.contains(document.elementFromPoint(x, y)) };
	});
	expect(edge.containsHit).toBe(true);
	await page.touchscreen.tap(edge.x, edge.y);
	await expect(lastOverlay).toHaveAttribute('aria-pressed', 'true');
	const colours = {
		BackColour: '#225577FF',
		BorderColour: '#AA3333FF',
		TileColour: '#448844FF',
		FontColour: '#FFAA22FF'
	} as const;
	for (const field of Object.keys(colours) as (keyof typeof colours)[]) {
		await page.getByLabel(colourLabels[field], { exact: true }).fill(colours[field]);
	}
	await page.getByRole('button', { name: messages.apply, exact: true }).tap();
	const edited = await geometry(page);
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: messages.save, exact: true }).tap();
	await download;
	await page.getByRole('button', { name: messages.use, exact: true }).tap();
	await expectRemainingFill(page);
	// The existing fixture captures UI ZIP bytes. Native disk delivery is checked
	// separately in the executor's product receipt; this test covers layout persistence.
	const bytes = await page.evaluate(
		() => (window as unknown as { uiZipBytes: Promise<number[]> }).uiZipBytes
	);
	await page.getByRole('link', { name: messages.selector, exact: true }).click();
	await page.locator('input[type=file]').setInputFiles({
		name: 'six-column-edited.gridset',
		mimeType: 'application/zip',
		buffer: Buffer.from(bytes)
	});
	await expect(page.getByTestId('grid-source')).toContainText('six-column-edited.gridset');
	await page.getByRole('button', { name: messages.edit, exact: true }).tap();
	await lastOverlay.tap();
	for (const field of Object.keys(colours) as (keyof typeof colours)[]) {
		await expect(page.getByLabel(colourLabels[field], { exact: true })).toHaveValue(colours[field]);
	}
	const reopened = await geometry(page);
	for (const state of [baseline, edited, reopened]) {
		expect(state.touch).toBe(1);
		expect(state.dpr).toBeCloseTo(2);
		expect(state.rtl).toBe('rtl');
		for (const container of state.containers) expect(container.scroll).toBe(container.client);
		for (const target of [...state.cells, ...state.overlays]) {
			expect(target.left).toBeGreaterThanOrEqual(state.grid.left);
			expect(target.right).toBeLessThanOrEqual(state.grid.right + 0.1);
		}
		for (const overlay of state.overlays) {
			expect(overlay.width).toBeGreaterThanOrEqual(44);
			expect(overlay.height).toBeGreaterThanOrEqual(44);
		}
	}
	// Use and edit have different container heights, hence different cqh gutters.
	// Compare persistence at matching edit/reopen dimensions; independent native
	// receipts compare H1/candidate renderers at both old and new container sizes.
	reopened.cells.forEach((cell, i) => {
		expect(cell.width).toBeCloseTo(edited.cells[i].width, 1);
		expect(cell.left).toBeCloseTo(edited.cells[i].left, 1);
	});
});

test.describe('390px existing geometry', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('edited H1 fixture keeps its measured 11px internal extent and native edge targets', async ({
		page
	}) => {
		await page.goto('/');
		await page.locator('input[type=file]').setInputFiles({
			name: 'six-column.gridset',
			mimeType: 'application/zip',
			buffer: Buffer.from(fixture)
		});
		await expect(page.getByTestId('grid-source')).toContainText('six-column.gridset');
		await page.getByRole('button', { name: messages.edit, exact: true }).tap();
		expect(fixturePayloadHash).toBe(
			'0d3427b281ce84b9cf09186615214acaa9c8910e1ccac15716243cec1850cb91'
		);
		const target = page.locator('[data-testid=edit-cell][data-cell-x="5"][data-cell-y="1"]');
		await target.tap();
		await page.getByLabel(messages.caption, { exact: true }).fill('native-390x844');
		for (const [field, value] of Object.entries({
			BackColour: '#225577FF',
			BorderColour: '#AA3333FF',
			TileColour: '#448844FF',
			FontColour: '#FFAA22FF'
		})) {
			await page
				.getByLabel(colourLabels[field as keyof typeof colourLabels], { exact: true })
				.fill(value);
		}
		await page.getByRole('button', { name: messages.apply, exact: true }).tap();
		const state = await geometry(page);
		for (const container of state.containers) {
			const internal = ['.board', '.grid-wrap', '.grid'].includes(container.selector);
			expect(container.scroll - container.client).toBeLessThanOrEqual(internal ? 12 : 1);
		}
		for (const overlay of state.overlays) {
			expect(overlay.width).toBeGreaterThanOrEqual(44);
			expect(overlay.height).toBeGreaterThanOrEqual(44);
		}
		await target.scrollIntoViewIfNeeded();
		const edge = await target.evaluate((el) => {
			const r = el.getBoundingClientRect();
			const x = r.left + 1,
				y = r.top + r.height / 2;
			return { x, y, hit: el.contains(document.elementFromPoint(x, y)) };
		});
		expect(edge.hit).toBe(true);
		await page.touchscreen.tap(edge.x, edge.y);
		await expect(target).toHaveAttribute('aria-pressed', 'true');
	});
});
