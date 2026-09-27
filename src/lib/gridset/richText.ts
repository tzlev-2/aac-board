/**
 * נרמול הטקסט העשיר של Grid, והפרשנות של הפניית-סמל.
 *
 * 🛑 מלכודת 4 — הטקסט מופיע בשלוש צורות, ובנתונים נמצאה **רביעית**:
 *
 * | צורה | מופעים (gridset-schema.tsv) |
 * |---|---:|
 * | `Text/p/s/r` | 28,078 |
 * | `Text/s/r` (בלי `<p>`) | 27,927 |
 * | `Text/r` (ישיר) | 206 |
 * | `Text/d/p/s/r` | 2,060 — **אינה בבריף** |
 *
 * ‏`<d>` הוא מעטפת שמחזיקה כמה `<p>` (113 מופעים תחת `/Grid/WordList`,
 * ו-94 תחת `Parameter`). היא שקופה: הפסקאות שבתוכה מצטרפות לרשימה.
 * ראו את הדיווח בסוף הסלייס — זו תוספת לסכמה שבבריף, לא סתירה לה.
 *
 * 🔑 הסמל יושב על ה-`<s>` (מאפיין `Image`), לא על התא.
 *
 * אותן שלוש-ארבע הצורות חלות גם על **ערך של פרמטר-פקודה**
 * (`Parameter/p` 44,380 · `Parameter/s` 1,076 · `Parameter/r` 9,072 ·
 * `Parameter/d` 94), ולכן הנרמול מקבל כל אלמנט-מכולה.
 */

import type { ImageRef, Paragraph, RichText, Sentence } from './types';
import { attr, elementChildren, rawText } from './xml';

/**
 * `"[widgit]widgit rebus\h\have.emf"` → `{ library: 'widgit', path: 'widgit rebus\h\have.emf' }`
 *
 * שם הספרייה **מנורמל לאותיות קטנות** — בנתונים מופיעים גם `[WIDGIT]` וגם
 * `[widgit]`, גם `[GRID3X]` וגם `[grid3x]`, ולא מדובר בשתי ספריות.
 * הנתיב נשמר כפי שהוא (כולל `\` וכולל `?tone=2`).
 *
 * הפניה בלי תחילית (`-0-text-0.png` — קובץ שיושב בתוך ה-gridset עצמו)
 * מקבלת `library: ''`.
 */
export function parseImageRef(raw: string | undefined): ImageRef | undefined {
	if (raw === undefined) return undefined;
	const value = raw.trim();
	if (value === '') return undefined;
	const match = /^\[([^\]]*)\](.*)$/s.exec(value);
	if (!match) return { library: '', path: value };
	return { library: match[1].toLowerCase(), path: match[2] };
}

/** `<s Image="…"><r>…</r><r>…</r></s>` → משפט אחד עם ריצותיו. */
function sentenceOf(s: Element): Sentence {
	const runs = elementChildren(s)
		.filter((child) => child.localName === 'r')
		.map(rawText);
	const image = parseImageRef(attr(s, 'Image'));
	return image ? { image, runs } : { runs };
}

/**
 * אוסף `<s>` ו-`<r>` שיושבים ישירות מתחת למכולה.
 * ‏`<r>` בודד ללא `<s>` נעטף במרומז במשפט אחד; ריצות עוקבות מצטרפות
 * לאותו משפט, כי `<s>` הוא מה שמחזיק ריצות.
 */
function looseSentences(children: Element[]): Sentence[] {
	const out: Sentence[] = [];
	let bareRuns: string[] | undefined;
	const flush = () => {
		if (bareRuns) out.push({ runs: bareRuns });
		bareRuns = undefined;
	};
	for (const child of children) {
		if (child.localName === 's') {
			flush();
			out.push(sentenceOf(child));
		} else if (child.localName === 'r') {
			(bareRuns ??= []).push(rawText(child));
		}
	}
	flush();
	return out;
}

/**
 * מנרמל מכולה (`<Text>` · `<Parameter>` · `<d>`) לצורה אחת:
 * `paragraphs[].sentences[].runs[]`. מה שחסר נעטף במרומז.
 */
export function normalizeRichText(container: Element | undefined): RichText {
	if (!container) return { paragraphs: [] };

	const paragraphs: Paragraph[] = [];
	let loose: Element[] = [];
	const flushLoose = () => {
		if (loose.length > 0) {
			const sentences = looseSentences(loose);
			if (sentences.length > 0) paragraphs.push({ sentences });
		}
		loose = [];
	};

	for (const child of elementChildren(container)) {
		switch (child.localName) {
			case 'd':
				// מעטפת שקופה — הפסקאות שבתוכה מצטרפות כאן
				flushLoose();
				paragraphs.push(...normalizeRichText(child).paragraphs);
				break;
			case 'p':
				flushLoose();
				paragraphs.push({ sentences: looseSentences(elementChildren(child)) });
				break;
			default:
				loose.push(child);
		}
	}
	flushLoose();
	return { paragraphs };
}

/** האם המכולה מחזיקה טקסט עשיר בכלל (לעומת ערך-טקסט פשוט). */
export function hasRichTextChildren(container: Element): boolean {
	return elementChildren(container).some((child) => ['d', 'p', 's', 'r'].includes(child.localName));
}

/** שרשור לטקסט שטוח — נוחות לבדיקות ולתצוגה, לא חלק מהמודל. */
export function richTextToString(text: RichText): string {
	return text.paragraphs.map((p) => p.sentences.map((s) => s.runs.join('')).join(' ')).join('\n');
}
