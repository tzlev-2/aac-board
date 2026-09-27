/**
 * פרסור סגנונות (`Settings0/Styles/styles.xml`) ופתירת סגנון-תא.
 *
 * סדר הפתירה — שתי רמות, לא שרשרת (docs/plans/gridset-core-design.md §5,
 * תוקן 27.9.2026 אחרי שהתברר שאין ירושת-סגנון-מתוך-סגנון בנתונים):
 *   DEFAULT_RESOLVED_STYLE → הסגנון הנקוב (רשומה שטוחה תחת Style[Key])
 *                          → עקיפות מקומיות של התא.
 *
 * `BasedOnStyle` מופיע פעם אחת בסכמה בלבד — על התא (252,974 מופעים =
 * מספר התאים) — ומעולם לא כשדה של `Style` עצמו. סגנון נקוב אינו יורש
 * מסגנון אחר; לכן אין כאן `while`, אין `visited`, ואין הגנה ממעגל.
 *
 * 🔑 אין תלות ב-DOMParser: styles.xml הוא מבנה שטוח בלבד (`<Style Key="…">`
 * עם ילדים-עלה, ללא קינון — אומת מול gridset-schema.tsv), ולכן פרסר-regex
 * ממוקד עדיף על תלות בסביבת-דפדפן. פרסור התוכן העשיר (Text/p/s/r) הוא באחריות
 * parse.ts (סלייס אחר) ומצדיק שם DOMParser אמיתי.
 */

import type { CellStyleSource, ResolvedStyle, Style, StyleResolver } from './types';
import { DEFAULT_RESOLVED_STYLE } from './visualDefaults';

const STYLE_ELEMENT_RE = /<Style\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Style>)/g;
const KEY_ATTR_RE = /\bKey\s*=\s*"([^"]*)"|\bKey\s*=\s*'([^']*)'/;
const CHILD_ELEMENT_RE = /<(\w+)>([\s\S]*?)<\/\1>/g;

/**
 * תגי-XML של Style שיש להם מקום ייעודי ב-Style — שאר התגים (למשל `Name`,
 * `TileColour`) נשמרים כמות שהם דרך ה-catch-all, כי אין להם שדה טיפוסי.
 * ‏`Key` (המזהה, 3,282 מופעים) נקרא בנפרד כתכונה — ראו KEY_ATTR_RE.
 */
const FIELD_MAP: Partial<Record<string, keyof Style>> = {
	BackColour: 'backColour',
	FontColour: 'fontColour',
	BorderColour: 'borderColour',
	FontName: 'fontName',
	FontSize: 'fontSize',
	BackgroundShape: 'backgroundShape',
	TileColour: 'tileColour'
};

const NUMERIC_FIELDS = new Set<keyof Style>(['fontSize', 'backgroundShape']);

function decodeXmlEntities(text: string): string {
	return text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

/** פרסור styles.xml למילון סגנונות-גולמיים, לפי שם (`Key`). */
export function parseStyles(stylesXml: string): Record<string, Style> {
	const styles: Record<string, Style> = {};

	for (const match of stylesXml.matchAll(STYLE_ELEMENT_RE)) {
		const [, attrs, body] = match;
		const keyMatch = KEY_ATTR_RE.exec(attrs);
		const key = keyMatch ? decodeXmlEntities(keyMatch[1] ?? keyMatch[2] ?? '') : '';
		if (!key) continue;

		const style: Style = { name: key };
		if (body) {
			for (const childMatch of body.matchAll(CHILD_ELEMENT_RE)) {
				const [, tag, rawText] = childMatch;
				const text = decodeXmlEntities(rawText.trim());
				if (!text) continue;

				const mapped = FIELD_MAP[tag];
				if (mapped) {
					style[mapped] = NUMERIC_FIELDS.has(mapped) ? Number(text) : text;
				} else {
					// שדה שטרם מופו — נשמר ולא נזרק (types.ts: [k: string]: unknown).
					style[tag] = text;
				}
			}
		}

		styles[key] = style;
	}

	return styles;
}

const CSS_HEX_RRGGBBAA = /^#[0-9A-Fa-f]{8}$/;

/**
 * צבעי Grid הם `#RRGGBBAA` (אלפא בסוף) — אותו סדר-בתים בדיוק כמו hex-with-alpha
 * בתקן CSS Color Module Level 4, ולכן אין היפוך; רק אימות תקינות-פורמט.
 * קלט שאינו תואם מוחזר כמות שהוא עם אזהרה — לא נזרקת שגיאה.
 */
export function toCssColor(gridColour: string): string {
	if (!CSS_HEX_RRGGBBAA.test(gridColour)) {
		console.warn(`[gridset:resolveStyle] פורמט צבע לא צפוי: "${gridColour}" — מוחזר כמו שהוא`);
		return gridColour;
	}
	return gridColour;
}

const STYLE_FIELDS = [
	'backColour',
	'fontColour',
	'borderColour',
	'fontName',
	'fontSize',
	'backgroundShape',
	'tileColour'
] as const satisfies readonly (keyof ResolvedStyle)[];

function applyStyleOverrides(base: ResolvedStyle, overrides: Partial<Style>): ResolvedStyle {
	// עדכון לפי מפתח גנרי מתוך union: TS לא יודע להצר את סוג הערך מול המפתח
	// באותה איטרציה, לכן העדכון עצמו עובר דרך Record רופף ומוחזר כ-ResolvedStyle.
	const next: Record<string, unknown> = { ...base };
	for (const field of STYLE_FIELDS) {
		const value = overrides[field];
		if (value !== undefined) {
			next[field] = value;
		}
	}
	return next as unknown as ResolvedStyle;
}

/**
 * בונה פותר-סגנונות מוזרק (StyleResolver) מתוך מילון הסגנונות שנפרס.
 * הפרסר הראשי (parse.ts, סלייס אחר) אינו יודע לפתור סגנון — הוא רק מזריק
 * את הפותר הזה, כדי ששני הסלייסים ייכתבו במקביל בלי תלות ישירה.
 *
 * שתי רמות בלבד: הסגנון הנקוב (חיפוש יחיד לפי `Key`, בלי ירושה בין סגנונות)
 * ואז עקיפות מקומיות של התא. שם-סגנון שלא נמצא — נופל לברירת-המחדל ומדווח.
 */
export function createStyleResolver(styles: Record<string, Style>): StyleResolver {
	return (source: CellStyleSource): ResolvedStyle => {
		let resolved = DEFAULT_RESOLVED_STYLE;

		if (source.basedOnStyle) {
			const namedStyle = styles[source.basedOnStyle];
			if (namedStyle) {
				resolved = applyStyleOverrides(resolved, namedStyle);
			} else {
				console.warn(
					`[gridset:resolveStyle] שם סגנון לא קיים: "${source.basedOnStyle}" — נופל לברירת מחדל`
				);
			}
		}

		resolved = applyStyleOverrides(resolved, source.overrides);

		return {
			...resolved,
			backColour: toCssColor(resolved.backColour),
			fontColour: toCssColor(resolved.fontColour),
			borderColour: toCssColor(resolved.borderColour)
		};
	};
}
