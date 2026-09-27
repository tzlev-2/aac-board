/**
 * רג'יסטרי התכונות של קלון-הווב.
 *
 * `Settings.RequiredFeature` (4,155 הפעלות בקטלוג, 126 בלוחות שלנו) היא
 * פקודת-שומר: היא עוצרת את שרשרת-הפקודות כשהתכונה שהיא דורשת אינה זמינה.
 * 🔑 הקבוצה מוצהרת **כאן, במקום אחד** — אף handler אינו בודק תכונה ad-hoc.
 *
 * מקור: docs/plans/gridset-core-design.md §1.
 */

import type { FeatureId } from './types';

/**
 * קטלוג התכונות המוכרות מ-Grid 3. משמש לתיעוד ולדוחות בלבד — שומר אינו
 * מוגבל לרשימה הזאת, וערך שאינו כאן פשוט לא יימצא ב-WEB_FEATURES.
 *
 * 🛑 הערך היחיד שנצפה בפועל בלוחות שלנו הוא `ComputerControl`
 * (grid-reference/derived/commands.tsv, `feature=ComputerControl`).
 */
export const KNOWN_FEATURES = [
	'ComputerControl',
	'EyeGaze',
	'Environment',
	'Phone',
	'Email',
	'Music',
	'Camera'
] as const satisfies readonly FeatureId[];

/**
 * מה שקלון-הווב **אינו** מחזיק. רשימה מפורשת כדי שהדוח יידע להסביר למה תא
 * מסוים מעומעם, במקום להשאיר את הקורא מול קבוצה ריקה.
 */
export const UNSUPPORTED_WEB_FEATURES: readonly FeatureId[] = [
	'ComputerControl',
	'EyeGaze',
	'Environment',
	'Phone',
	'Email',
	'Music',
	'Camera'
];

/**
 * התכונות שקלון-הווב מחזיק.
 *
 * 🛑 ריקה בכוונה בסבב הזה: דפדפן אינו שולט במחשב, אין מעקב-עיניים, אין
 * שליטה בסביבה ואין טלפוניה. הקבוצה נבנית בהדרגה — כל תכונה שתיתמך תתווסף
 * כאן, ולא בקוד של handler.
 */
export const WEB_FEATURES: ReadonlySet<FeatureId> = new Set<FeatureId>([]);

/** האם קבוצת התכונות הנתונה מכילה את התכונה. */
export function hasFeature(features: ReadonlySet<FeatureId>, feature: FeatureId): boolean {
	return features.has(feature);
}

/** קבוצת תכונות לבדיקות ולתצוגות "מה אם" — אינה בשימוש בזמן ריצה. */
export function featureSet(...ids: FeatureId[]): ReadonlySet<FeatureId> {
	return new Set(ids);
}
