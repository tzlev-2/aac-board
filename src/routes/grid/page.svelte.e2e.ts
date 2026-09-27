import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const fixturePath = fileURLToPath(new URL('./__fixtures__/sample-gridset.json', import.meta.url));

test('טעינת fixture מציגה רשת', async ({ page }) => {
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
});
