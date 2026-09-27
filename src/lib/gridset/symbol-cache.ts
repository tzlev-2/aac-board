/**
 * התמדה לפתירת-סמלים: ‏(שפה, מפתח-חיפוש) → מזהה הפיקטוגרם שנבחר.
 *
 * 🔑 **אין כאן קאש שלישי.** ‏`src/lib/services/cache/` הוא קאש **אודיו/TTS
 * בלבד** — ‏`audio-cache.ts` מקבל `TtsRequest`, מפתחו מחושב ב-`hash.ts` מ-
 * `provider|voiceId|modelId|text`, והוא פונה ל-`/v1/tts` ב-proxy ומחזיר `Blob`.
 * אין בו שום דבר שניתן לשימוש חוזר לחיפוש-מילה. מה שכן משותף:
 *
 * - **אותו מסד ואותו store** — ‏`createStore('aac-cache', 'keyval')` של
 *   `idb-keyval`, כמו ב-`audio-cache.ts`. תחילית `symbol:` מפרידה מ-`audio:`,
 *   ולכן פיזית זה קאש **אחד** עם שני מרחבי-שמות.
 * - **אותה תבנית** — ‏store lazy, הזרקת תלויות ל-`deps`, בלי גלובל מוסתר.
 *
 * מה שלא נלקח: ‏`hash.ts`. מפתח-החיפוש קצר ודטרמיניסטי, ומפתח IDB יכול להיות
 * מחרוזת — גיבוב היה מסתיר את מה שנשמר בלי להרוויח כלום.
 *
 * מה שנשמר הוא **מזהה**, לא תמונה: ה-URL של ARASAAC סטטי
 * (`static.arasaac.org/pictograms/<id>/<id>_300.png`) ונשמר בקאש-ה-HTTP של
 * הדפדפן. מה שיקר כאן הוא קריאת-החיפוש, לא הבייטים.
 */

import { createStore, get, set } from 'idb-keyval';

type UseStore = ReturnType<typeof createStore>;

const SYMBOL_PREFIX = 'symbol:';

/**
 * שתי הדרגות נשמרות יחד, כך שאותה רשומה משרתת גם `minMatch: 'exact'` וגם
 * `'loose'` — שינוי המדיניות אינו מצריך חיפוש מחדש.
 */
export interface CachedMatch {
	exact: number | null;
	loose: number | null;
	/** מילת-המפתח שהתאימה במדויק — לדיאגנוסטיקה. */
	keyword: string | null;
	/** מילת-המפתח של ההתאמה הרופפת. */
	looseKeyword: string | null;
}

export interface SymbolCache {
	get(lang: string, query: string): Promise<CachedMatch | undefined>;
	set(lang: string, query: string, value: CachedMatch): Promise<void>;
}

let _defaultStore: UseStore | undefined;

/** ה-store המשותף (אתחול עצל) — אותו מסד שבו יושב קאש האודיו. */
function getDefaultStore(): UseStore {
	if (!_defaultStore) {
		_defaultStore = createStore('aac-cache', 'keyval');
	}
	return _defaultStore;
}

function hasIndexedDb(): boolean {
	return typeof indexedDB !== 'undefined';
}

function cacheKey(lang: string, query: string): string {
	return `${SYMBOL_PREFIX}${lang}:${query.trim().toLowerCase()}`;
}

/**
 * קאש דו-שכבתי: ‏Map בזיכרון לפני IDB.
 *
 * 🛑 בלי `indexedDB` (‏SSR, או בדיקות-Node) השכבה המתמידה **מושתקת בשקט** —
 * הזיכרון לבד. פתירת-סמל אינה צריכה להיכשל בגלל שאין מסד.
 *
 * @param deps דריסות לבדיקות: ‏store משלך, או `persist: false`.
 */
export function createSymbolCache(deps?: { store?: UseStore; persist?: boolean }): SymbolCache {
	const memory = new Map<string, CachedMatch>();
	const persist = deps?.persist ?? hasIndexedDb();
	const store = deps?.store ?? (persist && hasIndexedDb() ? getDefaultStore() : undefined);

	return {
		async get(lang, query) {
			const key = cacheKey(lang, query);
			const inMemory = memory.get(key);
			if (inMemory) return inMemory;
			if (!store) return undefined;
			const stored = await get<CachedMatch>(key, store).catch(() => undefined);
			if (stored) memory.set(key, stored);
			return stored;
		},
		async set(lang, query, value) {
			const key = cacheKey(lang, query);
			memory.set(key, value);
			if (!store) return;
			await set(key, value, store).catch(() => undefined);
		}
	};
}
