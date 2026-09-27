/**
 * מימוש `RuntimeContext` — המצב החי שפקודה יכולה לגעת בו.
 *
 * 🔑 זהו **הצד היחיד** של מנוע-הפקודות שמכיר מצב, ניווט ודיבור.
 * `commands.ts` מקבל את ההקשר הזה בהזרקה ואינו יודע עליו דבר — לכן הוא
 * נבדק בלי DOM ובלי stores.
 *
 * דיבור עובר דרך `src/lib/services/tts.ts` הקיים, ב-import דינמי: החוזה שלו
 * מקבל מחרוזת, וטקסט עשיר כבר הצטמצם אליה בחוצץ. 🛑 חוזה tts.ts אינו משתנה
 * כאן — הרחבתו לשני ערוצים (ציבורי ומשוב-פרטי) היא סלייס נפרד.
 */

import { WEB_FEATURES } from './features';
import { executeCommands, isCellAvailable } from './commands';
import { computeCoverage, formatCoverageReport, type CoverageReport } from './coverage';
import type {
	Cell,
	CommandId,
	FeatureId,
	GridSet,
	OutputItem,
	Page,
	RuntimeContext
} from './types';

/** מתאם-דיבור. מוזרק כדי שהמריץ ייבדק בלי דפדפן. */
export interface SpeechAdapter {
	speak(text: string, opts?: { lang?: string; auditory?: boolean; wait?: boolean }): void;
	stop(): void;
}

/**
 * המתאם האמיתי — `$lib/services/tts`. ה-import דינמי כדי ששרשרת ה-IndexedDB
 * וה-localStorage לא תיטען בסביבת בדיקה.
 */
export const ttsSpeechAdapter: SpeechAdapter = {
	speak(text, opts) {
		// 🛑 `auditory` (משוב פרטי לדובר) אינו נתמך ב-tts.ts היום — הכל יוצא
		// בערוץ הציבורי. הפיצול לשני ערוצים הוא סלייס נפרד.
		void import('$lib/services/tts').then(({ speak }) => speak(text, opts?.lang ?? 'he-IL'));
	},
	stop() {
		void import('$lib/services/tts').then(({ stopSpeaking }) => stopSpeaking());
	}
};

export interface RuntimeOptions {
	/** דף פתיחה. ברירת מחדל: `gridSet.startGrid`. */
	startPage?: string;
	/** קבוצת התכונות. ברירת מחדל: `WEB_FEATURES`. */
	features?: ReadonlySet<FeatureId>;
	/** מתאם-דיבור. ברירת מחדל: `ttsSpeechAdapter`. */
	speech?: SpeechAdapter;
	/** יעד `Jump.To` שאינו קיים ב-`pages`. ברירת מחדל: אזהרה בקונסול. */
	onMissingPage?(name: string): void;
	/** נקרא בפעם הראשונה שכל מזהה-פקודה נתקל בלי handler. */
	onUnimplemented?(id: CommandId): void;
}

/**
 * חוצץ-הפלט. 🔑 רשימת פריטים עם דקדוק — לא מחרוזת: `Action.InsertText`
 * נושאת gender/number/person/pos, וחוקי הנטייה העברית (plan.md שלב E)
 * יזדקקו להם. מחלקה נפרדת כדי שה-runes יחיו על האובייקט שמחזיק אותם.
 *
 * 🛑 **`items` חייב להישאר `$state`.** `ChatCell.svelte` (סלייס 4) קורא
 * `ctx.output.items` בתוך `$derived`; אם המערך יוחלף בשדה רגיל, פס-הפלט
 * פשוט לא יתעדכן — בלי שגיאה ובלי שבדיקה בצד אחד מהשניים תתפוס את זה.
 * `runtime.svelte.test.ts` מאמת את הריאקטיביות בדפדפן אמיתי.
 */
export class OutputBuffer {
	#items = $state<OutputItem[]>([]);
	/** האינדקס של הפריט שנבנה כרגע אות-אחר-אות; ‎-1 = אין כזה. */
	#letterIndex = $state(-1);

	get items(): readonly OutputItem[] {
		return this.#items;
	}

	/** תוכן החוצץ כמחרוזת אחת — מה ש-`Action.Speak` מקריא. */
	get text(): string {
		return this.#items
			.map((item) => item.text)
			.join(' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	insert(item: OutputItem): void {
		this.#items = [...this.#items, { ...item }];
		this.#letterIndex = -1;
	}

	/** אות מצטרפת למילה שבבנייה; אם אין כזו — נפתח פריט חדש. */
	insertLetter(letter: string): void {
		if (!letter) return;
		const current = this.#items[this.#letterIndex];
		if (this.#letterIndex >= 0 && current) {
			const items = [...this.#items];
			items[this.#letterIndex] = { ...current, text: current.text + letter };
			this.#items = items;
			return;
		}
		this.#items = [...this.#items, { text: letter }];
		this.#letterIndex = this.#items.length - 1;
	}

	/**
	 * ‏`Action.Punctuation` ו-`Action.Space` — **מצטרף לזרם בלי לפתוח פריט**.
	 *
	 * 🛑 הנימוק המלא ב-`types.ts` על `output.appendToStream`. בקצרה:
	 * ב-Grid חלל-העבודה הוא זרם-טקסט אחד, אצלנו רשימת פריטים, ו-`ChatCell`
	 * מחבר ברווח — ולכן פיסוק חייב להידבק, ורווח אינו שבב.
	 *
	 * ⚠️ **רווח מאפס את `#letterIndex` במפורש:** מילה שנבנתה אות-אחר-אות
	 * נסגרת, והאות הבאה פותחת פריט חדש. תו שאינו רווח משאיר את מצב-הבנייה
	 * כשהיה, כך ש-"ש·ל·ו·ם·!" נשאר פריט אחד.
	 */
	appendToStream(text: string): void {
		if (!text) return;
		const last = this.#items[this.#items.length - 1];
		// חוצץ ריק: רווח אינו פותח שבב (הוא היה נראה ריק); פיסוק כן.
		if (!last) {
			if (text.trim()) {
				this.#items = [{ text }];
				this.#letterIndex = -1;
			}
			return;
		}
		const items = [...this.#items];
		items[items.length - 1] = { ...last, text: last.text + text };
		this.#items = items;
		if (!text.trim()) this.#letterIndex = -1;
	}

	clear(): void {
		this.#items = [];
		this.#letterIndex = -1;
	}

	deleteWord(): void {
		if (this.#items.length === 0) return;
		this.#items = this.#items.slice(0, -1);
		this.#letterIndex = -1;
	}

	deleteLetter(): void {
		const last = this.#items[this.#items.length - 1];
		if (!last) return;
		if (last.text.length > 1) {
			const items = [...this.#items];
			items[items.length - 1] = { ...last, text: last.text.slice(0, -1) };
			this.#items = items;
			return;
		}
		this.#items = this.#items.slice(0, -1);
		this.#letterIndex = -1;
	}
}

/**
 * הקשר-הריצה של לוח אחד. Svelte 5 runes — הקומפוננטות קוראות
 * `runtime.page` / `runtime.output.items` והן מתעדכנות מאליהן.
 */
export class GridRuntime implements RuntimeContext {
	readonly gridSet: GridSet;
	readonly features: ReadonlySet<FeatureId>;
	readonly output = new OutputBuffer();

	#speech: SpeechAdapter;
	#onMissingPage: (name: string) => void;
	#onUnimplemented?: (id: CommandId) => void;

	#pageName = $state('');
	#history = $state<string[]>([]);
	#unimplemented = $state<Record<CommandId, number>>({});

	constructor(gridSet: GridSet, options: RuntimeOptions = {}) {
		this.gridSet = gridSet;
		this.features = options.features ?? WEB_FEATURES;
		this.#speech = options.speech ?? ttsSpeechAdapter;
		this.#onUnimplemented = options.onUnimplemented;
		this.#onMissingPage =
			options.onMissingPage ??
			((name) => console.warn(`[gridset] Jump.To ליעד שאינו קיים: "${name}"`));

		const names = Object.keys(gridSet.pages);
		if (names.length === 0) throw new Error('[gridset] GridSet בלי דפים');
		const wanted = options.startPage ?? gridSet.startGrid;
		this.#pageName = wanted in gridSet.pages ? wanted : names[0];
	}

	// ── מצב נגזר ───────────────────────────────────────────────────────────

	get page(): Page {
		return this.gridSet.pages[this.#pageName];
	}

	get pageName(): string {
		return this.#pageName;
	}

	/** מחסנית החזרה, מהישן לחדש. */
	get history(): readonly string[] {
		return this.#history;
	}

	/** תוכן החוצץ כמחרוזת אחת — מה ש-`Action.Speak` מקריא. */
	get outputText(): string {
		return this.output.text;
	}

	/** מונה הפקודות שנתקלנו בהן בלי handler. */
	get unimplemented(): Readonly<Record<CommandId, number>> {
		return this.#unimplemented;
	}

	// ── ניווט ──────────────────────────────────────────────────────────────

	navigate(pageName: string): void {
		if (!(pageName in this.gridSet.pages)) {
			this.#onMissingPage(pageName);
			return;
		}
		if (pageName === this.#pageName) return;
		this.#history = [...this.#history, this.#pageName];
		this.#pageName = pageName;
	}

	/** מחסנית ריקה אינה שגיאה — פשוט נשארים בדף. */
	back(): void {
		if (this.#history.length === 0) return;
		const previous = this.#history[this.#history.length - 1];
		this.#history = this.#history.slice(0, -1);
		this.#pageName = previous;
	}

	/**
	 * חזרה ל-`startGrid`. המחסנית מתאפסת — "בית" הוא נקודת-התחלה, ולא עוד
	 * צעד קדימה שאפשר לחזור ממנו.
	 */
	home(): void {
		const home = this.gridSet.startGrid;
		if (!(home in this.gridSet.pages)) {
			this.#onMissingPage(home);
			return;
		}
		this.#history = [];
		this.#pageName = home;
	}

	// ── דיבור ──────────────────────────────────────────────────────────────

	/** בלי ארגומנט — מקריא את כל החוצץ (`Action.Speak` עם `unit=All`). */
	speak(text?: string, opts?: { auditory?: boolean; wait?: boolean }): void {
		const value = text ?? this.outputText;
		if (!value.trim()) return;
		this.#speech.speak(value, { ...opts, lang: this.gridSet.language });
	}

	stopSpeaking(): void {
		this.#speech.stop();
	}

	// ── פקודות לא-ממומשות ──────────────────────────────────────────────────

	/**
	 * נצבר במונה. לעולם לא זורק ולא שותק — מודפס פעם אחת לכל מזהה.
	 * מקבל גם פקודות בלי handler וגם הצהרות-דרישה שלא ניתן היה להכריע.
	 */
	reportUnimplemented(id: CommandId): void {
		const seen = this.#unimplemented[id] ?? 0;
		this.#unimplemented = { ...this.#unimplemented, [id]: seen + 1 };
		if (seen === 0) {
			this.#onUnimplemented?.(id);
			if (import.meta.env.DEV) console.warn(`[gridset] דווח כלא-נתמך: ${id}`);
		}
	}

	// ── נוחות לקומפוננטות ──────────────────────────────────────────────────

	/**
	 * מריץ את שרשרת-הפקודות של התא בהקשר הזה.
	 * 🔑 נקרא **רק על תא זמין** — הזמינות נבדקת ברינדור, לא כאן.
	 *
	 * מחזיר `Promise` בגלל `CommandExecution.Wait` בלבד. שרשרת שאין בה השהיה
	 * מסתיימת **סינכרונית**, לפני שהקריאה חוזרת — ראו `executeCommandChain`.
	 */
	activate(cell: Cell): Promise<void> {
		return executeCommands(cell, this);
	}

	/**
	 * שער-הרינדור: האם התא זמין בהקשר הזה. תא שאינו זמין אינו מצויר אך
	 * שומר את משבצתו. הצהרה שלא ניתן להכריע נספרת ב-`reportUnimplemented`.
	 */
	isCellAvailable(cell: Cell): boolean {
		return isCellAvailable(cell, this.features, (id) => this.reportUnimplemented(id));
	}

	coverage(): CoverageReport {
		return computeCoverage(this.#unimplemented);
	}

	coverageReport(): string {
		return formatCoverageReport(this.coverage());
	}
}

/** יצירת הקשר-ריצה. */
export function createRuntime(gridSet: GridSet, options?: RuntimeOptions): GridRuntime {
	return new GridRuntime(gridSet, options);
}
