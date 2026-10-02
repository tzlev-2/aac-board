import { readFileSync, writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { buildGridset } from '../src/lib/gridset/__fixtures__/buildGridset';
import { readZipIndex } from '../src/lib/gridset/zipArchive';
import { crc32 } from '../src/lib/gridset/crc32';
import { test, expect, saveUIBlob } from './owned-browser';

const fixture = buildGridset({
	startGrid: 'P',
	language: 'he',
	styles: [
		{
			key: 'shared',
			backColour: '#FFFFFFFF',
			tileColour: '#00000000',
			fontColour: '#000000FF',
			borderColour: '#000000FF'
		}
	],
	pages: [
		{
			name: 'P',
			columns: 3,
			rows: 2,
			cells: [
				{ x: 0, y: 0, columnSpan: 3, contentType: 'Workspace', contentSubType: 'Chat' },
				{
					x: 0,
					y: 1,
					basedOnStyle: 'shared',
					caption: 'word',
					commands: [{ id: 'Action.InsertText', params: { text: 'word' } }]
				},
				{
					x: 1,
					y: 1,
					basedOnStyle: 'shared',
					caption: 'next',
					commands: [{ id: 'Jump.To', params: { grid: 'Q' } }]
				},
				{
					x: 2,
					y: 1,
					basedOnStyle: 'shared',
					caption: 'speak',
					commands: [{ id: 'Action.Speak', params: { unit: 'All' } }]
				}
			]
		},
		{
			name: 'Q',
			columns: 2,
			rows: 1,
			cells: [
				{ x: 0, y: 0, basedOnStyle: 'shared', caption: 'back', commands: [{ id: 'Jump.Back' }] },
				{ x: 1, y: 0, basedOnStyle: 'shared', caption: 'second' }
			]
		}
	]
});

for (const viewport of [
	{ width: 1280, height: 900 },
	{ width: 360, height: 800 },
	{ width: 390, height: 844 },
	{ width: 844, height: 390 },
	{ width: 768, height: 1024 }
]) {
	test.describe(`${viewport.width}x${viewport.height} root`, () => {
		test.use({
			viewport,
			deviceScaleFactor: viewport.width === 1280 ? 1 : 2,
			isMobile: viewport.width !== 1280,
			hasTouch: viewport.width !== 1280
		});
		test('navigation, output, caption/four colors, ZIP save/reopen and RTL', async ({
			page
		}, info) => {
			const errors: string[] = [];
			page.on('pageerror', (e) => errors.push(e.message));
			await page.goto('/');
			await expect(page).toHaveURL(/\/$/);
			await expect(page.getByTestId('grid-source')).toContainText('org-1.gridset');
			await page.locator('input[type=file]').setInputFiles({
				name: 'root-probe.gridset',
				mimeType: 'application/octet-stream',
				buffer: Buffer.from(fixture)
			});
			await expect(page.getByTestId('grid-source')).toContainText('root-probe.gridset');
			await page.getByText('word', { exact: true }).click();
			await expect(page.getByTestId('chat-cell')).toContainText('word');
			await page.getByText('next', { exact: true }).click();
			await expect(page.getByText('second', { exact: true })).toBeVisible();
			await page.getByText('back', { exact: true }).click();
			await page.getByRole('button', { name: 'עריכה', exact: true }).click();
			await page.locator('[data-testid=edit-cell][data-cell-x="0"][data-cell-y="1"]').click();
			await page.getByLabel('כתובית', { exact: true }).fill('edited root');
			const colors = {
				'מילוי תא': '#227744FF',
				מסגרת: '#DD3322FF',
				'רקע אחורי של התא': '#3355AAFF',
				'צבע כיתוב': '#FFBB22FF'
			};
			for (const [label, value] of Object.entries(colors))
				await page.getByLabel(label, { exact: true }).fill(value);
			await page.getByRole('button', { name: 'החל', exact: true }).click();
			await expect(page.getByTestId('grid-dirty')).toContainText('יש שינויים');
			const wait = page.waitForEvent('download');
			await page.getByRole('button', { name: 'שמור עותק', exact: true }).click();
			const download = await wait;
			const path = info.outputPath(download.suggestedFilename());
			await saveUIBlob(page, download, path);
			const bytes = new Uint8Array(readFileSync(path));
			const index = readZipIndex(bytes);
			const unpacked = unzipSync(bytes);
			for (const entry of index.entries) expect(crc32(unpacked[entry.name])).toBe(entry.crc);
			const xml = Object.entries(unpacked).find(([name]) => name === 'Grids/P/grid.xml')![1];
			expect(strFromU8(xml)).toContain('edited root');
			for (const value of Object.values(colors)) expect(strFromU8(xml)).toContain(value);
			await page.locator('input[type=file]').setInputFiles(path);
			await expect(page.getByTestId('grid-source')).toContainText('root-probe-edited.gridset');
			await page.getByRole('button', { name: 'עריכה', exact: true }).click();
			await page.locator('[data-testid=edit-cell][data-cell-x="0"][data-cell-y="1"]').click();
			await expect(page.getByLabel('כתובית', { exact: true })).toHaveValue('edited root');
			for (const [label, value] of Object.entries(colors))
				await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
			const metrics = await page.evaluate(() => ({
				dpr: devicePixelRatio,
				touch: navigator.maxTouchPoints,
				rtl: getComputedStyle(document.querySelector('.grid-page')!).direction,
				width: innerWidth,
				scrollWidth: document.documentElement.scrollWidth
			}));
			expect(metrics.rtl).toBe('rtl');
			expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
			writeFileSync(info.outputPath('metrics.json'), JSON.stringify(metrics, null, 2));
			await page.screenshot({ path: info.outputPath('root-reopened.png'), fullPage: true });
			expect(errors).toEqual([]);
		});
	});
}

test('removed routes return 404; grid remains compatible', async ({ page, request }) => {
	for (const path of [
		'/sets',
		'/s/old',
		'/s/old/b/board',
		'/s/old/b/board/edit',
		'/demo',
		'/demo/playwright'
	])
		expect((await request.get(path)).status()).toBe(404);
	await page.goto('/grid');
	await expect(page).toHaveURL(/\/grid$/);
	await expect(page.getByTestId('grid-source')).toContainText('org-1.gridset');
});

test('worker upgrade keeps unrelated caches and IDB, offline root cannot resurrect legacy HTML', async ({
	page,
	context
}) => {
	await page.addInitScript(() => {
		const original = navigator.serviceWorker.register.bind(navigator.serviceWorker);
		Object.assign(window, { registerCandidateSW: original });
		navigator.serviceWorker.register = () =>
			Promise.reject(new Error('defer auto-registration for upgrade fixture'));
	});
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	await page.evaluate(async () => {
		const old = await caches.open('aac-board-old');
		await old.put('/', new Response('<html>LEGACY BOARD</html>'));
		await old.put('/s/old', new Response('LEGACY ROUTE'));
		const other = await caches.open('external-preserved');
		await other.put('/sentinel', new Response('user cache'));
		const db = await new Promise<IDBDatabase>((resolve) => {
			const r = indexedDB.open('keyval-store', 1);
			r.onupgradeneeded = () => r.result.createObjectStore('keyval');
			r.onsuccess = () => resolve(r.result);
		});
		await new Promise<void>((resolve) => {
			const t = db.transaction('keyval', 'readwrite');
			t.objectStore('keyval').put({ preserve: true }, 'board:sentinel');
			t.oncomplete = () => resolve();
		});
		db.close();
		const registration = await (window as any).registerCandidateSW('/service-worker.js');
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller)
			await new Promise<void>((resolve) =>
				navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
					once: true
				})
			);
	});
	expect(await page.evaluate(() => caches.keys())).not.toContain('aac-board-old');
	expect(
		await page.evaluate(async () =>
			(await (await caches.open('external-preserved')).match('/sentinel'))?.text()
		)
	).toBe('user cache');
	await page.reload();
	await expect(page.getByTestId('grid-source')).toContainText('org-1.gridset');
	await context.setOffline(true);
	await page.reload();
	await expect(page.getByTestId('grid-source')).toContainText('org-1.gridset');
	await page.goto('/s/old');
	await expect(page.getByText('אין חיבור לאינטרנט', { exact: true })).toBeVisible();
	await expect(page.getByText('LEGACY BOARD')).toHaveCount(0);
	await expect(page.getByText('LEGACY ROUTE')).toHaveCount(0);
	await context.setOffline(false);
	expect(
		await page.evaluate(async () => {
			const db = await new Promise<IDBDatabase>((resolve) => {
				const r = indexedDB.open('keyval-store');
				r.onsuccess = () => resolve(r.result);
			});
			const value = await new Promise((resolve) => {
				const r = db.transaction('keyval').objectStore('keyval').get('board:sentinel');
				r.onsuccess = () => resolve(r.result);
			});
			db.close();
			return value;
		})
	).toEqual({ preserve: true });
});

test('runtime reads current TTS preferences for each speak action', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByTestId('grid-source')).toContainText('org-1.gridset');
	await page.locator('input[type=file]').setInputFiles({
		name: 'speech.gridset',
		mimeType: 'application/octet-stream',
		buffer: Buffer.from(fixture)
	});
	await expect(page.getByTestId('grid-source')).toContainText('speech.gridset');
	await page.evaluate(() => {
		Object.assign(window, { speechCalls: [] });
		speechSynthesis.speak = (u) => {
			(window as any).speechCalls.push({
				text: u.text,
				rate: Number(u.rate.toFixed(3)),
				pitch: Number(u.pitch.toFixed(3))
			});
			u.onend?.(new Event('end') as SpeechSynthesisEvent);
		};
		localStorage.setItem(
			'tts-settings',
			JSON.stringify({ provider: 'webspeech', rate: 1.1, pitch: 0.8 })
		);
	});
	await page.getByText('word', { exact: true }).click();
	await page.getByText('speak', { exact: true }).click();
	await expect
		.poll(() => page.evaluate(() => (window as any).speechCalls))
		.toEqual([{ text: 'word', rate: 1.1, pitch: 0.8 }]);
	await page.evaluate(() =>
		localStorage.setItem(
			'tts-settings',
			JSON.stringify({ provider: 'webspeech', rate: 1.5, pitch: 1.2 })
		)
	);
	await page.getByText('speak', { exact: true }).click();
	await expect.poll(() => page.evaluate(() => (window as any).speechCalls.length)).toBe(2);
	expect(await page.evaluate(() => (window as any).speechCalls[1])).toEqual({
		text: 'word',
		rate: 1.5,
		pitch: 1.2
	});
});

test('PCS requests stay same-origin; missing local R2 is reported without claiming licensed image display', async ({
	page,
	request
}) => {
	const invalid = await request.get('/img/pcs/not-in-manifest');
	expect(invalid.status()).toBe(404);
	const valid = await request.get('/img/pcs/10078');
	expect(valid.status()).toBe(404);
	expect(await valid.text()).toContain('הסמל אינו בדלי');
	await page.goto('/');
	await expect(page.getByTestId('grid-source')).toContainText('org-1.gridset');
	const calls: string[] = [];
	page.on('request', (r) => {
		if (r.url().includes('/img/pcs/')) calls.push(r.url());
	});
	await page.getByRole('button', { name: /^לוח עם סמלי PCS/ }).click();
	await expect(page.getByTestId('grid-source')).toContainText('org-3.gridset');
	await expect.poll(() => calls.length).toBeGreaterThan(0);
	for (const url of calls) expect(new URL(url).origin).toBe(new URL(page.url()).origin);
	await page.getByText('לאכול', { exact: true }).click();
	await expect(page.getByText('לחם', { exact: true })).toBeVisible();
});
