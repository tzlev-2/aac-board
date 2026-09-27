/**
 * ברירות המחדל החזותיות של ליבת gridset — כל ערך במקום אחד.
 *
 * מקור לערכי-השכיחות: tzlev-docs-repo/aac-board/grid-reference/derived/visual-model.md
 * (נגזר מ-3,282 סגנונות, 116 סדרות-לוחות). כל שדה שאין לו עיגון בנתונים מסומן
 * `// לא-מאומת מול Grid` — ראו docs/plans/gridset-core-design.md §5.
 *
 * 🔑 קומפוננטה מייבאת ישירות מכאן, ולא דרך CSS custom property שיורשת מאב —
 * כדי שרינדור תא בודד לא יישבר בשקט בלי `GridBoard` בשרשרת ההורים.
 * (נצרב בסבב-אימות 1: `opacity` חזר ל-1 בלי שום שגיאה כשה-var לא הוגדר.)
 */

import type { ResolvedStyle, SizeName } from './types';

export const DEFAULT_RESOLVED_STYLE: ResolvedStyle = {
	// הערך הנפוץ ביותר בפועל עבור BackColour (508/3,282) — visual-model.md §צבע.
	backColour: '#FFFFFFFF',
	// #FFFFFFFF ו-#000000FF כמעט שקולים בשכיחות (1,358 מול 1,146) — הבחירה כאן
	// היא שלנו (ניגודיות מול הרקע הלבן שלמעלה), לא שכפול של ערך יחיד מהנתונים.
	fontColour: '#000000FF',
	// הערך הנפוץ ביותר עבור BorderColour (1,646/3,282) — בפועל "בלי מסגרת".
	borderColour: '#FFFFFF00',
	// הגופן הנפוץ ביותר בנתונים (1,343/3,282), גופן ברירת-המחדל של Smartbox.
	fontName: 'Booster',
	// 24 הוא הערך **הנפוץ ביותר** בנתונים (439 מ-2,221) — לא בחירה שרירותית.
	// 🛑 ו-"רשימה סגורה של 20 גדלים" שגוי: 26 ערכים שונים, מהם 6 שברים.
	fontSize: 24,
	// לא-מאומת מול Grid — סמנטיקת BackgroundShape טרם פוענחה (plan.md שלב C).
	// ברמת התא קיים גם 0 (5,984 מופעים); בקטלוג 1–7, 9, 10.
	backgroundShape: 1,
	// TileColour הוא צבע רביעי נפרד מ-BackColour, 3,356 מופעים ברמת התא.
	// 🛑 לא-מאומת מול Grid: מה שקורה כשהוא חסר לא נמדד — שקוף הוא ההנחה השמרנית.
	tileColour: '#00000000'
};

/**
 * מה שאינו חלק מ-`ResolvedStyle` — גאומטריה ו-chrome של התא.
 * 🛑 כל ערך כאן **לא-מאומת מול Grid**: גודל-הסמל, מיקומו, רדיוס-הפינה והמרווח
 * הפנימי אינם קיימים ב-XML ונסגרים במדידה דיפרנציאלית (plan.md שלב C).
 */
export const VISUAL_DEFAULTS = {
	tileGap: '4px',
	tileBorderRadius: '8px',
	tilePadding: '6px',
	tileBorderWidth: '2px',
	/** יחס גובה-התא שהסמל תופס, כשלא ידוע גודל אמיתי מה-XML */
	iconSizeRatio: 0.6,
	symbolFontSize: '1.5em',
	disabledOpacity: 0.4,
	unsupportedBadgeGap: '2px',
	unsupportedBadgeFontSize: '0.7em',
	unsupportedBadgeOpacity: 0.7,
	unsupportedBadgeRadius: '4px',

	/**
	 * ‏`TextAtTop` — הכתובית מעל הסמל.
	 *
	 * 🔑 ‏`visual-model.md` §"ברמת סדרת-הלוחות" מונה עבורו ערך יחיד, ‏`1`. אפשרות
	 * שנשארת בברירת-המחדל אינה נכתבת ל-XML כלל (שם, §הפערים), ו-`org-1` אכן אינו
	 * נושא את התג — ולכן **ברירת-המחדל היא תווית למעלה**, והמופעים שכן נצפו הם
	 * מי שסטו ממנה וחזרו אליה.
	 *
	 * 🛑 לא-מאומת מול Grid: הערך **אינו נקרא מה-XML** בסלייס הזה. ‏`TextAtTop` הוא
	 * מאפיין ברמת סדרת-הלוחות, וקליטתו דורשת שדה ב-`GridSet` שב-`types.ts` —
	 * קובץ-חוזה שהסלייס הזה חסום מלגעת בו. כשהשדה ייקלט, הוא גובר על הערך כאן.
	 */
	captionAtTop: true,

	/**
	 * 🛑 לא-מאומת מול Grid — אבל **כן נמדד מצילום-ייחוס אחד**, ולכן הנה המספרים
	 * במלואם כדי שהמדידה הדיפרנציאלית תחליף אותם בשורה אחת.
	 *
	 * מקור: `grid-reference/home-page.png` + `uia-dump-home-page.txt`, תא "לאכול"
	 * (`Cell (2,0)`, ‏UIA rect ‏405×244 — כולל CellSpacing; **התא המצויר** נמדד
	 * מהפיקסלים כ-‏376×214). לפי שורות-הדיו:
	 *
	 * | | ‏y בצילום | גובה | % מ-214 |
	 * |---|---|---|---|
	 * | כותרת | ‏60–86 | ‏27px | **‏12.6%** |
	 * | רווח | ‏87–116 | ‏30px | ‏14.0% |
	 * | סמל | ‏117–244 | ‏128px | **‏59.8%** ← ‏`iconSizeRatio` ‏0.6 |
	 *
	 * ‏27px הוא גובה-הדיו (ראש ה-ל' עד הבסיס), לא גודל-הגופן. בהנחת
	 * ascender ≈ ‏0.75em יוצא גופן של ‏~36px, שהם **‏16.8% מגובה התא**.
	 *
	 * ⚠️ **שתי אי-ודאויות שנשארות:** יחס ה-ascender הוא הערכה, ו-`FontSize`
	 * של אותו תא אינו ידוע — הצילום הוא של "הקול כלול א-בן-PCS", שאין לנו.
	 * לכן הנרמול הוא מול `captionReferenceFontSize`, הערך שמופיע ב-14 מ-20
	 * הסגנונות של `org-1`, ולא מול הקובץ שצולם.
	 */
	captionHeightRatio: 0.168,
	/** ‏`FontSize` שנחשב "‏100% מ-`captionHeightRatio`". הנפוץ ב-`org-1` (14/20). */
	captionReferenceFontSize: 14,
	/**
	 * 🛑 לא-מאומת מול Grid — תקרה שלנו בלבד. בלעדיה `FontSize=96` (הגדול ברשימה)
	 * היה נותן ‏115% מגובה התא. התנהגות הגלישה האמיתית של Grid לא נמדדה.
	 */
	captionMaxHeightRatio: 0.25,
	/** 🛑 לא-מאומת מול Grid — הגדול ברשימת גדלי-Grid (`visual-model.md` §טיפוגרפיה). */
	captionMaxFontSize: '96px',
	/** 🛑 לא-מאומת מול Grid — הקטן באותה רשימה. רצפה, כדי שתא זעיר לא יבלע כותרת. */
	captionMinFontSize: '8px',
	/** 🛑 לא-מאומת מול Grid — הודק כדי שתיבת-הכותרת לא תחרוג מגובה-הדיו שנמדד. */
	captionLineHeight: 1.15
} as const;

/**
 * ערימת-הנפילה לגופנים.
 *
 * 🔑 ‏`FontName` מה-XML מועבר כמות שהוא ל-CSS, ואף אחד מהגופנים שנצפו אינו מותקן
 * אצלנו — בלי ערימה הדפדפן נופל לגופן-מערכת שרירותי, וזה חלק ממה שנראה כסקיצה.
 *
 * הסדר הוא סדר-השכיחות ב-`visual-model.md` §טיפוגרפיה: ‏`Booster` (1,343) ·
 * ‏`Medrano` (388) · `Roboto` (224) · `Arial` (96) · `Sassoon Infant` (77).
 *
 * 🛑 ‏`Booster` ו-`Sassoon Infant` **מורשים** — הם נמנים כאן כדי שמכונה שבה הם
 * כן מותקנים תשתמש בהם, ו**אין** `@font-face` ואין אירוח. ‏`sans-serif` בסוף
 * הוא מה שבפועל ייבחר אצלנו.
 */
export const FONT_STACK = [
	'Booster',
	'Medrano',
	'Roboto',
	'Arial',
	'Sassoon Infant',
	'sans-serif'
] as const;

/**
 * 🛑 ‏`ThemeFont` אינו שם-גופן אלא הפניה לערכת-הנושא (`Theme`, ‏25 תאים ב-`org-1`).
 * העברתו ל-`font-family` מייצרת בקשה לגופן בשם הזה, שלעולם אינה נפתרת.
 * פתירת ערכות-נושא אינה בסלייס הזה — לכן הוא נופל לערימה, במפורש.
 */
export const THEME_FONT = 'ThemeFont';

/** ‏`font-family` מגיע מקובץ של משתמש ונכנס ל-`style=""`. רק מה שהוא באמת שם-גופן. */
const FONT_NAME_SAFE = /^[\w֐-׿][\w֐-׿ .-]*$/;

/**
 * שם-הגופן מה-XML + ערימת-הנפילה, כמחרוזת `font-family` מוכנה.
 * שם שאינו מוכר נשאר ראשון (אולי הוא מותקן), ומאחוריו יש למה ליפול.
 */
export function resolveFontFamily(fontName: string | null | undefined): string {
	const quoted = FONT_STACK.map((f) => (f === 'sans-serif' ? f : `'${f}'`));
	const name = fontName?.trim();
	if (!name || name === THEME_FONT || !FONT_NAME_SAFE.test(name)) {
		return quoted.join(', ');
	}
	// שם שכבר בערימה לא נכפל — הוא רק עולה לראש (והוא שם ממילא).
	const rest = quoted.filter((f) => f !== `'${name}'`);
	return [`'${name}'`, ...rest].join(', ');
}

/**
 * ‏`font-size` של כתובית, **ביחס לגובה התא** ולא ב-px מוחלטים.
 *
 * 🔑 זה הפער: ‏`FontSize` בנתונים הוא ‏8–96 ואנחנו החלנו אותו כ-px, כך שבתא קטן
 * הכותרת נגזרת (נמדד: ‏31 מ-152 הכותרות בדף-המקלדת של `b107` נגזרו אנכית) ובתא
 * גדול היא ננסית. ‏`cqh` שומר על **היחסים** בין תאים ומצמיד אותם לגובה בפועל.
 *
 * ⚠️ דורש `container-type: size` על `.cell` — ראו `GridCell.svelte`. בלעדיו
 * ‏`cqh` נופל ל-small viewport ולא לתא, **בלי שום שגיאה**.
 */
export function captionFontSizeCss(fontSize: number): string {
	const { captionHeightRatio, captionReferenceFontSize, captionMaxHeightRatio } = VISUAL_DEFAULTS;
	const ratio = (fontSize / captionReferenceFontSize) * captionHeightRatio;
	const cqh = (Math.max(ratio, 0) * 100).toFixed(2);
	const cap = (captionMaxHeightRatio * 100).toFixed(2);
	return `max(${VISUAL_DEFAULTS.captionMinFontSize}, min(${cqh}cqh, ${cap}cqh, ${VISUAL_DEFAULTS.captionMaxFontSize}))`;
}

/**
 * מיפוי שם-מידה ל-fr יחסי. `Width`/`Height` מפורשים ב-<ColumnDefinition>/
 * <RowDefinition> (‏`types.ts` `SizeName`) — ‏null = רגיל = 1fr.
 * 🛑 לא-מאומת מול Grid — היחסים נבחרו על ידינו, לא נמדדו.
 */
export const SIZE_NAME_TO_FR: Record<SizeName, number> = {
	ExtraSmall: 0.5,
	Small: 0.75,
	Large: 1.5,
	ExtraLarge: 2
};

export function sizeNameToFr(size: SizeName | null | undefined): number {
	return size ? SIZE_NAME_TO_FR[size] : 1;
}
