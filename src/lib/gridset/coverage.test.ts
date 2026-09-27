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
	it('עשר פקודות מתוך 66', () => {
		const report = computeCoverage();
		expect(report.implementedCount).toBe(10);
		expect(report.usedCount).toBe(66);
	});

	it('עשר הפקודות מכסות 91.8% מההפעלות', () => {
		const report = computeCoverage();
		expect(report.coveredActivations).toBe(3875);
		expect(report.activationPct).toBe(91.8);
	});

	it('🔑 הפילוח לפי רמה — autoContent מלא, page ריק', () => {
		const { byLevel } = computeCoverage();
		expect(byLevel.cell.coveredActivations).toBe(3709);
		expect(byLevel.cell.activationPct).toBe(91.5);
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

	it('כל handler ברג׳יסטרי הוא פקודה שבשימוש בפועל', () => {
		const report = computeCoverage();
		expect(report.extra).toEqual([]);
		expect(report.implementedCount).toBe(Object.keys(commandRegistry).length);
	});

	it('החסרות ממוינות מהנפוצה לנדירה', () => {
		const report = computeCoverage();
		expect(report.missing[0].id).toBe('Settings.RestAll');
		expect(report.missing).toHaveLength(56);
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
	it('מדפיס 10/66 ואת אחוז ההפעלות', () => {
		const text = coverageSummary();
		expect(text).toContain('10/66');
		expect(text).toContain('91.8%');
	});

	it('מדפיס שורת-רמות שבה רואים את ה-0/4 של רמת-הדף', () => {
		const text = coverageSummary();
		expect(text).toContain('תא 3709/4052');
		expect(text).toContain('AutoContent 166/166');
		expect(text).toContain('דף 0/4');
	});

	it('מונה את הפקודות החסרות הנפוצות', () => {
		expect(coverageSummary()).toContain('Settings.RestAll (64)');
	});
});
