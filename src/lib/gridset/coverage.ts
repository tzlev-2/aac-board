/**
 * דוח כיסוי — מדד ההתקדמות של הקלון.
 *
 * הקטלוג מונה 353 פקודות; בלוחות שנותחו בשימוש 63. הדוח עונה על שתי שאלות:
 * כמה מה-63 ממומשות, וכמה **מההפעלות בפועל** הן מכסות — הכיסוי המשוקלל הוא
 * המספר המעניין, כי תשע פקודות מכסות 91.5% מההפעלות.
 *
 * מקור הנתונים: grid-reference/derived/commands.tsv (העמודה `used_by_us`).
 * 🛑 טבלה מועתקת, לא מחושבת בזמן ריצה — ה-TSV אינו חלק מהריפו.
 */

import { commandRegistry } from './commands';
import type { CommandId } from './types';

export interface UsedCommand {
	id: CommandId;
	/** הפעלות בלוחות-הדגימה (`used_by_us`). */
	uses: number;
}

/** גודל הקטלוג המלא ב-commands.tsv. */
export const CATALOG_SIZE = 353;

/** 63 הפקודות שנצפו בלוחות-הדגימה, מהנפוצה לנדירה. */
export const USED_COMMANDS: readonly UsedCommand[] = [
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

/** סך ההפעלות בלוחות-הדגימה (4,052). */
export const TOTAL_ACTIVATIONS = USED_COMMANDS.reduce((sum, c) => sum + c.uses, 0);

export interface CoverageReport {
	/** פקודות שיש להן handler והן בשימוש בלוחות-הדגימה. */
	implemented: readonly UsedCommand[];
	/** פקודות שבשימוש ואין להן handler. */
	missing: readonly UsedCommand[];
	/** handlers שאינם ברשימת ה-63 (פקודה נדירה שמומשה מראש). */
	extra: readonly CommandId[];
	implementedCount: number;
	usedCount: number;
	catalogSize: number;
	/** הפעלות מכוסות מתוך TOTAL_ACTIVATIONS. */
	coveredActivations: number;
	totalActivations: number;
	/** אחוז הפקודות (9/63) ואחוז ההפעלות (91.5%). */
	commandPct: number;
	activationPct: number;
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
		unimplementedSeen
	};
}

function pct(part: number, whole: number): number {
	if (whole === 0) return 0;
	return Math.round((part / whole) * 1000) / 10;
}

/** הדוח כטקסט — שורה ראשונה מסכמת, ואחריה מה שחסר. */
export function formatCoverageReport(report: CoverageReport): string {
	const lines = [
		`כיסוי פקודות gridset: ${report.implementedCount}/${report.usedCount} פקודות בשימוש ` +
			`(${report.commandPct}%) · ${report.coveredActivations}/${report.totalActivations} הפעלות ` +
			`(${report.activationPct}%) · הקטלוג המלא: ${report.catalogSize}`
	];

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
