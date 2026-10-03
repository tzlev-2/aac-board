/**
 * דוח כיסוי — מדד ההתקדמות של הקלון.
 *
 * הקטלוג מונה 353 פקודות. הדוח עונה על שתי שאלות: כמה מהפקודות שבשימוש
 * ממומשות, וכמה **מההפעלות בפועל** הן מכסות — הכיסוי המשוקלל הוא המספר
 * המעניין, כי ‏15 פקודות מכסות 95.3% מההפעלות.
 *
 * 🛑 **תוקן 28.9.2026 — המכנה היה חלקי.** הגרסה הקודמת ספרה **רמה אחת**,
 * `/Grid/Cells/Cell/Content/Commands` (‏4,052 הפעלות, ‏63 מזהים), ושתי רמות
 * נוספות נפלו מחוץ לטווח לגמרי. המשמעות: **המדד יכול היה לטפס ל-100% בזמן
 * ש-33.7% מהתאים מתים**, כי `AutoContent.Activate` — הפקודה שמפעילה
 * ‏2,025 תאי `AutoContent` — לא הופיעה במכנה ולכן לא נספרה כחסרה.
 *
 * שלוש הרמות, כפי שנמדדו 28.9.2026 על `org-1..org-4` (הסקריפט סופר את
 * שלושת הנתיבים ומשחזר את ‏4,052/63 של הרמה הראשונה — כך אומתה השיטה):
 *
 * | רמה | נתיב ב-XML | הפעלות | מזהים |
 * |---|---|---:|---:|
 * | `cell` | `/Grid/Cells/Cell/Content/Commands` | 4,052 | 63 |
 * | `autoContent` | `/Grid/AutoContentCommands/…/Commands` | 166 | 4 |
 * | `page` | `/Grid/Commands` | 4 | 2 |
 *
 * סך הכול **4,222 הפעלות · 66 מזהים** (איחוד — שלושה מזהים קיימים רק
 * ברמות החדשות).
 *
 * מקור הנתונים: grid-reference/derived/commands.tsv (העמודה `used_by_us`)
 * לרמת-התא, ומדידה ישירה על ארבעת הלוחות לשתי הרמות האחרות.
 * 🛑 טבלה מועתקת, לא מחושבת בזמן ריצה — הקבצים אינם חלק מהריפו.
 */

import { commandRegistry } from './commands';
import type { CommandId } from './types';

/** היכן ה-XML מחזיק את השרשרת. שלוש רמות, ולא אחת. */
export type CommandLevel = 'cell' | 'autoContent' | 'page';

export const COMMAND_LEVELS: readonly CommandLevel[] = ['cell', 'autoContent', 'page'];

export interface UsedCommand {
	id: CommandId;
	/** הפעלות בלוחות-הדגימה (`used_by_us`). */
	uses: number;
}

/** גודל הקטלוג המלא ב-commands.tsv. */
export const CATALOG_SIZE = 353;

/*
 * 🔑 **אומת עצמאית 28.9.2026 (סלייס 11).** הטבלאות כאן מועתקות ולא מחושבות,
 * ולכן נספרו מחדש מאפס מתוך ארבעת קובצי ה-`.gridset` — לא מ-`commands.tsv`.
 *
 * הנשא שנספר: **אלמנט `<Command>` עם מאפיין `ID`**, בתוך `grid.xml` שתחת
 * `Grids/` בלבד, מקובץ לפי **נתיב ה-XML** שלו. שלושת הנתיבים הסתכמו
 * ב-4,052 / 166 / 4 — כלומר בדיוק הטבלה שלמטה, כולל פילוח הרמות.
 *
 * ⚠️ **מה עוד יכול לשאת את אותם מזהים, ולא נספר כאן:** ‏(א) מאפיין
 * ‏`AutoContentType` ושמות-סוגים ב-`ContentSubType`, שאינם פקודות; ‏(ב) קבצים
 * מחוץ ל-`Grids/` — ‏`settings.xml`, וקובצי נושא/סגנון; ‏(ג) מזהי-פקודה
 * שמופיעים כטקסט בתוך תוויות. ספירת-טקסט גולמית (`grep -c`) הייתה מערבת
 * את שלושתם. **רק אלמנטים נספרו.**
 *
 * ‏`org-1` בלבד, לצורך קריטריון-הקבלה של סלייס 11:
 * ‏תא 1,085 · `autoContent` 66 · דף 1 = **1,152 הפעלות**.
 */

/** רמת-התא: 63 הפקודות שנצפו בלוחות-הדגימה, מהנפוצה לנדירה. */
export const CELL_COMMANDS: readonly UsedCommand[] = [
	{ id: 'Action.InsertText', uses: 1736 },
	{ id: 'Jump.To', uses: 464 },
	{ id: 'Jump.Back', uses: 375 },
	{ id: 'Jump.Home', uses: 262 },
	{ id: 'Action.Clear', uses: 212 },
	{ id: 'Action.Speak', uses: 212 },
	{ id: 'Action.DeleteWord', uses: 204 },
	{ id: 'Settings.RequiredFeature', uses: 126 },
	{ id: 'Action.Letter', uses: 118 },
	{ id: 'Settings.RestAll', uses: 64 },
	{ id: 'CommandExecution.Wait', uses: 44 },
	{ id: 'Action.Punctuation', uses: 33 },
	{ id: 'Action.Number', uses: 30 },
	{ id: 'Action.Space', uses: 30 },
	{ id: 'Action.DeleteLetter', uses: 13 },
	{ id: 'Action.InsertCellText', uses: 12 },
	{ id: 'Settings.SetScreenBrightness', uses: 12 },
	{ id: 'SpeechPlaySound', uses: 12 },
	{ id: 'ClockSpeakTime', uses: 4 },
	{ id: 'Settings.GridExplorer', uses: 4 },
	{ id: 'Speech.SpeechMute', uses: 4 },
	{ id: 'Speech.SpeechVolumeDown', uses: 4 },
	{ id: 'Speech.SpeechVolumeUp', uses: 4 },
	{ id: 'ComputerControl.Shift', uses: 3 },
	{ id: 'Calculator.Add', uses: 2 },
	{ id: 'Calculator.Clear', uses: 2 },
	{ id: 'Calculator.Divide', uses: 2 },
	{ id: 'Calculator.Eight', uses: 2 },
	{ id: 'Calculator.Equals', uses: 2 },
	{ id: 'Calculator.Five', uses: 2 },
	{ id: 'Calculator.Four', uses: 2 },
	{ id: 'Calculator.Multiply', uses: 2 },
	{ id: 'Calculator.Nine', uses: 2 },
	{ id: 'Calculator.One', uses: 2 },
	{ id: 'Calculator.Seven', uses: 2 },
	{ id: 'Calculator.Six', uses: 2 },
	{ id: 'Calculator.Subtract', uses: 2 },
	{ id: 'Calculator.Three', uses: 2 },
	{ id: 'Calculator.Two', uses: 2 },
	{ id: 'Calculator.Zero', uses: 2 },
	{ id: 'Photos.ChangeCamera', uses: 2 },
	{ id: 'Photos.Next', uses: 2 },
	{ id: 'Photos.Previous', uses: 2 },
	{ id: 'Photos.Snapshot', uses: 2 },
	{ id: 'SettingsCalibrateEyeGaze', uses: 2 },
	{ id: 'Settings.EyeGazeDwellLonger', uses: 2 },
	{ id: 'Settings.EyeGazeDwellShorter', uses: 2 },
	{ id: 'SettingsImproveEyeGazeCalibration', uses: 2 },
	{ id: 'Settings.PointerDwellLonger', uses: 2 },
	{ id: 'Settings.PointerDwellShorter', uses: 2 },
	{ id: 'Settings.ScanspeedFaster', uses: 2 },
	{ id: 'Settings.ScanspeedSlower', uses: 2 },
	{ id: 'Settings.ToggleMenu', uses: 2 },
	{ id: 'Settings.TouchDwellLonger', uses: 2 },
	{ id: 'Settings.TouchDwellShorter', uses: 2 },
	{ id: 'Action.Enter', uses: 1 },
	{ id: 'Action.NextLetter', uses: 1 },
	{ id: 'Action.PreviousLetter', uses: 1 },
	{ id: 'Photos.MorePhotos', uses: 1 },
	{ id: 'Prediction.AddToWordList', uses: 1 },
	{ id: 'Prediction.DeleteWord', uses: 1 },
	{ id: 'Speech.SpeakNow', uses: 1 },
	{ id: 'Speech.Stop', uses: 1 }
];

/**
 * רמת-הדף, `AutoContentCommands` — **166 הפעלות, ארבעה מזהים בלבד.**
 * 🔑 `AutoContent.Activate` היא 158 מהן, והיא **הפקודה השמינית בשכיחות**
 * כשסופרים את שלוש הרמות יחד. היא אינה מופיעה ברמת-התא אפילו פעם אחת.
 */
export const AUTO_CONTENT_COMMANDS: readonly UsedCommand[] = [
	{ id: 'AutoContent.Activate', uses: 158 },
	{ id: 'Action.InsertText', uses: 3 },
	{ id: 'Jump.Back', uses: 3 },
	{ id: 'Jump.To', uses: 2 }
];

/** רמת-הדף, `/Grid/Commands` — ‏4 הפעלות. זנב, אבל זנב שנספר. */
export const PAGE_COMMANDS: readonly UsedCommand[] = [
	{ id: 'Photos.SnapshotsFolder', uses: 2 },
	{ id: 'Prediction.PredictConjugations', uses: 2 }
];

/** הטבלה לפי רמה — מקור-האמת; כל השאר נגזר ממנה. */
export const USED_BY_LEVEL: Readonly<Record<CommandLevel, readonly UsedCommand[]>> = {
	cell: CELL_COMMANDS,
	autoContent: AUTO_CONTENT_COMMANDS,
	page: PAGE_COMMANDS
};

/**
 * איחוד שלוש הרמות: **66 מזהים**, מהנפוץ לנדיר. מזהה שמופיע בכמה רמות
 * (`Action.InsertText`, `Jump.To`, `Jump.Back`) נספר פעם אחת, עם סכום
 * ההפעלות שלו.
 */
export const USED_COMMANDS: readonly UsedCommand[] = mergeLevels();

function mergeLevels(): UsedCommand[] {
	const totals = new Map<CommandId, number>();
	for (const level of COMMAND_LEVELS) {
		for (const c of USED_BY_LEVEL[level]) {
			totals.set(c.id, (totals.get(c.id) ?? 0) + c.uses);
		}
	}
	return [...totals]
		.map(([id, uses]) => ({ id, uses }))
		.sort((a, b) => b.uses - a.uses || a.id.localeCompare(b.id));
}

/** סך ההפעלות בלוחות-הדגימה בשלוש הרמות (4,222). */
export const TOTAL_ACTIVATIONS = USED_COMMANDS.reduce((sum, c) => sum + c.uses, 0);

/** כיסוי של רמה אחת — הפעלות, מזהים, ומה שחסר בה. */
export interface LevelCoverage {
	level: CommandLevel;
	coveredActivations: number;
	totalActivations: number;
	activationPct: number;
	implementedCount: number;
	usedCount: number;
	missing: readonly UsedCommand[];
}

export interface CoverageReport {
	/** פקודות שיש להן handler והן בשימוש בלוחות-הדגימה. */
	implemented: readonly UsedCommand[];
	/** פקודות שבשימוש ואין להן handler. */
	missing: readonly UsedCommand[];
	/** handlers שאינם ברשימת ה-66 (פקודה נדירה שמומשה מראש). */
	extra: readonly CommandId[];
	implementedCount: number;
	usedCount: number;
	catalogSize: number;
	/** הפעלות מכוסות מתוך TOTAL_ACTIVATIONS. */
	coveredActivations: number;
	totalActivations: number;
	/** אחוז הפקודות (10/66) ואחוז ההפעלות (91.8%). */
	commandPct: number;
	activationPct: number;
	/**
	 * 🔑 הפילוח שבלעדיו המדד משקר: רמת-התא יכולה לעמוד על 91.5% בזמן
	 * שרמת-`autoContent` על 0% — וזה בדיוק מה שהיה עד הסלייס הזה.
	 */
	byLevel: Readonly<Record<CommandLevel, LevelCoverage>>;
	/**
	 * מה שדווח בריצה כלא-נתמך — מ-`ctx.reportUnimplemented`. כולל גם פקודות
	 * בלי handler וגם הצהרות-דרישה שלא ניתן היה להכריע
	 * (`Settings.RequiredFeature(no-param)`), ולכן אלה אינם בהכרח מזהי-פקודה.
	 */
	unimplementedSeen: readonly UsedCommand[];
}

/** מונה ההפעלות-החסרות כפי ש-`RuntimeContext.reportUnimplemented` צובר אותו. */
export type UnimplementedCounts = Readonly<Record<CommandId, number>>;

/**
 * מחשב את דוח הכיסוי מול הרג'יסטרי הנוכחי.
 *
 * @param seen מונה אופציונלי של פקודות שנתקלנו בהן בריצה ואין להן handler.
 */
export function computeCoverage(seen?: UnimplementedCounts): CoverageReport {
	const handled = new Set(Object.keys(commandRegistry));
	const implemented = USED_COMMANDS.filter((c) => handled.has(c.id));
	const missing = USED_COMMANDS.filter((c) => !handled.has(c.id));
	const usedIds = new Set(USED_COMMANDS.map((c) => c.id));
	const extra = [...handled].filter((id) => !usedIds.has(id));

	const coveredActivations = implemented.reduce((sum, c) => sum + c.uses, 0);

	const byLevel = Object.fromEntries(
		COMMAND_LEVELS.map((level) => [level, levelCoverage(level, handled)])
	) as Record<CommandLevel, LevelCoverage>;

	const unimplementedSeen = Object.entries(seen ?? {})
		.map(([id, uses]) => ({ id, uses }))
		.sort((a, b) => b.uses - a.uses || a.id.localeCompare(b.id));

	return {
		implemented,
		missing,
		extra,
		implementedCount: implemented.length,
		usedCount: USED_COMMANDS.length,
		catalogSize: CATALOG_SIZE,
		coveredActivations,
		totalActivations: TOTAL_ACTIVATIONS,
		commandPct: pct(implemented.length, USED_COMMANDS.length),
		activationPct: pct(coveredActivations, TOTAL_ACTIVATIONS),
		byLevel,
		unimplementedSeen
	};
}

function levelCoverage(level: CommandLevel, handled: ReadonlySet<CommandId>): LevelCoverage {
	const table = USED_BY_LEVEL[level];
	const done = table.filter((c) => handled.has(c.id));
	const missing = table.filter((c) => !handled.has(c.id));
	const covered = done.reduce((sum, c) => sum + c.uses, 0);
	const total = table.reduce((sum, c) => sum + c.uses, 0);
	return {
		level,
		coveredActivations: covered,
		totalActivations: total,
		activationPct: pct(covered, total),
		implementedCount: done.length,
		usedCount: table.length,
		missing
	};
}

function pct(part: number, whole: number): number {
	if (whole === 0) return 0;
	return Math.round((part / whole) * 1000) / 10;
}

/** שמות-הרמות לדוח. `cell` = השרשרת על התא · `autoContent`/`page` = על הדף. */
const LEVEL_LABELS: Readonly<Record<CommandLevel, string>> = {
	cell: 'תא',
	autoContent: 'AutoContent',
	page: 'דף'
};

/** הדוח כטקסט — שורה ראשונה מסכמת, ואחריה מה שחסר. */
export function formatCoverageReport(report: CoverageReport): string {
	const lines = [
		`כיסוי פקודות gridset: ${report.implementedCount}/${report.usedCount} פקודות בשימוש ` +
			`(${report.commandPct}%) · ${report.coveredActivations}/${report.totalActivations} הפעלות ` +
			`(${report.activationPct}%) · הקטלוג המלא: ${report.catalogSize}`
	];

	// 🛑 שורת-הרמות אינה קישוט: היא ההבדל בין "‏91.8% מכוסה" לבין לדעת
	// ש-`page` עומד על 0/4. `PredictThis` אינו במכנה org-* ולכן כיסוי
	// הארגון אינו סוגר Prediction.
	lines.push(
		'לפי רמה: ' +
			COMMAND_LEVELS.map((level) => {
				const l = report.byLevel[level];
				return (
					`${LEVEL_LABELS[level]} ${l.coveredActivations}/${l.totalActivations} ` +
					`(${l.activationPct}%) · ${l.implementedCount}/${l.usedCount} פקודות`
				);
			}).join(' · ')
	);

	if (report.missing.length > 0) {
		const top = report.missing.slice(0, 10).map((c) => `${c.id} (${c.uses})`);
		lines.push(`חסרות, לפי שכיחות: ${top.join(' · ')}`);
		if (report.missing.length > top.length) {
			lines.push(`ועוד ${report.missing.length - top.length} פקודות בזנב.`);
		}
	}

	if (report.extra.length > 0) {
		lines.push(`ממומשות מחוץ ל-63: ${report.extra.join(' · ')}`);
	}

	if (report.unimplementedSeen.length > 0) {
		const hit = report.unimplementedSeen.map((c) => `${c.id}×${c.uses}`);
		lines.push(`דווח כלא-נתמך בריצה: ${hit.join(' · ')}`);
	}

	return lines.join('\n');
}

/** קיצור: מחשב ומחזיר את הדוח כטקסט. */
export function coverageSummary(seen?: UnimplementedCounts): string {
	return formatCoverageReport(computeCoverage(seen));
}
