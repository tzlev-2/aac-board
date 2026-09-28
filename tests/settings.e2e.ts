import { expect, test } from '@playwright/test';
import {
	DEFAULT_GEMINI_TTS_MODEL,
	DEFAULT_ELEVENLABS_TTS_MODEL
} from '../src/lib/services/tts-providers/provider-models';

test.describe('Settings — TTS models', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/settings');
		await page.waitForSelector('.settings-content');
		// 🛑 הבדיקה הראשונה בקובץ נכשלה בעקביות — **לא הספק, אלא המיקום.**
		// זו PWA (service worker · `offline.html` · `manifest.json`), וההרשמה
		// הראשונה גובה זמן שנופל בתוך ה-timeout של ה-expect הראשון. אומת:
		// הכשל נדד יחד עם הסדר בקובץ, לא יחד עם הספק.
		await page.waitForLoadState('networkidle');
	});

	/**
	 * 🛑 **הבדיקות האלה נכשלו מ-28.9 ועד שתוקנו — והמוצר היה תקין כל הזמן.**
	 *
	 * הן נכתבו מול רשימת-מודלים ישנה (`gemini-2.5-*` · `eleven_multilingual_v2`),
	 * והמזהים הוחלפו ב-`provider-models.ts` בלי שאיש עדכן אותן. אומת בדפדפן
	 * על הבילד: שני הספקים מציגים בורר תקין, **אפס שגיאות קונסול**.
	 *
	 * 🔑 **מה הן יכולות לבדוק ומה לא.** הרשימה החיה מגיעה מה-proxy
	 * (`getProxyUrl()`); בלעדיו `getModels()` נופל ל-**fallback בן פריט אחד**
	 * (`provider-models.ts`). ‏CI רץ בלי proxy ובלי מפתח, ולכן **תמיד** יראה
	 * אופציה אחת. בדיקת-התמדה שדורשת שתי אופציות **אינה ניתנת לביצוע כאן** —
	 * ומי שיכתוב אותה שוב יקבל בדיקה שנכשלת בלי שהמוצר שבור. שוב.
	 */
	test('בורר המודל של Gemini מציג את ברירת-המחדל של ה-fallback', async ({ page }) => {
		await page.locator('.toggle-btn', { hasText: 'Gemini' }).click();

		const modelSelect = page.locator('label.field', { hasText: 'מודל' }).locator('select');
		await expect(modelSelect).toBeVisible();
		await expect(modelSelect).toHaveValue(DEFAULT_GEMINI_TTS_MODEL);
		await expect(modelSelect.locator('option')).not.toHaveCount(0);
	});

	test('בורר המודל של ElevenLabs מציג את ברירת-המחדל של ה-fallback', async ({ page }) => {
		await page.locator('.toggle-btn', { hasText: 'ElevenLabs' }).click();

		const modelSelect = page.locator('label.field', { hasText: 'מודל' }).locator('select');
		await expect(modelSelect).toBeVisible();
		await expect(modelSelect).toHaveValue(DEFAULT_ELEVENLABS_TTS_MODEL);
		await expect(modelSelect.locator('option')).not.toHaveCount(0);
	});

	/** ‏`webspeech` אינו חושף `getModels`, ולכן אין לו בורר כלל — לא באג. */
	test('לספק הדפדפן אין בורר מודל', async ({ page }) => {
		await page.locator('.toggle-btn', { hasText: 'דפדפן' }).click();
		await expect(page.locator('label.field', { hasText: 'מודל' })).toHaveCount(0);
	});

	/** ‏הערך הנבחר שורד רענון — זו ההתמדה שכן ניתנת לבדיקה עם פריט אחד. */
	test('המודל הנבחר שורד רענון', async ({ page }) => {
		await page.locator('.toggle-btn', { hasText: 'Gemini' }).click();
		const sel = page.locator('label.field', { hasText: 'מודל' }).locator('select');
		await expect(sel).toHaveValue(DEFAULT_GEMINI_TTS_MODEL);

		await page.reload();
		await page.waitForSelector('.settings-content');

		await expect(page.locator('label.field', { hasText: 'מודל' }).locator('select')).toHaveValue(
			DEFAULT_GEMINI_TTS_MODEL
		);
	});

	test('settings page scrolls to lower data controls', async ({ page }) => {
		const settingsPage = page.locator('.settings-page');
		const resetButton = page.getByRole('button', { name: 'איפוס לברירת מחדל' });

		await expect(settingsPage).toHaveJSProperty('scrollTop', 0);
		await settingsPage.evaluate((el) => el.scrollTo(0, el.scrollHeight));

		await expect(settingsPage).not.toHaveJSProperty('scrollTop', 0);
		await expect(resetButton).toBeInViewport();
	});
});
