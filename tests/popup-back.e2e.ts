import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { buildPopupBackFixture } from '../src/lib/gridset/__fixtures__/popupBack';
import { messages, colourLabels } from '../src/routes/grid/editor-messages';
import { test, expect, type Page } from './owned-browser';

const artifacts = process.env.AAC_TEST_ARTIFACTS ?? '/tmp/aac-c6-popup-back';
mkdirSync(artifacts, { recursive: true });
const fixture = buildPopupBackFixture();
const fixturePath = `${artifacts}/popup-back-original.gridset`;
writeFileSync(fixturePath, fixture);
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
writeFileSync(
	`${artifacts}/fixture.json`,
	JSON.stringify(
		{
			sha256: sha(fixture),
			provenance:
				'Original synthetic C6 content; no licensed assets or PII; SelfClosing injected in Q XML only; deterministic ZIP timestamps',
			builder: 'src/lib/gridset/__fixtures__/popupBack.ts'
		},
		null,
		2
	)
);
const back = (page: Page) => page.getByRole('button', { name: messages.back, exact: true });
const cell = (page: Page, x: number, y = 1, edit = false) =>
	page.locator(
		`[data-testid=${edit ? 'edit-cell' : 'grid-cell'}][data-cell-x="${x}"][data-cell-y="${y}"]`
	);
const chat = (page: Page) => page.getByTestId('chat-cell');
async function at(page: Page, name: string) {
	await expect(cell(page, 0, 2)).toContainText(`${name}-מילה-`);
}
async function open(page: Page, path = fixturePath) {
	await page.goto('/');
	await page.locator('input[type=file]').setInputFiles(path);
	await expect(page.getByTestId('grid-source')).toBeVisible();
}
async function editQ(page: Page) {
	await page.getByRole('button', { name: messages.edit, exact: true }).click();
	await cell(page, 0, 1, true).click();
}

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => {
		const calls: string[] = [];
		Object.assign(window, { c6Speech: calls });
		window.speechSynthesis.speak = (utterance) => {
			calls.push(utterance.text);
			queueMicrotask(() => utterance.onend?.(new SpeechSynthesisEvent('end', { utterance })));
		};
	});
});

for (const viewport of [
	{ width: 1280, height: 900 },
	{ width: 360, height: 800 },
	{ width: 390, height: 844 }
]) {
	test.describe(`${viewport.width}px native`, () => {
		test.use({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
		test('manual previous-page Back, drafts, native Save Copy and same disk reopen', async ({
			page,
			browser
		}) => {
			const activate = async (locator: ReturnType<typeof back>) =>
				viewport.width < 500 ? locator.tap() : locator.click();
			await open(page);
			await at(page, 'P');
			await expect(back(page)).toHaveCount(0);
			await activate(cell(page, 2)); // self transition
			await activate(cell(page, 1, 3)); // missing target
			await expect(back(page)).toHaveCount(0);
			await activate(cell(page, 0));
			await at(page, 'Q');
			await activate(cell(page, 0));
			await expect(chat(page)).toContainText('שלום');
			await at(page, 'Q'); // no guessed SelfClosing auto-close
			const geometry = await back(page).evaluate((el) => {
				const r = el.getBoundingClientRect();
				return {
					width: r.width,
					height: r.height,
					left: r.left,
					right: r.right,
					viewport: innerWidth,
					rtl: getComputedStyle(el.closest('.grid-page')!).direction,
					touch: navigator.maxTouchPoints
				};
			});
			expect(geometry.width).toBeGreaterThanOrEqual(44);
			expect(geometry.height).toBeGreaterThanOrEqual(44);
			expect(geometry.rtl).toBe('rtl');
			expect(geometry.left).toBeGreaterThanOrEqual(0);
			expect(geometry.right).toBeLessThanOrEqual(viewport.width);
			if (viewport.width < 500) expect(geometry.touch).toBeGreaterThan(0);
			await page.screenshot({ path: `${artifacts}/Q-${viewport.width}.png` });
			await activate(cell(page, 2, 2)); // WordList next, not runtime Back
			await expect(cell(page, 0, 2)).toContainText('Q-מילה-2');
			await activate(cell(page, 0, 2));
			await expect(chat(page)).toContainText('Q-מילה-2');
			await activate(cell(page, 2, 3)); // explicit Speak
			await expect
				.poll(() =>
					page.evaluate(() => (window as unknown as { c6Speech: string[] }).c6Speech.length)
				)
				.toBe(1);
			await activate(cell(page, 1));
			await at(page, 'R');
			await activate(back(page));
			await at(page, 'Q');
			await expect(cell(page, 0, 2)).toContainText('Q-מילה-0'); // reset pager
			await back(page).focus();
			await page.keyboard.press('Enter');
			await at(page, 'P');
			await expect(back(page)).toHaveCount(0);
			await expect(page.getByTestId('grid-source')).toBeFocused();
			await expect(chat(page)).toContainText('שלום');
			await expect(chat(page)).toContainText('Q-מילה-2');
			expect(
				await page.evaluate(() => (window as unknown as { c6Speech: string[] }).c6Speech.length)
			).toBe(1); // Back adds no speech
			await activate(cell(page, 0));
			await editQ(page);
			await page.getByLabel(messages.caption, { exact: true }).fill('נשמר בקופץ');
			await back(page).click();
			await expect(back(page)).toBeDisabled();
			await page
				.getByRole('dialog')
				.getByRole('button', { name: messages.stay, exact: true })
				.click();
			await at(page, 'Q');
			await expect(page.getByLabel(messages.caption, { exact: true })).toHaveValue('נשמר בקופץ');
			await expect(back(page)).toBeFocused();
			await back(page).click();
			await page.keyboard.press('Escape');
			await at(page, 'Q');
			await expect(page.getByLabel(messages.caption, { exact: true })).toHaveValue('נשמר בקופץ');
			await back(page).click();
			await page
				.getByRole('dialog')
				.getByRole('button', { name: messages.apply, exact: true })
				.click();
			await at(page, 'P');
			await expect(page.getByTestId('grid-dirty')).toHaveText(messages.dirty);
			await expect(page.getByTestId('grid-source')).toBeFocused();
			await page.getByLabel(messages.page, { exact: true }).selectOption('Q');
			await cell(page, 0, 1, true).click();
			await expect(page.getByLabel(messages.caption, { exact: true })).toHaveValue('נשמר בקופץ');
			await page.getByLabel(messages.caption, { exact: true }).fill('טיוטה לביטול');
			await back(page).click();
			await page
				.getByRole('dialog')
				.getByRole('button', { name: messages.cancel, exact: true })
				.click();
			await at(page, 'P');
			await page.getByLabel(messages.page, { exact: true }).selectOption('Q');
			await cell(page, 0, 1, true).click();
			await expect(page.getByLabel(messages.caption, { exact: true })).toHaveValue('נשמר בקופץ');
			await page.getByLabel(colourLabels.FontColour, { exact: true }).fill('invalid');
			await back(page).click();
			await expect(
				page.getByRole('dialog').getByRole('button', { name: messages.apply, exact: true })
			).toBeDisabled();
			await page.keyboard.press('Escape');
			await expect(page.getByLabel(colourLabels.FontColour, { exact: true })).toHaveValue(
				'invalid'
			);
			await page.getByRole('button', { name: messages.cancel, exact: true }).click();
			await back(page).click(); // applied changes, no draft decision
			await at(page, 'P');
			await expect(page.getByRole('dialog')).toHaveCount(0);
			// Hold only the save's next-frame callback to inspect its busy guard.
			await page.getByLabel(messages.page, { exact: true }).selectOption('Q');
			await page.evaluate(() => {
				const original = requestAnimationFrame;
				Object.assign(window, {
					c6ReleaseFrame: () => {
						window.requestAnimationFrame = original;
					}
				});
				window.requestAnimationFrame = (callback) => {
					if (!callback.toString().includes('setTimeout')) return original(callback);
					window.requestAnimationFrame = original;
					Object.assign(window, {
						c6ReleaseFrame: () => {
							window.requestAnimationFrame = original;
							original(callback);
						}
					});
					return 0;
				};
			});
			await page.getByRole('button', { name: messages.save, exact: true }).click();
			await expect(back(page)).toBeDisabled();
			await back(page).evaluate((el: HTMLButtonElement) => el.click());
			await at(page, 'Q');
			// Native browser writes into the shared artifact directory; never reconstruct a Blob.
			const cdp = await browser.newBrowserCDPSession();
			const target = await page.context().newCDPSession(page);
			const { targetInfo } = await target.send('Target.getTargetInfo');
			const downloadDir = `/tmp/aac-c6-native-${viewport.width}-${Date.now()}`;
			await cdp.send('Browser.setDownloadBehavior', {
				behavior: 'allow',
				browserContextId: targetInfo.browserContextId,
				downloadPath: downloadDir,
				eventsEnabled: true
			});
			const completed = new Promise<{ filePath: string; receivedBytes: number }>(
				(resolve, reject) => {
					cdp.on('Browser.downloadProgress', (event) => {
						if (event.state === 'completed' && event.filePath)
							resolve({ filePath: event.filePath, receivedBytes: event.receivedBytes });
						if (event.state === 'canceled') reject(new Error('Native browser download canceled'));
					});
				}
			);
			const downloaded = page.waitForEvent('download');
			await page.evaluate(() =>
				(window as unknown as { c6ReleaseFrame: () => void }).c6ReleaseFrame()
			);
			const download = await downloaded;
			const native = await completed;
			expect(await download.failure()).toBeNull();
			await page.getByRole('link', { name: messages.selector, exact: true }).click();
			// Chrome's filesystem is separate from the agent. Reopen the completed native
			// file with CDP, then read its File bytes for a durable copy of that disk file.
			await page.evaluate(() => {
				const input = document.createElement('input');
				input.type = 'file';
				input.id = 'c6-native-disk-read';
				input.hidden = true;
				document.body.append(input);
			});
			const { root } = await target.send('DOM.getDocument');
			const { nodeId } = await target.send('DOM.querySelector', {
				nodeId: root.nodeId,
				selector: '#c6-native-disk-read'
			});
			await target.send('DOM.setFileInputFiles', { nodeId, files: [native.filePath] });
			const diskBytes = await page
				.locator('#c6-native-disk-read')
				.evaluate(async (input: HTMLInputElement) =>
					Array.from(new Uint8Array(await input.files![0].arrayBuffer()))
				);
			const saved = Buffer.from(diskBytes);
			expect(saved.length).toBe(native.receivedBytes);
			const savedPath = `${artifacts}/popup-back-saved-${viewport.width}.gridset`;
			writeFileSync(savedPath, saved);

			const before = unzipSync(fixture),
				after = unzipSync(saved);
			expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
			expect(strFromU8(after['Grids/Q/grid.xml'])).toContain('<SelfClosing>1</SelfClosing>');
			expect(strFromU8(after['Grids/Q/grid.xml'])).toContain('נשמר בקופץ');
			for (const name of Object.keys(before).filter((n) => n !== 'Grids/Q/grid.xml'))
				expect(after[name]).toEqual(before[name]);
			expect(sha(readFileSync(fixturePath))).toBe(sha(fixture));
			writeFileSync(
				`${artifacts}/receipt-${viewport.width}.json`,
				JSON.stringify(
					{
						geometry,
						source_sha256: sha(fixture),
						savedPath,
						saved_sha256: sha(saved),
						nativePhysicalDisk: true,
						nativeDiskPath: native.filePath,
						transport:
							'completed native browser disk file read via DOM.setFileInputFiles; no Blob reconstruction',
						entries: Object.keys(after),
						speechCalls: await page.evaluate(
							() => (window as unknown as { c6Speech: string[] }).c6Speech
						)
					},
					null,
					2
				)
			);
			await page.locator('#c6-native-disk-read').evaluate((input) => input.remove());
			const appInput = await target.send('DOM.querySelector', {
				nodeId: root.nodeId,
				selector: 'input[type=file]'
			});
			await target.send('DOM.setFileInputFiles', {
				nodeId: appInput.nodeId,
				files: [native.filePath]
			}); // import same native disk file
			await cdp.detach();
			await target.detach();
			await at(page, 'P');
			await expect(back(page)).toHaveCount(0);
			await expect(chat(page)).not.toContainText('שלום');
			await cell(page, 0).click();
			await editQ(page);
			await expect(page.getByLabel(messages.caption, { exact: true })).toHaveValue('נשמר בקופץ');
			await page.getByRole('button', { name: messages.use, exact: true }).click();
			await cell(page, 0).click(); // original InsertText command preserved
			await expect(chat(page)).toContainText('שלום');
		});
	});
}

test('Space, Back cell, ordinary history, direct SelfClosing start, selector resume/replacement and failed save', async ({
	page
}) => {
	await open(page);
	await cell(page, 1).click();
	await at(page, 'R');
	await back(page).focus();
	await page.keyboard.press('Space');
	await at(page, 'P');
	await expect(back(page)).toHaveCount(0);
	await expect(page.getByTestId('grid-source')).toBeFocused();
	await cell(page, 1).click();
	await cell(page, 0).click(); // R Back cell
	await at(page, 'P');
	await expect(back(page)).toHaveCount(0);
	await cell(page, 0).click();
	await cell(page, 0).click();
	await editQ(page);
	await page.getByLabel(messages.caption, { exact: true }).fill('טיוטת סשן');
	await page.getByRole('link', { name: messages.selector, exact: true }).click();
	await page.getByRole('button', { name: new RegExp(messages.resume) }).click();
	await at(page, 'Q');
	await expect(back(page)).toBeVisible();
	await expect(page.getByLabel(messages.caption, { exact: true })).toHaveValue('טיוטת סשן');
	await expect(chat(page)).toContainText('שלום');
	await page.getByRole('link', { name: messages.selector, exact: true }).click();
	await page.locator('input[type=file]').setInputFiles({
		name: 'direct-Q.gridset',
		mimeType: 'application/zip',
		buffer: Buffer.from(buildPopupBackFixture('Q'))
	});
	await page.getByRole('dialog').getByRole('button', { name: messages.stay, exact: true }).click();
	await page.getByRole('button', { name: new RegExp(messages.resume) }).click();
	await at(page, 'Q');
	await expect(page.getByLabel(messages.caption, { exact: true })).toHaveValue('טיוטת סשן');
	await page.evaluate(() => {
		URL.createObjectURL = () => {
			throw new Error('C6 synthetic download failure');
		};
	});
	await page.getByRole('button', { name: messages.save, exact: true }).click();
	await expect(page.getByRole('alert')).toContainText(messages.saveFailed);
	await expect(page.getByLabel(messages.caption, { exact: true })).toHaveValue('טיוטת סשן');
	await page.getByRole('link', { name: messages.selector, exact: true }).click();
	await page.locator('input[type=file]').setInputFiles({
		name: 'direct-Q.gridset',
		mimeType: 'application/zip',
		buffer: Buffer.from(buildPopupBackFixture('Q'))
	});
	await page
		.getByRole('dialog')
		.getByRole('button', { name: messages.discardLoad, exact: true })
		.click();
	await at(page, 'Q');
	await expect(back(page)).toHaveCount(0);
	await expect(chat(page)).not.toContainText('שלום');
	await cell(page, 0).click();
	await at(page, 'Q');
	await expect(back(page)).toHaveCount(0);
});

test('delayed Wait after toolbar Back matches the existing Back-cell behavior', async ({
	page
}) => {
	const observations = [];
	for (const control of ['toolbar', 'cell']) {
		await open(page);
		await cell(page, 0).click();
		await cell(page, 1).click();
		await at(page, 'R');
		await cell(page, 2).click(); // InsertText -> Wait -> Jump.To(P)
		await expect(chat(page)).toContainText('המתנה');
		if (control === 'toolbar') await back(page).click();
		else await cell(page, 0).click();
		await at(page, 'Q');
		await at(page, 'P'); // pending chain survives either manual Back
		await expect(chat(page)).toContainText('המתנה');
		await expect(back(page)).toBeVisible();
		observations.push({
			control,
			immediatePage: 'Q',
			afterWaitPage: 'P',
			outputPreserved: true,
			delayedChainOverridesBack: true
		});
	}
	writeFileSync(
		`${artifacts}/delayed-back.json`,
		JSON.stringify(
			{
				observations,
				policyDecisionRequired: true,
				executorDisposition: 'REVISE_DELAYED_CHAIN_POLICY; runtime behavior unchanged'
			},
			null,
			2
		)
	);
});
