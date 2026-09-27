import type { SizeName } from './types';

/**
 * ערכי-ברירת-מחדל חזותיים לרינדור gridset — כל מה שאינו חלק מ-ResolvedStyle
 * (שם כבר יש backColour/fontColour/fontSize/וכו').
 *
 * 🛑 מיקום זמני: קובץ זה שייך לפי docs/plans/gridset-core-design.md ל-slice/gridset-styles
 * (בריף 3), שטרם מוזג בזמן כתיבת slice/grid-render. נוצר כאן במינימום כדי שלא
 * יתפזרו מספרי-קסם בקומפוננטות. כשסלייס 3 יתמזג — להחליף בגרסה שלו (שתכלול גם
 * DEFAULT_RESOLVED_STYLE ופתרון ירושה) ולעדכן את הייבוא כאן.
 *
 * כל ערך כאן לא-מאומת מול Grid — ראו §5 במסמך התכנון.
 *
 * 🔑 כל קומפוננטה מייבאת ישירות מכאן (בלי לעבור דרך CSS custom properties
 * שיורשות מאב) — כדי שרינדור תא בודד לא ישבר בשקט אם אין GridBoard בשרשרת
 * ההורים (נצרב בסבב-אימות 1: opacity חזר ל-1 בלי שגיאה כשה-var לא הוגדר).
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
 * מיפוי שם-מידה ל-fr יחסי. Width/Height מפורשים ב-<ColumnDefinition>/
 * <RowDefinition> (types.ts SizeName) — ‏null = רגיל = 1fr. לא-מאומת מול Grid.
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
