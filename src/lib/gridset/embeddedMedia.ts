/**
 * מדיה **מוטמעת** בתוך ה-`.gridset` — שחזור הנתיב בתוך ה-ZIP, והכרעה מה
 * דפדפן מסוגל להציג.
 *
 * ## 🔑 הממצא: ההפניה אינה נתיב — היא **זנב** של נתיב
 *
 * ‏`ImageRef` בלי תחילית-ספרייה (`{ library: '', path: '-0-text-0.jpeg' }`)
 * **אינו שם-קובץ.** הקובץ בארכיון הוא `Grids/<דף>/2-0-0-text-0.jpeg`, וההפניה
 * שמורה בלי התחילית `2-0`. מי שמחפש בארכיון את הערך כפי שהוא לא ימצא כלום,
 * ומי שמסיק מזה "המדיה חסרה מהקובץ" טועה — היא שם.
 *
 * שם-הקובץ נבנה מ**שרשרת-המוצא של ההפניה**, מחוברת במקפים, וכל נשא שומר את
 * הזנב שמתחיל בעומק שלו:
 *
 * ```
 * Grids/<דף>/  {X}-{Y}  -{אינדקס הפקודה}  -{מפתח הפרמטר}  -wordlist  -{אינדקס הפריט}  <הערך השמור>
 *             └── CaptionAndImage/Image שומר הכול מכאן ──────────────────────────────┘
 *                                        └── <s Image=…> שומר מכאן ──────────────────┘
 *                                                                   └─ WordListItem/Image ─┘
 * ```
 *
 * ## כל נשא נמדד מול הקורפוס, ואף אחד מהמספרים אינו מוסק
 *
 * ‏116 קובצי `.gridset` ב-`~/work/grid-mapping/raw/` (כולל `bundled/`). העמודה
 * "נפתר" היא **התאמה מדויקת לשם קיים בארכיון**, לא הסתברות:
 *
 * | נשא | התחילית | הפניות | נפתרו |
 * |---|---|---:|---:|
 * | `Cell/Content/CaptionAndImage/Image` | `{X}-{Y}` | 4,507 | **4,507** |
 * | `<s Image=…>` בפרמטר-פקודה | `{X}-{Y}-{ci}-{key}-` | 155 | **155** |
 * | `WordListItem/Image` ב-`/Grid/WordList` | `wordlist-{ii}` | 103 | **103** |
 * | `Parameter/data` (`filedata`) | `{X}-{Y}-{ci}-{key}` | 752 | **752** |
 * | `WordListItem/Image` בתוך פרמטר-פקודה | `{X}-{Y}-{ci}-{key}-wordlist-{ii}` | 356 | (נמדד, לא ממומש — ראו למטה) |
 * | `/Grid/BackgroundImage` | `background` | 687 | **687** |
 *
 * 🛑 **מה שאינו ממומש כאן, ולמה — כדי שלא יידרש לחקור מחדש:**
 *
 * - ‏`WordListItem/Image` **בתוך** פרמטר של `Prediction.ChangeWordList`
 *   (356 הפניות). הכלל אומת, אבל רשימת-המילים הזאת אינה זו שמצוירת:
 *   ‏`WordListCell` מצייר את `page.wordList`, ופרמטר-הפקודה מחליף אותה בזמן
 *   ריצה דרך `commands.ts` — **קובץ שסלייס 11 מחזיק.**
 * - ‏`/Grid/BackgroundImage` (687). הכלל אומת (`background` + הערך), אבל
 *   ‏`Page.background.image` הוא `string` ולא `ImageRef`, ושינוי החוזה נוגע
 *   בסלייס 11. אף אחד מ-`org-1..4` אינו נושא רקע מוטמע.
 * - ~~‏`Parameter/data` — הנתיב נשמר, הבייטים לא נפרשים.~~ **בוטל בסלייס 13:**
 *   ‏`SpeechPlaySound` מנגנת אותם, ולכן הם נפרשים ככל מדיה אחרת. ‏5 מ-5
 *   נתיבי ה-mp3 שהכלל חזה ב-`org-3` נמצאו בארכיון.
 *
 * ## 🛑 `emf`/`wmf` — אין דפדפן שמרנדר אותם
 *
 * ‏Windows Metafile. ‏`<img src>` על כזה נותן אייקון-שבור, לא תמונה. הם
 * **1,973 `wmf` ו-137 `emf`** מתוך 4,507 הפניות-CaptionAndImage — כלומר קרוב
 * למחצית. הפתירה שלהם **נופלת לשכבה הבאה** בדיוק כמו מזהה שאינו במניפסט
 * (`pcs-manifest.ts`), ולא מתחזה להצלחה.
 */

import type { Cell, Page, RichText, WordListItem } from './types';

/**
 * סיומות שדפדפן מציג. 🛑 **רשימת-היתר, לא רשימת-איסור** — פורמט שלא נבדק
 * נחשב לא-נתמך, כי הכשל של הכיוון ההפוך הוא `<img>` שבור על המסך.
 */
const RENDERABLE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif']);

/** הסיומת בלי הנקודה, באותיות קטנות. `''` כשאין. */
export function mediaExtension(path: string): string {
	const leaf = path.split(/[\\/]/).pop() ?? '';
	const dot = leaf.lastIndexOf('.');
	return dot < 0 ? '' : leaf.slice(dot + 1).toLowerCase();
}

/** האם הדפדפן יכול להציג את הקובץ הזה ב-`<img>`. */
export function isRenderableImage(path: string): boolean {
	return RENDERABLE_EXTENSIONS.has(mediaExtension(path));
}

/**
 * סיומות-שמע ש-`<audio>` מנגן. אותה גישה של רשימת-היתר, מאותו נימוק.
 *
 * 🔑 **בקורפוס יש בפועל רק `.mp3`** — ‏748 מ-749 ערכי `<data>`, והאחרון ריק.
 * השאר כאן מראש כי הן זולות ומוכרות, ולא כי נמדדו.
 */
const PLAYABLE_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'webm']);

/**
 * האם אפשר לנגן את הקובץ הזה ב-`<audio>` — ‏`SpeechPlaySound`.
 *
 * 🛑 **נפרד מ-`isRenderableImage` ולא מאוחד אליו.** שני הצרכנים שונים
 * (`<img src>` מול `<audio src>`), וצירוף הרשימות היה מכניס `mp3` לנתיב
 * שבונה `Blob` עם `type: image/…`.
 */
export function isPlayableAudio(path: string): boolean {
	return PLAYABLE_AUDIO_EXTENSIONS.has(mediaExtension(path));
}

/**
 * ‏MIME לפי סיומת, לבנייה של `Blob`.
 *
 * 🛑 **לא אופציונלי.** ‏`new Blob([bytes])` בלי `type` הוא
 * `application/octet-stream`, וכרום **מסרב להציג** אותו ב-`<img src="blob:…">`
 * — התוצאה היא אייקון-שבור למרות שהבייטים תקינים.
 */
export function mimeOf(path: string): string {
	const ext = mediaExtension(path);
	if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
	if (ext === 'svg') return 'image/svg+xml';
	if (RENDERABLE_EXTENSIONS.has(ext)) return `image/${ext}`;
	// שמע — אותו נימוק בדיוק: ‏`<audio>` על `application/octet-stream` אינו
	// מנגן. ‏`m4a`/`aac` הם `audio/mp4`, ולא `audio/m4a` שאינו טיפוס אמיתי.
	if (ext === 'mp3') return 'audio/mpeg';
	if (ext === 'oga') return 'audio/ogg';
	if (ext === 'm4a' || ext === 'aac') return 'audio/mp4';
	if (PLAYABLE_AUDIO_EXTENSIONS.has(ext)) return `audio/${ext}`;
	return 'application/octet-stream';
}

/** טיפוס-שומר ל-`RichText` בתוך `ParamValue`. */
function isRichText(value: unknown): value is RichText {
	return typeof value === 'object' && value !== null && 'paragraphs' in value;
}

/** טיפוס-שומר לערך-`<data>` בתוך `ParamValue`. */
function isDataValue(value: unknown): value is { data: string; embeddedPath?: string } {
	return typeof value === 'object' && value !== null && 'data' in value;
}

/**
 * ‏`<data>` שהוא **סיומת-קובץ** ולא תוכן.
 *
 * 🛑 **השומר הזה נדרש, ולא מטעמי זהירות בלבד.** ‏`<data>` הוא לפי שמו מקום
 * לתוכן, ו-fixture קיים בריפו (`parse.svelte.spec.ts`, הבדיקה
 * *"‏`<data>` → `{ data }`"*) אכן כותב בו base64 — ‏`SUQzBAA=`. בלי השומר
 * הצירוף היה מפיק `Grids/דף/0-0-0-filedataSUQzBAA=`, נתיב מומצא שלעולם לא
 * יימצא, והכשל היה **שקט**.
 *
 * 🔑 ומה שהנתונים אומרים: ‏**752 מ-752** מופעי `<data>` ב-116 קובצי ה-`.gridset`
 * הם בדיוק `.mp3` — כלומר סיומת, בכל המקרים, ואפס base64. צורת ה-fixture
 * אינה קיימת בקורפוס (דווח בסוף הסלייס). לכן: ערך שאינו סיומת אינו מקבל
 * נתיב, ואינו מתחזה למצביע-קובץ.
 */
const DATA_SUFFIX = /^\.[A-Za-z0-9]{1,6}$/;

/**
 * מסמן על כל הפניה מוטמעת את נתיבה המלא בתוך ה-ZIP.
 *
 * 🔑 **מריצים את זה כמעבר-אחרי-פרסור ולא בתוך הפרסר.** התחילית דורשת את
 * ‏`X`/`Y` של התא, את אינדקס הפקודה ואת מפתח הפרמטר — ו-`normalizeRichText`
 * ב-`richText.ts` אינו רואה אף אחד מהם. השחלת ההקשר דרך ארבע שכבות-קריאה
 * הייתה משנה את חתימות `parseCommand`/`parseParameterValue`, שסלייס 11 קורא.
 *
 * ‏`dir` הוא ספריית הדף בתוך ה-ZIP (`Grids/<שם>`), כפי ש-`fflate` מחזיר אותה,
 * ‏**ולא** `page.name` — ראו את ההערה על קידוד-שמות ב-`parse.ts`.
 *
 * מעדכן את ה-`ImageRef` במקום. מחזיר את הנתיבים שסומנו.
 */
export function assignEmbeddedPaths(page: Page, dir: string): string[] {
	const assigned: string[] = [];

	const mark = (ref: { library: string; path: string; embeddedPath?: string }, prefix: string) => {
		// תחילית-ספרייה קיימת ⇒ ההפניה היא לספרייה חיצונית של Grid, לא לארכיון.
		if (ref.library.trim() !== '') return;
		ref.embeddedPath = `${dir}/${prefix}${ref.path}`;
		assigned.push(ref.embeddedPath);
	};

	const markSentences = (text: RichText, prefix: string) => {
		for (const paragraph of text.paragraphs) {
			for (const sentence of paragraph.sentences) {
				if (sentence.image) mark(sentence.image, prefix);
			}
		}
	};

	// ‏/Grid/WordList — רשימת-המילים של הדף. זו זו שמצוירת ב-WordListCell.
	page.wordList.forEach((item: WordListItem, index) => {
		if (item.image) mark(item.image, `wordlist-${index}`);
	});

	for (const cell of page.cells) {
		const base = `${cell.x}-${cell.y}`;
		if (cell.image) mark(cell.image, base);

		cell.commands.forEach((command, commandIndex) => {
			for (const [key, value] of Object.entries(command.params)) {
				const prefix = `${base}-${commandIndex}-${key}`;
				if (isRichText(value)) {
					markSentences(value, `${prefix}-`);
				} else if (isDataValue(value) && DATA_SUFFIX.test(value.data)) {
					// 🛑 שים לב להיעדר המקף: ‏`<data>.mp3</data>` נושא את הנקודה בעצמו,
					// ולכן `5-1-2-filedata` + `.mp3`. מקף כאן היה מייצר
					// ‏`5-1-2-filedata-.mp3` — שם שאינו קיים, בשקט.
					value.embeddedPath = `${dir}/${prefix}${value.data}`;
					// 🔑 **שונה מסלייס 12:** הבייטים **כן** נפרשים מאז סלייס 13,
					// כי `SpeechPlaySound` מנגנת אותם. הנתיב מצטרף לרשימת-הפרישה,
					// ו-`parse.ts` מסנן אותו ב-`isPlayableAudio`.
					// הנפח חסום: ‏23 לוחות מ-115 נושאים mp3 בכלל, והגדול שבהם
					// ‏3.2MB — לעומת מאות ה-MB של png/wmf שבגללן נולד הסינון.
					assigned.push(value.embeddedPath);
				}
			}
		});
	}

	return assigned;
}

/** האם התא נושא בכלל הפניה מוטמעת — קיצור-דרך לבדיקות ולדיאגנוסטיקה. */
export function hasEmbeddedRef(cell: Cell): boolean {
	return cell.image?.embeddedPath !== undefined;
}
