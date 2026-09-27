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
 */
export const VISUAL_DEFAULTS = {
	tileGap: '4px',
	tileBorderRadius: '8px',
	tilePadding: '6px',
	/** יחס גובה-התא שהסמל תופס, כשלא ידוע גודל אמיתי מה-XML */
	iconSizeRatio: 0.6,
	disabledOpacity: 0.4
} as const;
