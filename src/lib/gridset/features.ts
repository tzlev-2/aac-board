/**
 * רג'יסטרי התכונות של קלון-הווב.
 *
 * `Settings.RequiredFeature` היא **הצהרת-דרישה של התא בתחביר של פקודה** —
 * לא שומר-הרצה. תא שדרישתו אינה מתקיימת אינו מצויר, ולכן הקבוצה כאן היא
 * קלט של **שער-הרינדור** (`isCellAvailable`), לא של המריץ.
 *
 * 🔑 הקבוצה מוצהרת **כאן, במקום אחד** — אף handler אינו בודק תכונה ad-hoc.
 *
 * מקור: docs/plans/gridset-core-design.md §1 (מתוקן 27.9.2026).
 */

import type { FeatureId } from './types';

/**
 * שנים-עשר ערכי `feature`, **רשימה סגורה שנמדדה** מ-116 קובצי `.gridset`
 * (3,875 מופעים עם פרמטר). הערות: מספר המופעים בחבילה כולה.
 *
 * 🛑 אין לנחש שמות. `EyeGaze`, `Environment` ו-`Phone` — שלושתם נוחשו
 * בגרסה הראשונה של התכנון ו**אינם קיימים בנתונים**. השמות האמיתיים הם
 * `EyeGazeAccess` ו-`EnvironmentControl`, ולטלפוניה אין ערך כלל.
 */
export const KNOWN_FEATURES = [
	'Dwell', // 3,581 — 92.4%
	'SecondScreen', // 77
	'ComputerControl', // 65
	'EyeGazeAccess', // 59
	'TouchAccess', // 27
	'PointerAccess', // 23
	'SwitchAccess', // 21
	'MusicVideo', // 17
	'EnvironmentControl', // 2
	'ShareCommand', // 1
	'WebBrowser', // 1
	'Email' // 1
] as const satisfies readonly FeatureId[];

/**
 * התכונות שקלון-הווב מחזיק — מה שדפדפן מספק ודאית.
 *
 * 🛑 הגרסה הראשונה של התכנון קבעה כאן קבוצה **ריקה**, מתוך ההנחה
 * "קלון-ווב אינו מחזיק את התכונות, לכן התאים ייחסמו". ההנחה הפוכה: הציטוט
 * `feature=ComputerControl` בא מעמודת `sample_param_values` ב-TSV, שהיא
 * **דגימה אלפביתית** ולא הערך הנפוץ. `ComputerControl` הוא 1.7% מהמופעים.
 *
 * בלוחות הארגון נדרשות בפועל: `EyeGazeAccess` 58 (נכון לשלול) · ללא-פרמטר
 * 56 · `TouchAccess` 8 · `PointerAccess` 2 · `SwitchAccess` 2.
 *
 * ⏳ `Dwell` הוא 92.4% מהמופעים בחבילה (ו-0 אצלנו), והוא **כן ניתן למימוש
 * בווב** — יתווסף כאן כשיהיה מימוש dwell-click, ולא לפני.
 */
export const WEB_FEATURES: ReadonlySet<FeatureId> = new Set<FeatureId>([
	'TouchAccess',
	'PointerAccess'
]);

/** האם המחרוזת היא אחד משנים-עשר הערכים שנמדדו. */
export function isKnownFeature(value: string): value is FeatureId {
	return (KNOWN_FEATURES as readonly string[]).includes(value);
}

/** האם קבוצת התכונות הנתונה מכילה את התכונה. */
export function hasFeature(features: ReadonlySet<FeatureId>, feature: FeatureId): boolean {
	return features.has(feature);
}

/** קבוצת תכונות לבדיקות ולתצוגות "מה אם" — אינה בשימוש בזמן ריצה. */
export function featureSet(...ids: FeatureId[]): ReadonlySet<FeatureId> {
	return new Set(ids);
}
