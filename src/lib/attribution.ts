/**
 * ייחוס ARASAAC — **דרישת רישיון, לא נימוס.**
 *
 * הסמלים שהאפליקציה מגישה (`src/lib/services/arasaac.ts`) מופצים ב-
 * **Creative Commons BY-NC-SA**. ‏`BY` מחייב ייחוס, ובלעדיו השימוש אינו
 * מורשה. 🛑 **זה חוסם פרסום, לא פיתוח.**
 *
 * ## הנוסח אותר במקור, ‏28.9.2026 — ולא נוסח מהזיכרון
 *
 * ‏`https://arasaac.org/terms-of-use` הוא SPA שמרנדר בצד-הלקוח, ולכן `curl`
 * וכל fetch של HTML מחזירים דף ריק (`<title>ARASAAC</title>` ותו לא). הנוסח
 * נשלף מחבילת ה-JS של האתר עצמו — `https://arasaac.org/main.<hash>.js`,
 * ‏5.8MB — שבה מחרוזות react-intl יושבות כטקסט. המפתחות המדויקים:
 *
 * | מפתח באתר ARASAAC | הערך האנגלי הרשמי |
 * |---|---|
 * | `app.components.author` | `Pictograms author:` |
 * | `app.components.origin` | `Origin:` |
 * | `app.components.owner` | `Owner: Government of Aragon (Spain)` |
 * | `app.components.license` | `License:` |
 * | `app.components.licenseP6b` | `There are two ways to attribute authorship:` |
 * | `app.components.licenseP7` | (הנוסח המשפטי — `ATTRIBUTION_SENTENCE_EN` למטה) |
 * | `{creativeCommonsLicense}` | `Creative Commons License (BY-NC-SA)` |
 *
 * ‏`licenseP6b` הוא שאומר שיש **שתי** צורות ייחוס תקפות, ולכן שתיהן כאן:
 * צורת-השדות (`author`/`origin`/`license`/`owner`) וצורת-המשפט (`licenseP7`).
 *
 * ## 🛑 אין תרגום עברי רשמי — והעברית כאן היא שלנו
 *
 * נבדק ישירות: בחבילת האתר **אפס** מחרוזות-רישיון עבריות (חיפוש `\u05..`
 * על כל מפתחות `app.components.license*` החזיר 0). ‏ARASAAC מתרגם את דף
 * הרישיון לעשרות שפות — עברית אינה ביניהן.
 *
 * ⚠️ **לכן `ATTRIBUTION_SENTENCE_HE` הוא תרגום שלנו, לא נוסח רשמי.** הוא
 * מוצג לצד האנגלי במכוון: האנגלי הוא מה שהרישיון דורש, והעברי הוא נגישות
 * לקורא. מי שמחליף את העברית אינו נוגע בתוקף המשפטי; מי שמוחק את האנגלית —
 * כן.
 *
 * ## ‏`NC` — ולמה זה מתאים לנו
 *
 * ‏`NonCommercial`. הפרויקט הוא של עמותה ואינו מסחרי, ולכן הרישיון מתאים
 * כפי שהוא. 🛑 **נרשם כאן ולא בממשק** — משתמש הלוח אינו הנמען של ההבחנה
 * הזאת. אם המוצר ייהפך מסחרי, ‏`NC` נשבר וצריך רישיון אחר.
 *
 * ‏`SA` (`ShareAlike`) מחייב שכל נגזרת תופץ באותו רישיון — נוגע להפצה של
 * לוחות שנבנו כאן, לא לאפליקציה.
 */

/** מזהה הרישיון, בצורה הקנונית של Creative Commons. */
export const ARASAAC_LICENSE_ID = 'CC BY-NC-SA 4.0';

/** התווית הרשמית של ARASAAC ל-`{creativeCommonsLicense}`. */
export const ARASAAC_LICENSE_LABEL_EN = 'Creative Commons License (BY-NC-SA)';

export const ARASAAC_LICENSE_URL = 'https://creativecommons.org/licenses/by-nc-sa/4.0/';
export const ARASAAC_TERMS_URL = 'https://arasaac.org/terms-of-use';
export const ARASAAC_SITE_URL = 'https://arasaac.org';

/** `app.components.licenseP7` — הנוסח הרשמי, כפי שהוא. אין לערוך. */
export const ATTRIBUTION_SENTENCE_EN =
	'The pictographic symbols used are the property of the Government of Aragón and have been ' +
	'created by Sergio Palao for ARASAAC, that distributes them under Creative Commons License (BY-NC-SA).';

/** ⚠️ תרגום שלנו — ל-ARASAAC אין נוסח עברי רשמי. ראו את ראש הקובץ. */
export const ATTRIBUTION_SENTENCE_HE =
	'הסמלים הפיקטוגרפיים שבשימוש הם קניינה של ממשלת אראגון, נוצרו על ידי Sergio Palao עבור ' +
	'ARASAAC, והיא מפיצה אותם ברישיון Creative Commons (BY-NC-SA).';

/**
 * צורת-השדות — הדרך השנייה שהרישיון מתיר. התוויות הן התרגום שלנו;
 * ‏**הערכים** הם כפי שהם באתר ARASAAC ואינם מתורגמים (שם-אדם ושם-מוסד).
 */
export const ATTRIBUTION_FIELDS: readonly { label: string; value: string }[] = [
	{ label: 'יוצר הסמלים', value: 'Sergio Palao' },
	{ label: 'מקור', value: 'ARASAAC' },
	{ label: 'רישיון', value: ARASAAC_LICENSE_LABEL_EN },
	{ label: 'בעלות', value: 'Government of Aragon (Spain)' }
];
