/** מודל ניסיוני gamma1.7 לליבת הכיתוב בלבד; אינו הוכחת parity של Grid. */
import { verticalFillGradient } from './visualMeasured';

type RGB = readonly [number, number, number];
export type FontPresentation =
	| { eligible: false; reason: string }
	| { eligible: true; foreground: RGB; alpha: number; stops: readonly RGB[] };

function colour(value: string): { rgb: RGB; alpha: number } | null {
	if (!/^#[\da-f]{8}$/i.test(value)) return null;
	return {
		rgb: [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16)) as unknown as RGB,
		alpha: parseInt(value.slice(7), 16)
	};
}

/** תעתיק integer של predictor הקפוא, עם fast paths למקור. */
export function fontCoreTarget(f: RGB, alpha: number, b: RGB): RGB {
	if (alpha === 0) return b;
	if (alpha === 255) return f;
	const a = ((255 * alpha) >> 8) / 255;
	const f1 = Math.round(
		255 * (a + a * (1 - a) * ((256 / 255) * -0.7649 * a + (256 / 255) * -0.308))
	);
	const f2 = Math.round(255 * a * (1 - a) * (65536 / (255 * 255)) * (0.13 * a + 1.3159));
	return f.map((fc, i) => {
		const ac = f1 + ((f2 * fc) >> 8);
		return ((b[i] * (255 - ac)) >> 8) + ((fc * ac) >> 8);
	}) as unknown as RGB;
}

export function fontPresentation(
	font: string,
	back: string,
	captionOnly: boolean,
	disabled: boolean
): FontPresentation {
	const f = colour(font),
		b = colour(back);
	if (!captionOnly || disabled) return { eligible: false, reason: 'content' };
	if (!f || !b) return { eligible: false, reason: 'colour' };
	if (f.alpha === 0 || f.alpha === 255) return { eligible: false, reason: 'source-fast-path' };
	if (b.alpha !== 255) return { eligible: false, reason: 'backdrop' };
	const stops = [...verticalFillGradient(back).matchAll(/rgb\((\d+), (\d+), (\d+)\)/g)].map(
		(m) => m.slice(1).map(Number) as unknown as RGB
	);
	if (stops.length !== 3) return { eligible: false, reason: 'gradient' };
	return { eligible: true, foreground: f.rgb, alpha: f.alpha, stops };
}

/** ספים אנליטיים של round(background RGB), עם שתי נקודות לכל מדרגה.
 * ה-target integer קבוע בין הספים; אין screenshot runtime או דגימה לפי גובה.
 * סף quantization מדויק אינו מבטיח parity של dithering/קצוות בדפדפן.
 */
export function fontPresentationGradient(
	model: Extract<FontPresentation, { eligible: true }>,
	height: number
): string {
	if (!Number.isFinite(height) || height <= 0 || height > 4096) return '';
	const boundaries = new Set([0, 0.5, 1]);
	for (let segment = 0; segment < 2; segment++) {
		for (let channel = 0; channel < 3; channel++) {
			const a = model.stops[segment][channel],
				b = model.stops[segment + 1][channel];
			for (let byte = Math.min(a, b); byte < Math.max(a, b); byte++) {
				boundaries.add((segment + (byte + 0.5 - a) / (b - a)) / 2);
			}
		}
	}
	const positions = [...boundaries].sort((a, b) => a - b),
		stops: string[] = [];
	for (let i = 0; i < positions.length - 1; i++) {
		const t = (positions[i] + positions[i + 1]) / 2,
			lower = t < 0.5 ? 0 : 1,
			u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
		const b = model.stops[lower].map((v, j) =>
			Math.round(v + (model.stops[lower + 1][j] - v) * u)
		) as unknown as RGB;
		const rgb = fontCoreTarget(model.foreground, model.alpha, b).join(',');
		stops.push(`rgb(${rgb}) ${positions[i] * 100}%`, `rgb(${rgb}) ${positions[i + 1] * 100}%`);
	}
	return `linear-gradient(to bottom in srgb,${stops.join(',')})`;
}

/** RAF משותף: כל המדידות נקראות לפני כתיבת style הראשונה, בלי לולאת ציור. */
type CaptionMeasure = () => (() => void) | undefined;
const pendingCaptions = new Set<CaptionMeasure>();
let captionFrame = 0;
export function scheduleFontCaption(measure: CaptionMeasure): void {
	pendingCaptions.add(measure);
	if (captionFrame) return;
	captionFrame = requestAnimationFrame(() => {
		captionFrame = 0;
		const measures = [...pendingCaptions];
		pendingCaptions.clear();
		const writes = measures.map((read) => read());
		for (const write of writes) write?.();
	});
}
export function cancelFontCaption(measure: CaptionMeasure): void {
	pendingCaptions.delete(measure);
	if (!pendingCaptions.size && captionFrame) {
		cancelAnimationFrame(captionFrame);
		captionFrame = 0;
	}
}
