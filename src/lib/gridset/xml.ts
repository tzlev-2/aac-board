/**
 * עזרי DOM לפרסור ה-XML של Grid — בדפדפן, עם DOMParser.
 *
 * 🛑 שני עקרונות שמצילים מבאגים שקטים:
 *
 * 1. **רק ילדים ישירים.** ב-XML של Grid יש שמות חוזרים בעומקים שונים:
 *    `/Grid/Commands` (פקודות דף) מול `/Grid/Cells/Cell/Content/Commands`,
 *    ו-`/Grid/WordList` מול `/Grid/Cells/.../Parameter/WordList`.
 *    `getElementsByTagName` סורק את כל התת-עץ ולכן היה מערבב ביניהם.
 *    כל החיפושים כאן הם ברמת-ילדים בלבד.
 *
 * 2. **סובלנות ל-namespace.** מאפיין `nil` נכתב בפועל גם כ-`xsi:nil`.
 *    `getAttribute('nil')` מחזיר null כשהמאפיין מוסמך בתחילית, ולכן
 *    ההשוואה כאן היא על `localName`.
 */

/** מפרסר XML וזורק שגיאה קריאה אם הוא פגום. */
export function parseXml(xml: string, label: string): Element {
	// BOM לפני ה-prolog מפיל את DOMParser
	const text = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
	const doc = new DOMParser().parseFromString(text, 'application/xml');
	const root = doc.documentElement;
	if (!root || root.localName === 'parsererror' || doc.querySelector('parsererror')) {
		throw new Error(`XML פגום ב-${label}`);
	}
	return root;
}

/** ילדים ישירים מסוג Element (בלי טקסט ובלי הערות). */
export function elementChildren(el: Element): Element[] {
	return Array.from(el.children);
}

/** הילד הישיר הראשון בשם הזה, או undefined. */
export function childByName(el: Element | undefined, name: string): Element | undefined {
	if (!el) return undefined;
	for (const child of el.children) if (child.localName === name) return child;
	return undefined;
}

/** כל הילדים הישירים בשם הזה, בסדר המסמך. */
export function childrenByName(el: Element | undefined, name: string): Element[] {
	if (!el) return [];
	return Array.from(el.children).filter((child) => child.localName === name);
}

/**
 * טקסט של ילד ישיר, **מקוצץ** ברווחים.
 * 🛑 לא לשימוש עבור `<r>` — ריצת-טקסט נשמרת מדויקת, ראו rawText.
 */
export function textOfChild(el: Element | undefined, name: string): string | undefined {
	const child = childByName(el, name);
	if (!child) return undefined;
	return (child.textContent ?? '').trim();
}

/** טקסט מדויק, בלי קיצוץ — לריצות `<r>` שבהן רווח יכול להיות משמעותי. */
export function rawText(el: Element): string {
	return el.textContent ?? '';
}

/** מאפיין, סובלני לתחילית namespace (`nil` תופס גם `xsi:nil`). */
export function attr(el: Element, name: string): string | undefined {
	const direct = el.getAttribute(name);
	if (direct !== null) return direct;
	for (const a of Array.from(el.attributes)) {
		if (a.localName === name) return a.value;
	}
	return undefined;
}

/**
 * מאפיין מספרי עם ברירת-מחדל.
 * 🛑 מלכודת 2: `X`/`Y` חסרים ב-38,287 תאים מתוך 252,974 — חסר פירושו 0,
 * ו-`ColumnSpan`/`RowSpan` חסרים פירושם 1. ההכרעה היא של הקורא, לא של הפרסר.
 */
export function intAttr(el: Element, name: string, fallback: number): number {
	const raw = attr(el, name);
	if (raw === undefined || raw.trim() === '') return fallback;
	const n = Number.parseInt(raw, 10);
	return Number.isNaN(n) ? fallback : n;
}

/** מספר מטקסט של ילד ישיר, או undefined. */
export function intOfChild(el: Element | undefined, name: string): number | undefined {
	const raw = textOfChild(el, name);
	if (raw === undefined || raw === '') return undefined;
	const n = Number.parseInt(raw, 10);
	return Number.isNaN(n) ? undefined : n;
}

/**
 * 🛑 מלכודת 5: `<CaptionAndImage nil="true"/>` — 30,251 מופעים.
 * נכתב גם כ-`xsi:nil`, ולכן הבדיקה עוברת דרך attr הסובלני.
 */
export function isNil(el: Element): boolean {
	return attr(el, 'nil')?.toLowerCase() === 'true';
}
