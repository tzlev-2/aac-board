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
	// לא-מאומת מול Grid — visual-model.md נותן רשימה סגורה של 20 גדלים בלי
	// דירוג-שכיחות; 24 נבחר שרירותית מתוך הרשימה כברירת-מחדל.
	fontSize: 24,
	// לא-מאומת מול Grid — סמנטיקת BackgroundShape=1..10 טרם פוענחה (plan.md שלב C).
	backgroundShape: 1
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
	unsupportedBadgeRadius: '4px'
} as const;

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
