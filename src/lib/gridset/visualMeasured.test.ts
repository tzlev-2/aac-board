import { describe, expect, it } from 'vitest';
import {
	GUTTER_K_DEFAULT,
	gutterRatioForCellSpacing,
	resolveBackgroundCorner,
	verticalFillGradient,
	gridColourToRgb
} from './visualMeasured';

describe('מודל מרזבים', () => {
	it('k ברירת-מחדל ו-ExtraLarge — נמדד', () => {
		expect(gutterRatioForCellSpacing(undefined)).toBe(GUTTER_K_DEFAULT);
		expect(gutterRatioForCellSpacing(null)).toBe(GUTTER_K_DEFAULT);
		expect(gutterRatioForCellSpacing('ExtraLarge')).toBe(0.214);
	});

	it('אימות צילום 01: g/boardH = k/(rows + k·(rows+1))', () => {
		const ratio = GUTTER_K_DEFAULT / (4 + GUTTER_K_DEFAULT * 5);
		// 1050px לוח ⇒ g ≈ 36.5
		expect(ratio * 1050).toBeCloseTo(36.5, 0);
	});
});

describe('גרדיאנט HSL', () => {
	it('#ED9C9E — אמצע ב-50%, לא דלתא RGB קבועה', () => {
		const g = verticalFillGradient('#ED9C9EFF');
		expect(g).toContain('linear-gradient');
		expect(g).toContain('50%');
		const { r, g: gr, b } = gridColourToRgb('#ED9C9EFF');
		expect(g).toContain(`rgb(${r}, ${gr}, ${b})`);
	});

	it('#E7EAF1 — אותו ΔL, דלתא RGB שונה', () => {
		const grad = verticalFillGradient('#E7EAF1FF');
		expect(grad).toMatch(/linear-gradient\(to bottom/);
	});
});

describe('BackgroundShape + Theme', () => {
	it('shape 1 Kids ⇒ squircle 64', () => {
		const c = resolveBackgroundCorner({ shape: 1, theme: 'Kids' });
		expect(c.kind).toBe('squircle');
		if (c.kind === 'squircle') expect(c.radiusPx).toBe(64);
	});

	it('shape 1 ערכה רגילה ⇒ מלבן r≈16', () => {
		const c = resolveBackgroundCorner({ shape: 1, theme: undefined });
		expect(c.kind).toBe('rect');
		if (c.kind === 'rect') expect(c.radiusPx).toBe(16);
	});

	it('shape 3 לא פוענח ⇒ fallback', () => {
		const c = resolveBackgroundCorner({ shape: 3, theme: 'Kids' });
		expect(c.kind).toBe('rect');
	});
});
