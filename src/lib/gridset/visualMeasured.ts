/**
 * ערכים ונוסחאות מ-`grid-reference/derived/visual-measured.md` (27.9.2026).
 * כל מספר כאן נמדד — מה שלא כאן נשאר ב-`visualDefaults` עם `// לא-מאומת מול Grid`.
 */

import type { SizeName } from './types';

/** יחס מרזב ÷ גובה-תא — נמדד: 0.168 (ברירת-מחדל) · 0.214 (ExtraLarge). */
export const GUTTER_K_DEFAULT = 0.168;
export const GUTTER_K_EXTRA_LARGE = 0.214;

/** 🛑 Small · ExtraSmall · Large — לא נמדדו; לא להמציא. */
export function gutterRatioForCellSpacing(cellSpacing: SizeName | null | undefined): number {
	if (cellSpacing === 'ExtraLarge') return GUTTER_K_EXTRA_LARGE;
	return GUTTER_K_DEFAULT;
}

/**
 * מרזב כאחוז מגובה מכולת-הרשת (padding + gap זהים).
 * `rows·cellH + (rows+1)·g = boardH`, `g = k·cellH` ⇒ `g/boardH = k/(rows + k·(rows+1))`.
 */
export function gutterCssPercent(rows: number, k: number): string {
	const denom = rows + k * (rows + 1);
	const pct = (k / denom) * 100;
	return `${pct.toFixed(4)}%`;
}

/** אזור-סמל — צילום 01, גוף 277×217. */
export const ICON_TOP_RATIO = 19 / 217;
export const ICON_BOX_HEIGHT_RATIO = 148 / 217;
export const ICON_BOX_WIDTH_RATIO = 148 / 277;
/** דיו בשורות 177–190 ⇒ 26px מתחתית-הגוף. */
export const CAPTION_BOTTOM_MARGIN_RATIO = 26 / 217;
/** שטח לדיו מתחת לסמל — נמדד §4: ‏217−19−148−26 px / גוף 217. */
export const CAPTION_RIBBON_HEIGHT_RATIO =
	1 - ICON_TOP_RATIO - ICON_BOX_HEIGHT_RATIO - CAPTION_BOTTOM_MARGIN_RATIO;

export const CELL_SHADOW = '-5px 5px 0 rgba(0, 0, 0, 0.08)';

/** ΔL ב-HSL — ±0.0275 סביב `BackColour` באמצע-הגובה. */
export const GRADIENT_L_DELTA = 0.0275;

export type BackgroundShapeKey = {
	shape: number | null | undefined;
	theme: string | null | undefined;
};

export type ResolvedCorner =
	| { kind: 'rect'; radiusPx: number; note?: string }
	| { kind: 'squircle'; radiusPx: number; note?: string }
	| { kind: 'ellipse' }
	| { kind: 'cut-top-left'; radiusPx: number; cutLegPx: number; note?: string };

/**
 * 🛑 המפתח הוא (shape, theme), לא shape בלבד — visual-measured.md §2.
 * ערכים 3,4,6,7,8,9,10 — לא פוענחו; fallback מלבן.
 */
export function resolveBackgroundCorner(key: BackgroundShapeKey): ResolvedCorner {
	const shape = key.shape ?? 0;
	const kids = (key.theme ?? '').toLowerCase() === 'kids';

	if (shape === 0 || shape === undefined) {
		return kids
			? { kind: 'rect', radiusPx: 15 }
			: { kind: 'rect', radiusPx: 5 };
	}
	if (shape === 1) {
		return kids
			? {
					kind: 'squircle',
					radiusPx: 64,
					note: 'border-radius קירוב — inset שטוח יותר ממעגל (~5px מקס)'
				}
			: { kind: 'rect', radiusPx: 16 };
	}
	if (shape === 2 && kids) {
		return {
			kind: 'cut-top-left',
			radiusPx: 15,
			cutLegPx: 60,
			note: 'פינה שמאלית-עליונה קטומה 45° — clip-path קירוב'
		};
	}
	if (shape === 5 && kids) {
		return { kind: 'ellipse' };
	}
	// לא פוענח — מלבן Kids (הנפוץ בדף-הבית)
	return kids ? { kind: 'rect', radiusPx: 15 } : { kind: 'rect', radiusPx: 5 };
}

export function cornerToCss(corner: ResolvedCorner): string {
	switch (corner.kind) {
		case 'rect':
		case 'squircle':
			return `${corner.radiusPx}px`;
		case 'ellipse':
			return '50% / 40%';
		case 'cut-top-left':
			return `${corner.radiusPx}px`;
		default:
			return '0';
	}
}

/** clip-path ל-shape 2 (Kids) — קירוב לפינה קטומה. */
export function cornerClipPath(corner: ResolvedCorner): string | undefined {
	if (corner.kind !== 'cut-top-left') return undefined;
	const leg = corner.cutLegPx;
	return `polygon(${leg}px 0, 100% 0, 100% 100%, 0 100%, 0 ${leg}px)`;
}

/** #RRGGBBAA → `#rrggbb` ל-CSS (אלפא נפרדת אם צריך). */
export function gridColourToRgb(hex: string): { r: number; g: number; b: number; a: number } {
	const raw = hex.replace(/^#/, '');
	if (raw.length === 6) {
		return {
			r: parseInt(raw.slice(0, 2), 16),
			g: parseInt(raw.slice(2, 4), 16),
			b: parseInt(raw.slice(4, 6), 16),
			a: 1
		};
	}
	if (raw.length === 8) {
		return {
			r: parseInt(raw.slice(0, 2), 16),
			g: parseInt(raw.slice(2, 4), 16),
			b: parseInt(raw.slice(4, 6), 16),
			a: parseInt(raw.slice(6, 8), 16) / 255
		};
	}
	return { r: 255, g: 255, b: 255, a: 1 };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
	const rn = r / 255;
	const gn = g / 255;
	const bn = b / 255;
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	if (max === min) return { h: 0, s: 0, l };
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h = 0;
	if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
	else if (max === gn) h = ((bn - rn) / d + 2) / 6;
	else h = ((rn - gn) / d + 4) / 6;
	return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
	if (s === 0) {
		const v = Math.round(l * 255);
		return { r: v, g: v, b: v };
	}
	const hue2rgb = (p: number, q: number, t: number) => {
		let tt = t;
		if (tt < 0) tt += 1;
		if (tt > 1) tt -= 1;
		if (tt < 1 / 6) return p + (q - p) * 6 * tt;
		if (tt < 1 / 2) return q;
		if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
		return p;
	};
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	return {
		r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
		g: Math.round(hue2rgb(p, q, h) * 255),
		b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
	};
}

function rgbCss(r: number, g: number, b: number, a = 1): string {
	return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})` : `rgb(${r}, ${g}, ${b})`;
}

/**
 * גרדיאנט אנכי סימטרי סביב צבע-ה-XML (אמצע-גובה).
 * 🛑 ΔL ב-HSL, לא דלתא RGB — visual-measured.md §3.
 */
export function verticalFillGradient(backColour: string): string {
	const { r, g, b, a } = gridColourToRgb(backColour);
	const { h, s, l } = rgbToHsl(r, g, b);
	const top = hslToRgb(h, s, Math.min(1, l + GRADIENT_L_DELTA));
	const bottom = hslToRgb(h, s, Math.max(0, l - GRADIENT_L_DELTA));
	const mid = rgbCss(r, g, b, a);
	return `linear-gradient(to bottom, ${rgbCss(top.r, top.g, top.b, a)}, ${mid} 50%, ${rgbCss(bottom.r, bottom.g, bottom.b, a)})`;
}
