import { buildGridset } from '../src/lib/gridset/__fixtures__/buildGridset';
import { messages, colourLabels } from '../src/routes/grid/editor-messages';
import { test, expect, type Page } from './owned-browser';

const fixture = buildGridset({
	startGrid: 'P',
	language: 'he',
	styles: [{ key: 'shared', backColour: '#FFFFFFFF', tileColour: '#00000000' }],
	pages: [
		{
			name: 'P',
			columns: 6,
			rows: 4,
			cells: [
				{ x: 0, y: 0, columnSpan: 6, contentType: 'Workspace', contentSubType: 'Chat' },
				...Array.from({ length: 18 }, (_, i) => ({
					x: i % 6,
					y: 1 + Math.floor(i / 6),
					caption: `cell-${i}`,
					basedOnStyle: 'shared',
					commands: [{ id: 'Action.InsertText', params: { text: `word-${i}` } }]
				}))
			]
		}
	]
});

test.use({
	viewport: { width: 360, height: 800 },
	deviceScaleFactor: 2,
	isMobile: true,
	hasTouch: true
});

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
	await expect(page.getByTestId('chat-cell')).toContainText('word-5');
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
		BackColour: '#227744FF',
		BorderColour: '#DD3322FF',
		TileColour: '#3355AAFF',
		FontColour: '#FFBB22FF'
	} as const;
	for (const field of Object.keys(colours) as (keyof typeof colours)[]) {
		await page.getByLabel(colourLabels[field], { exact: true }).fill(colours[field]);
	}
	await page.getByRole('button', { name: messages.apply, exact: true }).tap();
	const edited = await geometry(page);
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: messages.save, exact: true }).tap();
	await download;
	// The existing fixture captures UI ZIP bytes. Native disk delivery is checked
	// separately in the executor's product receipt; this test covers layout persistence.
	const bytes = await page.evaluate(
		() => (window as unknown as { uiZipBytes: Promise<number[]> }).uiZipBytes
	);
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
		state.cells.forEach((cell, i) => {
			expect(cell.width).toBeCloseTo(baseline.cells[i].width, 1);
			expect(cell.left).toBeCloseTo(baseline.cells[i].left, 1);
		});
	}
});

test.describe('390px existing geometry', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('editing preserves the existing 44px visual cell width', async ({ page }) => {
		await page.goto('/');
		await page.locator('input[type=file]').setInputFiles({
			name: 'six-column.gridset',
			mimeType: 'application/zip',
			buffer: Buffer.from(fixture)
		});
		await expect(page.getByTestId('grid-source')).toContainText('six-column.gridset');
		await page.getByRole('button', { name: messages.edit, exact: true }).tap();
		const state = await geometry(page);
		for (const container of state.containers) expect(container.scroll).toBe(container.client);
		for (const cell of state.cells.slice(1)) expect(cell.width).toBeCloseTo(44, 1);
	});
});
