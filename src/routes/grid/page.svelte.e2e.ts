import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const fixturePath = fileURLToPath(new URL('./__fixtures__/sample-gridset.json', import.meta.url));

test('טעינת fixture מציגה רשת', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/grid');
	await expect(page.getByTestId('grid-board')).toBeVisible();
	// setInputFiles דורש שה-onchange כבר יהיה מחווט (הידרציה) לפני ההזרקה —
	// אחרת האירוע אובד: SSR מציג את grid-board מיד, לפני שה-JS תפס.
	await page.waitForLoadState('networkidle');

	await page.locator('input[type="file"]').setInputFiles({
		name: 'sample-gridset.json',
		mimeType: 'application/json',
		buffer: readFileSync(fixturePath)
	});

	await expect(page.getByText('פריט-בדיקה')).toBeVisible();
	await expect(page.getByRole('button', { name: 'שמור עותק', exact: true })).toBeDisabled();
	expect(errors).toEqual([]);
});

test('ניווט org-3 לאכול אינו יוצר לולאת דיווח', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/grid');
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: /^לוח עם סמלי PCS/ }).click();
	await expect(page.getByTestId('grid-source')).toContainText('org-3.gridset');
	await page.getByText('לאכול', { exact: true }).click();
	await expect(page.getByText('לחם', { exact: true })).toBeVisible();
	// CommandExecution.Wait בלוח האמיתי מסתיים אחרי שתי שניות.
	await page.waitForTimeout(2500);
	expect(errors).toEqual([]);
});

test('ניסיון שמירה חוזר מציג כשל חדש ומתנקה אחרי הצלחה', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/grid');
	await expect(page.getByTestId('grid-source')).toContainText('org-1.gridset');
	const save = page.getByRole('button', { name: 'שמור עותק', exact: true });
	const alert = page.getByRole('alert');
	const original = await page.evaluate(() => {
		const original = URL.createObjectURL;
		(window as unknown as { restoreSaveURL: () => void }).restoreSaveURL = () => {
			URL.createObjectURL = original;
		};
		URL.createObjectURL = () => {
			throw new Error('first-save-failure');
		};
		return true;
	});
	expect(original).toBe(true);
	await save.click();
	await expect(alert).toContainText('first-save-failure');
	await page.evaluate(() => {
		URL.createObjectURL = () => {
			throw new Error('retry-save-failure');
		};
	});
	await save.click();
	await expect(alert).toContainText('retry-save-failure');
	await page.evaluate(() => {
		(window as unknown as { restoreSaveURL: () => void }).restoreSaveURL();
	});
	const download = page.waitForEvent('download');
	await save.click();
	expect((await download).suggestedFilename()).toBe('org-1-edited.gridset');
	await expect(alert).toHaveCount(0);
	expect(errors).toEqual([]);
});
