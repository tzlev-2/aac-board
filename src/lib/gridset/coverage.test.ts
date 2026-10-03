/** בדיקות דוח הכיסוי — המדד שמראה כמה מהלוחות האמיתיים כבר עובדים. */

import { describe, expect, it } from 'vitest';
import {
	AUTO_CONTENT_COMMANDS,
	CATALOG_SIZE,
	CELL_COMMANDS,
	PAGE_COMMANDS,
	TOTAL_ACTIVATIONS,
	USED_COMMANDS,
	computeCoverage,
	coverageSummary
} from './coverage';
import { commandRegistry } from './commands';

describe('טבלת השימוש — שלוש רמות', () => {
	it('66 מזהים באיחוד, מתוך קטלוג של 353', () => {
		expect(USED_COMMANDS).toHaveLength(66);
		expect(CATALOG_SIZE).toBe(353);
	});

	it('כל רמה נספרת בנפרד — 4,052 · 166 · 4', () => {
		const sum = (t: readonly { uses: number }[]) => t.reduce((n, c) => n + c.uses, 0);
		expect(sum(CELL_COMMANDS)).toBe(4052);
		expect(CELL_COMMANDS).toHaveLength(63);
		expect(sum(AUTO_CONTENT_COMMANDS)).toBe(166);
		expect(sum(PAGE_COMMANDS)).toBe(4);
	});

	it('🛑 המכנה הוא סך שלוש הרמות, לא רמת-התא בלבד', () => {
		expect(TOTAL_ACTIVATIONS).toBe(4222);
	});

	it('🔑 AutoContent.Activate קיימת רק ברמת-הדף, ובכל זאת נספרת', () => {
		expect(CELL_COMMANDS.some((c) => c.id === 'AutoContent.Activate')).toBe(false);
		expect(USED_COMMANDS.find((c) => c.id === 'AutoContent.Activate')?.uses).toBe(158);
	});

	it('מזהה שמופיע בשתי רמות נספר פעם אחת, עם הסכום', () => {
		// Action.InsertText: 1,736 על התא + 3 ב-AutoContentCommands.
		expect(USED_COMMANDS.find((c) => c.id === 'Action.InsertText')?.uses).toBe(1739);
	});

	it('אין כפילויות במזהים', () => {
		expect(new Set(USED_COMMANDS.map((c) => c.id)).size).toBe(USED_COMMANDS.length);
	});
});

describe('computeCoverage', () => {
	it('שמונה-עשרה פקודות מתוך 66', () => {
		const report = computeCoverage();
		// ‏🛑 ‏18 ולא 22. ברג׳יסטרי יש 22 handlers, אבל ארבעה מהם
		// (`Settings.RestEyeGaze` · `RestPointer` · `RestSwitch` ·
		// `Prediction.PredictThis`) **אינם מופיעים כלל** בארבעת לוחות-הדגימה,
		// ולכן אינם נספרים כאן. הם יושבים ב-`report.extra`.
		expect(report.implementedCount).toBe(18);
		expect(report.usedCount).toBe(66);
	});

	it('שמונה-עשרה הפקודות מכסות 97.4% מההפעלות', () => {
		const report = computeCoverage();
		// ‏4,025 אחרי סלייס 11 · ‏+88 משלוש פקודות סלייס 13 בלוחות-הדגימה
		// (`Settings.RestAll` 32 · `Action.InsertCellText` 51 · `SpeechPlaySound` 5).
		expect(report.coveredActivations).toBe(4113);
		expect(report.activationPct).toBe(97.4);
	});

	it('🔑 הפילוח לפי רמה — autoContent מלא, page ריק', () => {
		const { byLevel } = computeCoverage();
		expect(byLevel.cell.coveredActivations).toBe(3947);
		expect(byLevel.cell.activationPct).toBe(97.4);
		expect(byLevel.autoContent).toMatchObject({
			coveredActivations: 166,
			totalActivations: 166,
			activationPct: 100
		});
		expect(byLevel.page).toMatchObject({ coveredActivations: 0, activationPct: 0 });
		expect(byLevel.page.missing.map((c) => c.id)).toEqual([
			'Photos.SnapshotsFolder',
			'Prediction.PredictConjugations'
		]);
	});

	/**
	 * 🛑 **הטסט הזה שינה את טענתו בסלייס 13, וזו אינה הרפיה.**
	 *
	 * קודם הוא דרש `extra === []` — "אין handler לפקודה שאינה בשימוש".
	 * הדרישה הייתה נכונה כל עוד הרג׳יסטרי כיסה רק פקודות מלוחות-הדגימה,
	 * ו**אינה נכונה כהנחה**: ‏`Settings.RestEyeGaze` · `RestPointer` ·
	 * ‏`RestSwitch` אינם מופיעים באף אחד מארבעת הלוחות — אבל בקורפוס כולו
	 * הם ‏**‏3,099 · ‏3,092 · ‏2,762 = ‏8,953 הפעלות.** מימושם הוא כיסוי
	 * ללוחות שטרם נטענו, לא קוד מת.
	 *
	 * הכלל שנשאר: ‏**‏`extra` מותר רק לפקודה שקיימת בקטלוג** — ולא מזהה
	 * שהומצא. זה מה שנבדק כאן.
	 */
	it('כל handler הוא פקודת-קטלוג; extra מותר ומתועד', () => {
		const report = computeCoverage();
		expect(report.extra).toEqual([
			'Settings.RestEyeGaze',
			'Settings.RestPointer',
			'Settings.RestSwitch',
			'Prediction.PredictThis'
		]);
		expect(report.implementedCount + report.extra.length).toBe(Object.keys(commandRegistry).length);
	});

	it('החסרות ממוינות מהנפוצה לנדירה', () => {
		const report = computeCoverage();
		expect(report.missing[0].id).toBe('Settings.SetScreenBrightness');
		expect(report.missing).toHaveLength(48);
	});

	it('🔑 חמש הפקודות של סלייס 11 יצאו מרשימת החסרות', () => {
		const report = computeCoverage();
		const missing = new Set(report.missing.map((c) => c.id));
		for (const id of [
			'Action.Punctuation',
			'Action.Number',
			'Action.Space',
			'Action.DeleteLetter',
			'CommandExecution.Wait'
		]) {
			expect(missing.has(id)).toBe(false);
		}
	});

	it('מונה הריצה נכנס לדוח', () => {
		const report = computeCoverage({ 'Calculator.Add': 3, 'Photos.Next': 7 });
		expect(report.unimplementedSeen).toEqual([
			{ id: 'Photos.Next', uses: 7 },
			{ id: 'Calculator.Add', uses: 3 }
		]);
	});
});

describe('formatCoverageReport', () => {
	it('מדפיס 15/66 ואת אחוז ההפעלות', () => {
		const text = coverageSummary();
		expect(text).toContain('18/66');
		expect(text).toContain('97.4%');
	});

	it('מדפיס שורת-רמות שבה רואים את ה-0/4 של רמת-הדף', () => {
		const text = coverageSummary();
		expect(text).toContain('תא 3947/4052');
		expect(text).toContain('AutoContent 166/166');
		expect(text).toContain('דף 0/4');
	});

	it('מונה את הפקודות החסרות הנפוצות', () => {
		expect(coverageSummary()).toContain('Settings.SetScreenBrightness (12)');
	});
});
