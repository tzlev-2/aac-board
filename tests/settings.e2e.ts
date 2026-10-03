import { test, expect } from './owned-browser';
import {
	DEFAULT_GEMINI_TTS_MODEL,
	DEFAULT_ELEVENLABS_TTS_MODEL
} from '../src/lib/services/tts-providers/provider-models';

for (const [provider, model] of [
	['Gemini', DEFAULT_GEMINI_TTS_MODEL],
	['ElevenLabs', DEFAULT_ELEVENLABS_TTS_MODEL]
]) {
	test(`${provider} model persists after reopening Clone settings`, async ({ page }) => {
		await page.goto('/settings');
		await page.getByRole('button', { name: provider, exact: true }).click();
		const select = page.locator('label.field', { hasText: 'מודל' }).locator('select');
		await expect(select).toHaveValue(model);
		await page.reload();
		await expect(select).toHaveValue(model);
		await page.getByRole('button', { name: 'כהה', exact: true }).click();
		await expect.poll(() => page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
		await page.reload();
		await expect(page.locator('html')).toHaveClass(/dark/);
		await expect(select).toHaveValue(model);
		await expect(page.getByTestId('attribution')).toContainText('ARASAAC');
		await expect(page.locator('a[href="/sets"]')).toHaveCount(0);
		await page.getByRole('link', { name: 'חזרה לבחירת יישום' }).click();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.locator('input[type=file]')).toBeVisible();
	});
}

test('plain visits preserve preferences, unknown fields, legacy user records and caches', async ({
	page
}) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	const before = await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open('keyval-store', 1);
			request.onupgradeneeded = () => request.result.createObjectStore('keyval');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
		const settings = {
			ttsProvider: 'gemini',
			ttsModel: 'saved-unlisted-model',
			ttsVoice: 'saved-unlisted-voice',
			ttsRate: 1.3,
			ttsPitch: 0.7,
			theme: 'dark',
			tileSize: 'large',
			futurePreference: { preserve: true }
		};
		const records = {
			'app-settings': settings,
			'board:old': { tiles: ['sentinel'] },
			'set:old': { boards: ['old'] },
			'boards-index': ['old'],
			'sets-index': ['old'],
			'default-set-id': 'old',
			unknownLegacy: { preserve: true }
		};
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction('keyval', 'readwrite');
			for (const [key, value] of Object.entries(records)) tx.objectStore('keyval').put(value, key);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
		const cacheDb = await new Promise<IDBDatabase>((resolve) => {
			const r = indexedDB.open('aac-cache', 1);
			r.onupgradeneeded = () => r.result.createObjectStore('keyval');
			r.onsuccess = () => resolve(r.result);
		});
		await new Promise<void>((resolve) => {
			const tx = cacheDb.transaction('keyval', 'readwrite');
			const s = tx.objectStore('keyval');
			s.put({ url: 'sentinel-symbol', preserve: true }, 'symbol:sentinel');
			s.put(new Blob(['sentinel-audio'], { type: 'audio/wav' }), 'audio:sentinel');
			s.put(true, 'cache-proxy-migrated:v1');
			tx.oncomplete = () => resolve();
		});
		cacheDb.close();
		const tts = JSON.stringify({
			provider: 'gemini',
			modelId: 'saved-unlisted-model',
			voiceURI: 'saved-unlisted-voice',
			rate: 1.3,
			pitch: 0.7,
			extra: 'preserve'
		});
		localStorage.setItem('tts-settings', tts);
		localStorage.setItem('theme', 'dark');
		const cache = await caches.open('unrelated-user-cache');
		await cache.put('/sentinel', new Response('preserve'));
		return { records, tts };
	});
	await page.reload();
	await page.getByRole('link', { name: 'הגדרות', exact: true }).click();
	await expect(page.locator('label.field', { hasText: 'מודל' }).locator('select')).toHaveValue(
		'saved-unlisted-model'
	);
	await expect(page.locator('label.field', { hasText: /^קול/ }).locator('select')).toHaveValue(
		'saved-unlisted-voice'
	);
	await page.reload();
	await expect(page.locator('html')).toHaveClass(/dark/);
	const after = await page.evaluate(async () => {
		const db = await new Promise<IDBDatabase>((resolve) => {
			const r = indexedDB.open('keyval-store', 1);
			r.onsuccess = () => resolve(r.result);
		});
		const records = await new Promise<Record<string, unknown>>((resolve) => {
			const out: Record<string, unknown> = {};
			const r = db.transaction('keyval').objectStore('keyval').openCursor();
			r.onsuccess = () => {
				const c = r.result;
				if (c) {
					out[String(c.key)] = c.value;
					c.continue();
				} else resolve(out);
			};
		});
		db.close();
		const cacheDb = await new Promise<IDBDatabase>((resolve) => {
			const r = indexedDB.open('aac-cache', 1);
			r.onsuccess = () => resolve(r.result);
		});
		const read = (key: string) =>
			new Promise<any>((resolve) => {
				const r = cacheDb.transaction('keyval').objectStore('keyval').get(key);
				r.onsuccess = () => resolve(r.result);
			});
		const cacheData = {
			symbol: await read('symbol:sentinel'),
			audio: await ((await read('audio:sentinel')) as Blob).text(),
			migrated: await read('cache-proxy-migrated:v1')
		};
		cacheDb.close();
		return {
			cacheData,
			records,
			tts: localStorage.getItem('tts-settings'),
			cache: await (await caches.open('unrelated-user-cache'))
				.match('/sentinel')
				.then((r) => r?.text())
		};
	});
	expect(after.records).toEqual(before.records);
	expect(after.tts).toBe(before.tts);
	expect(after.cache).toBe('preserve');
	expect(after.cacheData).toEqual({
		symbol: { url: 'sentinel-symbol', preserve: true },
		audio: 'sentinel-audio',
		migrated: true
	});
});

test('legacy TTS mirror without app-settings is read without changing provider or persisted bytes', async ({
	page
}) => {
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	const raw =
		'{"provider":"elevenlabs","modelId":"unlisted-model","voiceURI":"old-voice","rate":1.2,"pitch":0.8,"extra":true}';
	await page.evaluate((raw) => {
		localStorage.setItem('tts-settings', raw);
		localStorage.setItem('theme', 'dark');
	}, raw);
	await page.goto('/settings');
	await expect(page.locator('label.field', { hasText: 'מודל' }).locator('select')).toHaveValue(
		'unlisted-model'
	);
	await expect(page.locator('html')).toHaveClass(/dark/);
	expect(await page.evaluate(() => localStorage.getItem('tts-settings'))).toBe(raw);
});
