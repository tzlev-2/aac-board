/**
 * ברירות המחדל החזותיות של ליבת gridset — כל ערך במקום אחד.
 *
 * מקור לערכי-השכיחות: tzlev-docs-repo/aac-board/grid-reference/derived/visual-model.md
 * (נגזר מ-3,282 סגנונות, 116 סדרות-לוחות). כל שדה שאין לו עיגון בנתונים מסומן
 * `// לא-מאומת מול Grid` — ראו docs/plans/gridset-core-design.md §5.
 */

import type { ResolvedStyle } from './types';

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
