/**
 * פתירת `ImageRef` לסמל שדפדפן יכול להציג.
 *
 * 🔑 ההכרעה (27.9.2026, `docs/plans/gridset-core-design.md` §6): **לא פותרים
 * את קבצי-המקור — מחליפים אותם.** ‏`ImageRef` מפנה לספריית משאבים חיצונית של
 * Grid 3 (`[widgit]`, ‏`[grid3x]`, ‏`[mjpcs#]`) שאינה אצלנו, והסיומות הן
 * `.emf`/`.wmf` — ‏Windows Metafile, שאף דפדפן אינו מרנדר. לכן המקור בפועל הוא
 * ARASAAC (רישיון חופשי) דרך `src/lib/services/arasaac.ts`.
 *
 * מה שנשאר מ-`ImageRef` הוא, **בחלק מהספריות**, המושג באנגלית שנושא שם-הקובץ:
 * `widgit rebus\h\have.emf` → ‏`have`.
 *
 * 🔑 **נמדד (`symbols.measure.ts`): מפתח-החיפוש המנצח תלוי בספרייה, ולכן
 * צריך את שניהם.** ‏`[widgit]` נושא למה באנגלית — שם-הבסיס פותר 74% מהתאים
 * **הייחודיים** ב-`org-1` מול 40% לכתובית העברית. ‏`[MJPCS#]` (‏PCS) נושא
 * **מזהה מספרי** (`10078.wmf`) — שם-הבסיס חסר-תוחלת לגמרי, והכתובית העברית
 * היא המפתח היחיד (`org-3`: ‏15% מול 50%). לכן: שם-בסיס קודם, כתובית אחריו,
 * ומי שאין לו שם-בסיס מדלג ישר לכתובית.
 *
 * 🛑 **הכיסוי הוא שני מספרים, ואף פעם לא אחד.** שני המפתחות יחד פותרים 82%
 * מהתאים **הייחודיים** ב-`org-1` — אבל **61% מהתאים בפועל** (‏549/903), וזה
 * המספר שעל המסך. הפער הוא `[grid3x]`: אייקוני-הממשק של Grid הם 478 מ-903
 * התאים ונפתרים ב-41% מול 84% ב-`[widgit]`, ודה-דופליקציה **מייפה דווקא את
 * החלק הגרוע** — אייקון שחוזר בעשרות תאים נספר בה פעם אחת. כל דיווח כיסוי
 * חייב לנקוב בבסיס. ‏`org-2`: ‏82% / 70%. ‏`org-3`: ‏63% / 65%.
 *
 * 🔑 **הנגזרת למוצר: ‏4 תאים מכל 10 יגיעו בלי סמל.** תא שסמלו לא נפתר מחזיר
 * `url: null`, והרינדור נופל לצבע+צורה+תווית (סלייס 4) — **זה המסלול הראשי,
 * לא מסלול-קצה.** ‏🛑 לא placeholder שבור ולא חריגה. ראו `gridset-core-design.md` §6.
 *
 * ‏`org-*` הם **לוחות-הדגימה של Grid בעברית**, לא לוחות הארגון — המספרים
 * מתארים את מבנה Grid, ולא דפוסי-שימוש ארגוניים.
 */

import { pictogramUrl, searchPictograms, type ArasaacResult } from '$lib/services/arasaac';
import { createSymbolCache, type CachedMatch, type SymbolCache } from './symbol-cache';
import { PCS_AVAILABLE_IDS } from './pcs-manifest';
import type { Cell, GridSet, ImageRef, ParamValue, RichText } from './types';

// ── החוזה החוצה ──────────────────────────────────────────────────────────

/** דרגת ההתאמה בין מפתח-החיפוש למילת-המפתח של הסמל שנבחר. */
export type MatchQuality = 'exact' | 'loose';

export interface SymbolResolution {
	url: string | null;
	source: 'arasaac' | 'pcs' | 'none';
	/** מה חיפשנו בפועל — לדיאגנוסטיקה. מחרוזת ריקה = לא היה מה לחפש. */
	query: string;
	/** שדות-דיאגנוסטיקה נוספים; קיימים רק כשהפתירה הצליחה. */
	match?: MatchQuality;
	lang?: string;
	/** מילת-המפתח של ARASAAC שהתאימה — מאפשר לראות *למה* נבחר הסמל הזה. */
	keyword?: string;
	/** הספרייה של ה-`ImageRef` שממנה נגזר מפתח-החיפוש; `'none'` כשאין ref. */
	library: string;
}

export interface SymbolResolverStats {
	resolved: number;
	unresolved: number;
	/** כל קריאת `resolve()`, לפי הספרייה של ה-`ImageRef` המועדף על התא. */
	byLibrary: Record<string, number>;
	/** מתוכן — אלה שנפתרו. ההפרש מ-`byLibrary` הוא שיעור-הכשל לכל ספרייה. */
	resolvedByLibrary: Record<string, number>;
	/**
	 * התפלגות דרגות-ההתאמה בין הפתירות שהצליחו.
	 *
	 * 🛑 **הסכום כאן קטן מ-`resolved`** מאז שנוספה שכבת PCS: פתירת-PCS היא
	 * lookup מדויק לפי מזהה ולא התאמת-מילת-מפתח, ולכן אין לה `MatchQuality`
	 * והיא אינה נספרת כאן. הפער הוא בדיוק `resolvedBySource.pcs`.
	 */
	byMatch: Record<MatchQuality, number>;
	/**
	 * הפתירות שהצליחו, לפי המקור שהגיש אותן.
	 *
	 * 🔑 בלי זה אי-אפשר לדווח כיסוי בכלל: ‏PCS ו-ARASAAC נבדלים בסוג הראיה
	 * (‏lookup מדויק מול התאמת-מילה), ולכן "‏61% נפתרו" חסר-משמעות אם אינו
	 * אומר כמה מכל אחד.
	 */
	resolvedBySource: Record<string, number>;
}

export interface SymbolResolver {
	resolve(cell: Cell): Promise<SymbolResolution>;
	stats(): SymbolResolverStats;
}

/** פונקציית החיפוש — מוזרקת בבדיקות כדי שלא תהיה רשת ב-CI. */
export type PictogramSearch = (keyword: string, lang: string) => Promise<ArasaacResult[]>;

export interface SymbolResolverOptions {
	/**
	 * דרגת ההתאמה המינימלית שמקבלים.
	 * ‏`'exact'` (ברירת-מחדל) — רק סמל שאחת ממילות-המפתח שלו זהה למפתח-החיפוש.
	 * ‏`'loose'` — מקבל גם סמל שכל מילות מפתח-החיפוש (שתיים ומעלה) מוכלות
	 * במילת-מפתח שלו: ‏`אפשר לעזור` → `אפשר לעזור לך?`.
	 *
	 * 🛑 מה ש-`loose` קונה הוא **כיסוי, לא דיוק** — נכונות ההתאמות הרופפות לא
	 * נמדדה, ואין לכלי דרך למדוד אותה. התוספת גם קטנה: ‏`org-1` ‏82%→83%
	 * מהתאים הייחודיים ו-61%→62% מכלל התאים. (לפני שדרגת `loose` הוגבלה
	 * לשתי מילים ומעלה היא נראתה שווה יותר — ‏88%/65% — אבל רוב התוספת ההיא
	 * הייתה שאילתות חד-מילתיות, כלומר "המילה מופיעה איפשהו": ‏`art` →
	 * "rock art cave". הן הוסרו, וזה מה שהפער בין המספרים מודד.)
	 */
	minMatch?: MatchQuality;
	/** ברירת-מחדל: `searchPictograms` מ-`$lib/services/arasaac`. */
	search?: PictogramSearch;
	/** ברירת-מחדל: קאש IDB משותף. `null` מבטל התמדה (בדיקות). */
	cache?: SymbolCache | null;
	/** גודל התמונה ב-URL של ARASAAC. */
	size?: number;
	/**
	 * כתובת-הבסיס של הוורקר שמגיש את סמלי ה-PCS מהדלי הפרטי.
	 *
	 * 🔑 **ריק ⇒ שכבת ה-PCS כבויה לגמרי**, וההתנהגות זהה למה שהיה לפניה. זו
	 * ברירת-המחדל כשאין `VITE_PROXY_URL`, והיא מכוונת: ‏build בלי פרוקסי לא
	 * אמור לייצר `<img>` שמצביע לשום מקום.
	 */
	pcsBaseUrl?: string;
}

// ── מפתח-החיפוש שנגזר מ-`ImageRef` ───────────────────────────────────────

const LIBRARY_PREFIX = /^\[[^\]]*\]/;
/** סיומת קובץ — `.emf`, `.wmf`, `.png`… */
const FILE_EXTENSION = /\.[a-z0-9]{1,5}$/i;
/** מספר-הבחנה בזנב: `what 1` → `what` · `turkey 1` → `turkey` */
const TRAILING_INDEX = /[\s_-]+\d+$/;
const HAS_LETTER = /\p{L}/u;

/**
 * שם-הבסיס האנגלי מתוך `ImageRef` — מפתח-החיפוש העיקרי.
 *
 * `{ library: 'widgit', path: 'widgit rebus\\h\\have.emf' }` → `'have'`
 * `{ library: 'grid3x', path: 'jump_back.wmf' }` → `'jump back'`
 *
 * מחזיר `null` כשאין מה לחפש:
 * - ‏`library` ריק — ‏ref לקובץ **מוטמע בתוך ה-.gridset** (`0.jpg`; קיים
 *   ב-org-3/4). אלה אינם חיפוש ב-ARASAAC אלא מקור-תמונה אחר, ראו את הדוח.
 * - שם שאין בו אף אות (`0`), או קצר מ-2 תווים.
 */
export function symbolBaseName(ref: ImageRef | undefined): string | null {
	if (!ref || !ref.library.trim()) return null;
	const path = ref.path.replace(LIBRARY_PREFIX, '');
	const leaf = path.split(/[\\/]/).pop() ?? '';
	const name = leaf
		.replace(FILE_EXTENSION, '')
		.replace(TRAILING_INDEX, '')
		.replace(/_/g, ' ')
		.trim();
	if (name.length < 2 || !HAS_LETTER.test(name)) return null;
	return name;
}

// ── PCS — שכבה ראשונה, ‏lookup מדויק ולא חיפוש ───────────────────────────

/** הספרייה של PCS ב-`ImageRef`. ‏ב-XML האמיתי מופיע גם `[MJPCS#]` וגם `[mjpcs#]`. */
const PCS_LIBRARY = 'mjpcs#';
/** מזהה עשרוני עירום — מה ש-`[MJPCS#]` נושא במקום מושג. */
const PCS_NUMERIC_ID = /^\d+$/;

/**
 * מזהה ה-PCS מתוך `ImageRef`, מרופד ל-5 ספרות — או `null`.
 *
 * `{ library: 'MJPCS#', path: '3424.wmf' }` → `'03424'`
 *
 * 🔑 **זה ההבדל מ-`symbolBaseName`, והוא העיקר.** שם-הבסיס מחפש *מושג*, ולכן
 * הוא מחזיר `null` לשם שאין בו אות — כלומר לכל הפניית PCS. כאן בדיוק ההיפך:
 * המספר **הוא** המפתח, והפתירה היא lookup ישיר לקובץ ולא ניחוש לפי מילה.
 *
 * מחזיר `null` כשהמזהה אינו מספרי. נמדד: **‏2 מ-123 המזהים בקורפוס** הם כאלה
 * — ‏`hebrew\db0201` ו-`hebrew\mop`. הם נושאים תיקיית-משנה `hebrew\`, ו-
 * ‏`PCS COLOR` שטוחה (‏`rclone lsd` החזיר אפס תיקיות) ⇒ **אין להם קובץ אצלנו.**
 */
export function pcsSymbolId(ref: ImageRef | undefined): string | null {
	if (!ref || ref.library.trim().toLowerCase() !== PCS_LIBRARY) return null;
	const path = ref.path.replace(LIBRARY_PREFIX, '');
	const leaf = path.split(/[\\/]/).pop() ?? '';
	const id = leaf.replace(FILE_EXTENSION, '').trim();
	if (!PCS_NUMERIC_ID.test(id)) return null;
	// ‏אין חיתוך ל-5: מזהה ארוך מזה פשוט לא יימצא במניפסט וייפול ל-ARASAAC,
	// ‏וזה עדיף על מפתח שקוצר בשקט והצביע לסמל **אחר**.
	return id.padStart(5, '0');
}

// ── אסיפת המועמדים מן התא, ודירוגם לפי `symbolSearchKeys` ─────────────────

function isRichText(v: ParamValue): v is RichText {
	return typeof v === 'object' && v !== null && 'paragraphs' in v;
}

/**
 * כל ה-`ImageRef` שהתא נושא: זה של התא (`CaptionAndImage/Image`), ואחריו אלה
 * שיושבים על המשפטים בתוך פרמטרי הפקודות (`<s Image=…>`).
 *
 * 🔑 הסמל יושב על המשפט ולא רק על התא (ראו `types.ts`), ולכן לתא יכולים להיות
 * כמה refs. נמדד ב-org-1: ‏18 מ-903 תאים · org-2: ‏137 מ-1,780.
 */
export function collectImageRefs(cell: Cell): ImageRef[] {
	const out: ImageRef[] = [];
	const seen = new Set<string>();
	const push = (ref: ImageRef | undefined) => {
		if (!ref) return;
		const key = `${ref.library}|${ref.path}`;
		if (seen.has(key)) return;
		seen.add(key);
		out.push(ref);
	};

	push(cell.image);
	for (const command of cell.commands) {
		for (const value of Object.values(command.params)) {
			if (!isRichText(value)) continue;
			for (const paragraph of value.paragraphs) {
				for (const sentence of paragraph.sentences) push(sentence.image);
			}
		}
	}
	return out;
}

/**
 * דירוג מועמדים לפי `GridSet.symbolSearchKeys` — סדר-העדיפות שנקבע
 * ב-`settings.xml` (`["widgit","sstix#","dbr#he"]`).
 *
 * 🛑 הרשימה מדרגת `ImageRef` מול `ImageRef` **בלבד**. היא אינה מכריעה בין
 * שם-הבסיס לכתובית — הכתובית תמיד אחרונה בסדר-הניסיונות, בלי קשר לרשימה.
 *
 * 🛑 ההשוואה חסרת-רגישות לאות גדולה: ב-XML האמיתי מופיעים גם `[WIDGIT]` וגם
 * `[widgit]`, גם `[GRID3X]` וגם `[grid3x]`, בעוד המפתחות רשומים בקטן.
 *
 * ספרייה שאינה ברשימה נדחקת לסוף אך אינה נפסלת — `grid3x` אינו ב-
 * `symbolSearchKeys` באף אחד מקובצי לוחות-הדגימה, והוא 21.7% מההפניות.
 * המיון יציב, ולכן `cell.image` מנצח בתיקו.
 */
export function rankImageRefs(refs: ImageRef[], symbolSearchKeys: string[]): ImageRef[] {
	const order = new Map(symbolSearchKeys.map((k, i) => [k.trim().toLowerCase(), i]));
	const rank = (ref: ImageRef) => order.get(ref.library.trim().toLowerCase()) ?? order.size;
	return refs
		.map((ref, i) => ({ ref, i, rank: rank(ref) }))
		.sort((a, b) => a.rank - b.rank || a.i - b.i)
		.map((e) => e.ref);
}

// ── נרמול והתאמה ─────────────────────────────────────────────────────────

/** ניקוד וטעמים עבריים — `U+0591..U+05C7`. */
const HEBREW_POINTS = /[֑-ׇ]/g;
const BIDI_MARKS = /[‎‏‪-‮]/g;
const EDGE_PUNCTUATION = /^[\s.,!?;:"'״׳()[\]]+|[\s.,!?;:"'״׳()[\]]+$/g;

/** נרמול להשוואה: NFC · בלי ניקוד · בלי סימני-כיווניות · אותיות קטנות. */
export function normalizeSearchTerm(text: string): string {
	return text
		.normalize('NFC')
		.replace(HEBREW_POINTS, '')
		.replace(BIDI_MARKS, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.replace(EDGE_PUNCTUATION, '');
}

function tokens(text: string): string[] {
	return normalizeSearchTerm(text)
		.split(/[\s\-/]+/)
		.filter(Boolean);
}

/**
 * בוחר סמל מתוך תוצאות החיפוש, בשתי דרגות.
 *
 * 🛑 **‏`results.length > 0` אינו התאמה.** ‏API של ARASAAC מחזיר גם התאמות-תת-
 * מחרוזת: ‏`en/art` מחזיר 381 תוצאות, הראשונה בהן היא "flute", ו**אף אחת מהן
 * אינה נושאת את מילת-המפתח `art`**; ‏`he/מיקום` מחזיר 1,193. לכן בודקים את
 * מילות-המפתח ולא לוקחים את `results[0]`.
 *
 * כמה זה קורה, נמדד ב-`symbols.measure.ts` (מעבר "הרעש של results[0]") על כל
 * 561 החיפושים של `org-1`: ‏**‏64 מ-281 באנגלית (23%) ו-149 מ-280 בעברית
 * (53%)** החזירו תוצאות שאין בהן אף מילת-מפתח זהה למה שחיפשנו. הגדול שבהם
 * החזיר 846 תוצאות. ‏`org-2`: ‏25% / 55%. ‏`org-3`: ‏36% / 41%.
 *
 * 🛑 המספרים האלה הם **חוסר-עיגון, לא שיעור-שגיאה**: הכלי אינו יודע מהו הסמל
 * הנכון, ואינו שולל שדווקא `results[0]` קלע במקרה.
 *
 * 🔑 דרגת `loose` דורשת **שתי מילות-חיפוש לפחות**. בשאילתה חד-מילתית "כל
 * מילות-החיפוש מוכלות במילת-מפתח" מתמוטט ל"המילה מופיעה איפשהו", וזה מייצר
 * התאמות שגויות מעצם בנייתן: ‏`art` היה מקבל "rock art cave" (ציור-מערות).
 */
export function pickPictogram(results: ArasaacResult[], query: string): CachedMatch {
	const normalized = normalizeSearchTerm(query);
	const queryTokens = new Set(tokens(query));
	const looseAllowed = queryTokens.size >= 2;
	const picked: CachedMatch = { exact: null, loose: null, keyword: null, looseKeyword: null };

	for (const result of results) {
		for (const { keyword } of result.keywords) {
			if (!keyword) continue;
			if (!picked.exact && normalizeSearchTerm(keyword) === normalized) {
				picked.exact = result._id;
				picked.keyword = keyword;
			}
			if (!picked.loose && looseAllowed) {
				const kwTokens = new Set(tokens(keyword));
				if ([...queryTokens].every((t) => kwTokens.has(t))) {
					picked.loose = result._id;
					picked.looseKeyword = keyword;
				}
			}
		}
		if (picked.exact) break;
	}
	return picked;
}

// ── שפה ──────────────────────────────────────────────────────────────────

/** `"he-IL"` → `"he"`. ‏ARASAAC מקבל קוד דו-אותי. */
export function primaryLanguage(language: string | undefined): string {
	const tag = (language ?? '').trim().toLowerCase().split(/[-_]/)[0];
	return tag.length === 2 ? tag : 'en';
}

// ── הפותר ────────────────────────────────────────────────────────────────

const NO_LIBRARY = 'none';
/** ‏`ImageRef` בלי ספרייה = קובץ מוטמע ב-.gridset. לא מחפשים אותו ב-ARASAAC. */
const EMBEDDED_LIBRARY = 'embedded';

interface Attempt {
	query: string;
	lang: string;
}

export function createSymbolResolver(
	gridSet: GridSet,
	options: SymbolResolverOptions = {}
): SymbolResolver {
	const search = options.search ?? ((keyword, lang) => searchPictograms(keyword, lang));
	const cache = options.cache === null ? null : (options.cache ?? createSymbolCache());
	const size = options.size ?? 300;
	const minMatch = options.minMatch ?? 'exact';
	// ‏אותו מקור של `proxy-client.ts` — הוורקר שמגיש את הדלי הפרטי. ריק ⇒ כבוי.
	const pcsBaseUrl = (
		options.pcsBaseUrl ??
		((typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) || '')
	).replace(/\/+$/, '');
	const captionLang = primaryLanguage(gridSet.language);

	const stats: SymbolResolverStats = {
		resolved: 0,
		unresolved: 0,
		byLibrary: {},
		resolvedByLibrary: {},
		byMatch: { exact: 0, loose: 0 },
		resolvedBySource: {}
	};

	/** תא שנפתר פעם אחת אינו נספר פעמיים ואינו נשלח שוב לרשת. */
	const perCell = new WeakMap<Cell, Promise<SymbolResolution>>();
	/** חיפוש שכבר רץ באותו רגע — כמה תאים חולקים מפתח אחד (`want.emf` ×20). */
	const inFlight = new Map<string, Promise<CachedMatch>>();

	async function lookup(query: string, lang: string): Promise<CachedMatch> {
		const key = `${lang}:${normalizeSearchTerm(query)}`;
		const running = inFlight.get(key);
		if (running) return running;

		const task = (async () => {
			const cached = await cache?.get(lang, query);
			if (cached) return cached;
			const picked = pickPictogram(await search(query, lang), query);
			await cache?.set(lang, query, picked);
			return picked;
		})();

		inFlight.set(key, task);
		try {
			return await task;
		} finally {
			inFlight.delete(key);
		}
	}

	function bump(library: string, resolution: SymbolResolution) {
		stats.byLibrary[library] = (stats.byLibrary[library] ?? 0) + 1;
		if (resolution.url) {
			stats.resolved += 1;
			stats.resolvedByLibrary[library] = (stats.resolvedByLibrary[library] ?? 0) + 1;
			stats.resolvedBySource[resolution.source] =
				(stats.resolvedBySource[resolution.source] ?? 0) + 1;
			if (resolution.match) stats.byMatch[resolution.match] += 1;
		} else {
			stats.unresolved += 1;
		}
	}

	async function resolveCell(cell: Cell): Promise<SymbolResolution> {
		const refs = rankImageRefs(collectImageRefs(cell), gridSet.symbolSearchKeys);
		const primary = refs[0];
		const library = !primary
			? NO_LIBRARY
			: primary.library.trim()
				? primary.library.trim().toLowerCase()
				: EMBEDDED_LIBRARY;

		// 🔑 **‏PCS קודם לכל חיפוש — וזה אינו "ניחוש טוב יותר" אלא סוג-ראיה אחר.**
		// ‏`[MJPCS#]` נושא מזהה מספרי, ולכן הפתירה היא **‏lookup ישיר לקובץ**:
		// ‏`id.zfill(5) + '.png'` בדלי. שכבות ה-ARASAAC שמתחת מתאימות *מילה*
		// לסמל, ולכן הן תמיד הימור. מדידה: ‏`org-3` נפתר ב-15% בלבד דרך
		// שם-הבסיס, כי אין במזהה מספרי מה לחפש.
		//
		// 🛑 **ורק אם הקובץ באמת בדלי** (`pcs-manifest.ts`). בלי הבדיקה הזאת
		// ‏PCS היה "מצליח" תמיד — ‏URL נבנה גם למזהה שאין לו קובץ — ו**מנצח**
		// את ARASAAC, שאולי כן היה פותר את התא דרך הכתובית העברית. התוצאה
		// הייתה החלפת סמל נכון ב-`<img>` שבור.
		//
		// עובר על **כל** ה-refs ולא רק על הראשון: תא יכול לשאת כמה refs
		// (נמדד: ‏18 מ-903 ב-`org-1`), והדירוג לפי `symbolSearchKeys` מדרג
		// מועמדים-לחיפוש — הוא לא נועד להכריע בין lookup לחיפוש.
		//
		// ‏`library` המדווח נשאר זה של ה-ref הראשון, כדי ש-`byLibrary` ישמור
		// על אותה סמנטיקה שנמדדה עד כה. ההפרדה בין המקורות היא ב-`resolvedBySource`.
		if (pcsBaseUrl) {
			for (const ref of refs) {
				const pcsId = pcsSymbolId(ref);
				if (pcsId !== null && PCS_AVAILABLE_IDS.has(pcsId)) {
					return {
						url: `${pcsBaseUrl}/v1/img/pcs/${pcsId}`,
						source: 'pcs',
						query: pcsId,
						library
					};
				}
			}
		}

		// 🛑 **הסדר בין שני המפתחות שרירותי, ומוצהר ככזה.** מה שנמדד הוא
		// *כיסוי* (`symbols.measure.ts` מחשב `resolved/total` ותו לא) — ומכיסוי
		// לא נובע מי צודק. כששני המפתחות מחזירים exact **שונה** ההכרעה כאן
		// נופלת על שם-הבסיס רק בגלל מקומו ברשימה, ולזה אין עיגון:
		//   `clear`  → "בהיר" במקום "מחק"  — הכתובית צדקה
		//   `money`  → "כסף" דו-משמעי      — שם-הבסיס צדק
		// המדידה כן אומרת על **כמה תאים זה בכלל משנה**, ולא מעט: ב-`org-1`
		// ‏117 מ-358 התאים הייחודיים מקבלים exact משני המפתחות, ו-**51 מהם
		// (44%) מצביעים על פיקטוגרם שונה** — כלומר ההכרעה השרירותית היא שקובעת
		// את הסמל ב-51 מ-292 התאים שנפתרו (17%). אין כלל מנצח; הכרעה מעוגנת
		// דורשת שיפוט אנושי לכל מקרה. ‏`org-2`: ‏81 מ-194 = 42%. הכלי מדפיס
		// זאת תחת "חפיפה וסתירה".
		const attempts: Attempt[] = [];
		for (const ref of refs) {
			const base = symbolBaseName(ref);
			if (base) attempts.push({ query: base, lang: 'en' });
		}
		const caption = normalizeSearchTerm(cell.caption ?? '');
		if (caption.length >= 2 && HAS_LETTER.test(caption)) {
			attempts.push({ query: caption, lang: captionLang });
		}

		const dedup = new Map<string, Attempt>();
		for (const a of attempts) dedup.set(`${a.lang}:${normalizeSearchTerm(a.query)}`, a);
		const ordered = [...dedup.values()];

		const unresolved: SymbolResolution = {
			url: null,
			source: 'none',
			query: ordered[0]?.query ?? '',
			library
		};

		// 🛑 פתירת-סמל אינה זורקת, בשום מצב. `searchPictograms` כבר קולט נפילת
		// רשת ומחזיר ריק; זה התופס לכל השאר (קאש שנשבר, חיפוש מוזרק שזרק).
		let found: CachedMatch[];
		try {
			found = await Promise.all(ordered.map((a) => lookup(a.query, a.lang)));
		} catch {
			return unresolved;
		}

		// מעבר ראשון על כל המפתחות — רק התאמות מדויקות. רק אחריו, אם הותר,
		// מעבר שני על ההתאמות הרופפות. כך התאמה מדויקת בכתובית העברית עדיפה
		// על התאמה רופפת בשם-הבסיס האנגלי, ולא רק על מה שבא אחריה בסדר.
		const tiers: MatchQuality[] = minMatch === 'loose' ? ['exact', 'loose'] : ['exact'];
		for (const tier of tiers) {
			for (let i = 0; i < ordered.length; i++) {
				const id = tier === 'exact' ? found[i].exact : found[i].loose;
				if (id === null) continue;
				return {
					url: pictogramUrl(id, size),
					source: 'arasaac',
					query: ordered[i].query,
					match: tier,
					lang: ordered[i].lang,
					keyword: (tier === 'exact' ? found[i].keyword : found[i].looseKeyword) ?? undefined,
					library
				};
			}
		}

		return unresolved;
	}

	return {
		resolve(cell) {
			const existing = perCell.get(cell);
			if (existing) return existing;
			const task = resolveCell(cell).then((resolution) => {
				bump(resolution.library, resolution);
				return resolution;
			});
			perCell.set(cell, task);
			return task;
		},
		stats() {
			return {
				resolved: stats.resolved,
				unresolved: stats.unresolved,
				byLibrary: { ...stats.byLibrary },
				resolvedByLibrary: { ...stats.resolvedByLibrary },
				byMatch: { ...stats.byMatch },
				resolvedBySource: { ...stats.resolvedBySource }
			};
		}
	};
}
