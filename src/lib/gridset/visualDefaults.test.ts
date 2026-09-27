/**
 * הטיפוגרפיה של הקלון — שתי הפונקציות שמתרגמות שדה-XML לערך CSS.
 *
 * שתיהן נוגעות בפער שנוסח ע"י המשתמש כ-"זה נראה כמו סקיצה":
 * ‏`FontName` שהועבר ל-CSS בלי ערימת-נפילה, ו-`FontSize` שהוחל כ-px מוחלט.
 */
import { describe, expect, it } from 'vitest';
import {
	FONT_STACK,
	THEME_FONT,
	VISUAL_DEFAULTS,
	captionFontSizeCss,
	resolveFontFamily
} from './visualDefaults';

describe('resolveFontFamily', () => {
	it('גופן לא-מוכר נשאר ראשון ומקבל את כל ערימת-הנפילה אחריו', () => {
		const css = resolveFontFamily('Comic Sans MS');

		expect(css.startsWith("'Comic Sans MS', ")).toBe(true);
		for (const fallback of FONT_STACK) {
			expect(css).toContain(fallback);
		}
		// 🔑 הנקודה של הפער: בלי `sans-serif` הדפדפן בוחר גופן-מערכת שרירותי.
		expect(css.endsWith('sans-serif')).toBe(true);
	});

	it('גופן שכבר בערימה עולה לראש ואינו נכפל', () => {
		const css = resolveFontFamily('Roboto');

		expect(css.startsWith("'Roboto', ")).toBe(true);
		expect(css.split("'Roboto'")).toHaveLength(2);
	});

	it('שם עם רווח מצוטט — אחרת הוא נשבר בתוך style=""', () => {
		expect(resolveFontFamily('Sassoon Infant')).toContain("'Sassoon Infant'");
	});

	it('🛑 ThemeFont אינו שם-גופן ואינו מועבר הלאה', () => {
		const css = resolveFontFamily(THEME_FONT);

		expect(css).not.toContain(THEME_FONT);
		expect(css).toBe(resolveFontFamily(null));
	});

	it('ערך חסר או זדוני נופל לערימה בלבד', () => {
		const stackOnly = resolveFontFamily(null);

		expect(resolveFontFamily(undefined)).toBe(stackOnly);
		expect(resolveFontFamily('   ')).toBe(stackOnly);
		// ‏`FontName` מגיע מקובץ של משתמש ונכנס ל-`style=""`.
		expect(resolveFontFamily("x'; background: url(evil)")).toBe(stackOnly);
	});
});

describe('captionFontSizeCss', () => {
	const { captionReferenceFontSize, captionHeightRatio, captionMaxHeightRatio } = VISUAL_DEFAULTS;

	it('‏FontSize הייחוס מתורגם ליחס שנמדד מצילום-הייחוס', () => {
		const css = captionFontSizeCss(captionReferenceFontSize);

		expect(css).toContain(`${(captionHeightRatio * 100).toFixed(2)}cqh`);
	});

	it('🔑 היחס בין שני גדלים נשמר — זה מה ש-px מוחלט לא שבר, אלא הקנה-מידה', () => {
		const small = Number(/([\d.]+)cqh/.exec(captionFontSizeCss(12))?.[1]);
		const big = Number(/([\d.]+)cqh/.exec(captionFontSizeCss(24))?.[1]);

		expect(big / small).toBeCloseTo(2, 5);
	});

	it('גודל קיצוני נחסם בתקרה היחסית ולא בולע את התא', () => {
		// 96 הוא הגדול ברשימת גדלי-Grid; בלי תקרה הוא 115% מגובה התא.
		const css = captionFontSizeCss(96);
		const cap = `${(captionMaxHeightRatio * 100).toFixed(2)}cqh`;

		expect(css).toContain(cap);
		expect(css.startsWith('max(')).toBe(true);
	});

	it('הרצפה נשמרת — תא זעיר אינו מוחק את הכותרת', () => {
		// ‏`max(8px, …)` הוא מה שמונע כותרת בגודל 0 בתא בגובה 20px.
		expect(captionFontSizeCss(8).startsWith(`max(${VISUAL_DEFAULTS.captionMinFontSize},`)).toBe(
			true
		);
	});
});
