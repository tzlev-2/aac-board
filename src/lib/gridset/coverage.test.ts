/** בדיקות דוח הכיסוי — המדד שמראה כמה מהלוחות האמיתיים כבר עובדים. */

import { describe, expect, it } from 'vitest';
import {
	CATALOG_SIZE,
	TOTAL_ACTIVATIONS,
	USED_COMMANDS,
	computeCoverage,
	coverageSummary
} from './coverage';
import { commandRegistry } from './commands';

describe('טבלת השימוש', () => {
	it('63 פקודות בשימוש מתוך קטלוג של 353', () => {
		expect(USED_COMMANDS).toHaveLength(63);
		expect(CATALOG_SIZE).toBe(353);
	});

	it('סך ההפעלות תואם ל-commands.tsv', () => {
		expect(TOTAL_ACTIVATIONS).toBe(4052);
	});

	it('אין כפילויות במזהים', () => {
		expect(new Set(USED_COMMANDS.map((c) => c.id)).size).toBe(USED_COMMANDS.length);
	});
});

describe('computeCoverage', () => {
	it('תשע פקודות מתוך 63', () => {
		const report = computeCoverage();
		expect(report.implementedCount).toBe(9);
		expect(report.usedCount).toBe(63);
	});

	it('תשע הפקודות מכסות 91.5% מההפעלות', () => {
		const report = computeCoverage();
		expect(report.coveredActivations).toBe(3709);
		expect(report.activationPct).toBe(91.5);
	});

	it('כל handler ברג׳יסטרי הוא פקודה שבשימוש בפועל', () => {
		const report = computeCoverage();
		expect(report.extra).toEqual([]);
		expect(report.implementedCount).toBe(Object.keys(commandRegistry).length);
	});

	it('החסרות ממוינות מהנפוצה לנדירה', () => {
		const report = computeCoverage();
		expect(report.missing[0].id).toBe('Settings.RestAll');
		expect(report.missing).toHaveLength(54);
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
	it('מדפיס 9/63 ואת אחוז ההפעלות', () => {
		const text = coverageSummary();
		expect(text).toContain('9/63');
		expect(text).toContain('91.5%');
	});

	it('מונה את הפקודות החסרות הנפוצות', () => {
		expect(coverageSummary()).toContain('Settings.RestAll (64)');
	});
});
