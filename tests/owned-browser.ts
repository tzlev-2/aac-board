import { test as base, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import type { Page, Download } from '@playwright/test';

// Optional connection to the existing GUI; each test still owns an isolated context.
export const test = base.extend({
	page: async ({ page }, use) => {
		await page.addInitScript(() => {
			const create = URL.createObjectURL.bind(URL);
			URL.createObjectURL = (blob) => {
				if (blob instanceof Blob && blob.type === 'application/zip') {
					(window as unknown as { uiZipBytes: Promise<number[]> }).uiZipBytes = blob
						.arrayBuffer()
						.then((bytes) => Array.from(new Uint8Array(bytes)));
				}
				return create(blob);
			};
		});
		await use(page);
	},
	browser: [
		async ({ playwright, browserName, launchOptions, headless, channel }, use) => {
			const connected = process.env.AAC_CDP_URL
				? await playwright.chromium.connectOverCDP(process.env.AAC_CDP_URL)
				: await playwright[browserName].launch({ ...launchOptions, headless, channel });
			try {
				await use(connected);
			} finally {
				await connected.close();
			}
		},
		{ scope: 'worker' }
	]
});
export { expect };
export type { Page, Download } from '@playwright/test';

// Capture the exact ZIP handed by the real UI to createObjectURL before revocation.
// The browser's native event supplies the filename. Its filesystem outcome is recorded.
export async function saveUIBlob(page: Page, download: Download, path: string) {
	const bytes = await page.evaluate(
		() => (window as unknown as { uiZipBytes: Promise<number[]> }).uiZipBytes
	);
	if (!bytes || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
		throw new Error('UI did not produce a ZIP Blob');
	writeFileSync(path, Buffer.from(bytes));
	writeFileSync(
		path + '.download.json',
		JSON.stringify(
			{
				filename: download.suggestedFilename(),
				url: download.url(),
				browserFailure: await download.failure(),
				bytes: bytes.length,
				transport: 'exact UI application/zip Blob; physical browser save not asserted'
			},
			null,
			2
		)
	);
	return { suggestedFilename: () => download.suggestedFilename(), path: async () => path };
}
export type SavedUICopy = Awaited<ReturnType<typeof saveUIBlob>>;
