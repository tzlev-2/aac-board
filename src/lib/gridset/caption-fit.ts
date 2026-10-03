/** Caption presentation only. Every accepted size is tested by browser layout. */
export const CAPTION_FLOOR = 20;
export type FitOutcome =
	| 'PREFERRED'
	| 'FITTED'
	| 'UNFIT_AT_FLOOR'
	| 'PREFERRED_BELOW_FLOOR'
	| 'INVALID_PREFERRED_SIZE'
	| 'UNSUPPORTED_CLIP'
	| 'GEOMETRY_CHANGED'
	| 'FINAL_FIT_FAILED';

export function searchCaptionFont(
	preferred: number,
	fits: (size: number, reduced: boolean) => boolean
): { outcome: FitOutcome; size: number } {
	if (fits(preferred, false)) return { outcome: 'PREFERRED', size: preferred };
	if (!Number.isFinite(preferred) || preferred > 96)
		return { outcome: 'INVALID_PREFERRED_SIZE', size: preferred };
	if (preferred < CAPTION_FLOOR) return { outcome: 'PREFERRED_BELOW_FLOOR', size: preferred };
	if (!fits(CAPTION_FLOOR, true)) return { outcome: 'UNFIT_AT_FLOOR', size: preferred };
	let failed = preferred;
	for (
		let coarse = Math.max(CAPTION_FLOOR, preferred - 2);
		;
		coarse = Math.max(CAPTION_FLOOR, coarse - 2)
	) {
		if (coarse === CAPTION_FLOOR || fits(coarse, true)) {
			for (let size = failed - 0.25; size > coarse; size -= 0.25) {
				if (fits(size, true)) return { outcome: 'FITTED', size };
			}
			return { outcome: 'FITTED', size: coarse };
		}
		failed = coarse;
	}
}

type Box = {
	left: number;
	top: number;
	right: number;
	bottom: number;
	width: number;
	height: number;
};
type Paint = { font: number; block: Box; fragments: Box[]; extents: number[]; fits: boolean };
export interface CaptionFitReceipt {
	outcome: FitOutcome;
	text: string;
	preferred: number;
	effective: number;
	clip: Box;
	before: Paint;
	after: Paint;
	reads: number;
	duration: number;
}
const receipts = new WeakMap<HTMLElement, CaptionFitReceipt>();
type MeasurementFailure = { outcome: 'MEASUREMENT_FAILED'; text: string; error: string };
const failures = new WeakMap<HTMLElement, MeasurementFailure>();
export const captionFitReceipt = (span: HTMLElement) => receipts.get(span) ?? failures.get(span);
const box = (r: DOMRect): Box => ({
	left: r.left,
	top: r.top,
	right: r.right,
	bottom: r.bottom,
	width: r.width,
	height: r.height
});
function contentBox(el: HTMLElement): Box {
	const r = el.getBoundingClientRect(),
		s = getComputedStyle(el);
	const left = r.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft);
	const top = r.top + parseFloat(s.borderTopWidth) + parseFloat(s.paddingTop);
	const right = r.right - parseFloat(s.borderRightWidth) - parseFloat(s.paddingRight);
	const bottom = r.bottom - parseFloat(s.borderBottomWidth) - parseFloat(s.paddingBottom);
	return { left, top, right, bottom, width: right - left, height: bottom - top };
}
function contains(outer: Box, inner: Box, clearance = 0) {
	return (
		inner.left >= outer.left - 0.5 &&
		inner.right <= outer.right + 0.5 &&
		inner.top >= outer.top + clearance - 0.5 &&
		inner.bottom <= outer.bottom - clearance + 0.5
	);
}

/** One synchronous transaction; no intermediate font survives a frame. */
function measureCaptionFit(span: HTMLElement, preferredCss: string): CaptionFitReceipt | undefined {
	const parent = span.closest<HTMLElement>('.button-cell');
	const cell = span.closest<HTMLElement>('[data-testid=grid-cell]');
	if (!parent || !cell || !span.isConnected || parent.clientHeight === 0) return;
	const start = performance.now(),
		parentBefore = box(parent.getBoundingClientRect());
	const a = contentBox(parent),
		b = contentBox(cell);
	const clip = {
		left: Math.max(a.left, b.left),
		top: Math.max(a.top, b.top),
		right: Math.min(a.right, b.right),
		bottom: Math.min(a.bottom, b.bottom),
		width: 0,
		height: 0
	};
	clip.width = clip.right - clip.left;
	clip.height = clip.bottom - clip.top;
	span.style.fontSize = preferredCss;
	const preferred = parseFloat(getComputedStyle(span).fontSize);
	const range = document.createRange();
	range.selectNodeContents(span);
	let reads = 0;
	const measure = (reduced: boolean): Paint => {
		reads++;
		const block = box(span.getBoundingClientRect());
		const fragments = [...range.getClientRects()]
			.filter((r) => r.width > 0 && r.height > 0)
			.map(box);
		const extents = [span.scrollWidth - span.clientWidth, span.scrollHeight - span.clientHeight];
		return {
			font: parseFloat(getComputedStyle(span).fontSize),
			block,
			fragments,
			extents,
			fits:
				fragments.length > 0 &&
				contains(clip, block, reduced ? 1 : 0) &&
				fragments.every((r) => contains(clip, r) && contains(block, r)) &&
				extents.every((v) => v <= 1)
		};
	};
	const before = measure(false);
	let supported = true;
	// Scrolling outside a cell does not change its intrinsic text clip. Shapes/ink
	// still need visual QA; transformed or nonrectangular clip paths are explicit failures.
	for (let el: HTMLElement | null = span; el; el = el.parentElement) {
		const s = getComputedStyle(el);
		if (
			s.transform !== 'none' ||
			s.writingMode !== 'horizontal-tb' ||
			s.clipPath !== 'none' ||
			(s.zoom !== '1' && s.zoom !== 'normal')
		)
			supported = false;
	}
	let result: { outcome: FitOutcome; size: number };
	if (!supported) result = { outcome: 'UNSUPPORTED_CLIP', size: preferred };
	else
		result = searchCaptionFont(preferred, (size, reduced) => {
			if (!reduced) return before.fits;
			span.style.fontSize = `${size}px`;
			return measure(true).fits;
		});
	span.style.fontSize = result.outcome === 'FITTED' ? `${result.size}px` : preferredCss;
	let after = measure(result.outcome === 'FITTED');
	const parentAfter = box(parent.getBoundingClientRect());
	if (
		Object.keys(parentBefore).some(
			(k) => Math.abs(parentBefore[k as keyof Box] - parentAfter[k as keyof Box]) > 0.5
		)
	) {
		result = { outcome: 'GEOMETRY_CHANGED', size: preferred };
	} else if (result.outcome === 'FITTED' && !after.fits) {
		result = { outcome: 'FINAL_FIT_FAILED', size: preferred };
	}
	if (result.size === preferred && span.style.fontSize !== preferredCss) {
		span.style.fontSize = preferredCss;
		after = measure(false);
	}
	const receipt = {
		outcome: result.outcome,
		text: span.textContent ?? '',
		preferred,
		effective: after.font,
		clip,
		before,
		after,
		reads,
		duration: performance.now() - start
	};
	receipts.set(span, receipt);
	return receipt;
}

export function fitCaption(span: HTMLElement, preferredCss: string) {
	try {
		failures.delete(span);
		return measureCaptionFit(span, preferredCss);
	} catch (error) {
		// A failed layout/Range read must never leave an intermediate font installed.
		span.style.fontSize = preferredCss;
		const failure: MeasurementFailure = {
			outcome: 'MEASUREMENT_FAILED',
			text: span.textContent ?? '',
			error: String(error)
		};
		receipts.delete(span);
		failures.set(span, failure);
		return failure;
	}
}

/** Observe fixed boxes, never the span resized by our own font write. */
export function observeCaptionFit(span: HTMLElement, preferredCss: string): () => void {
	const parent = span.closest<HTMLElement>('.button-cell');
	const cell = span.closest<HTMLElement>('[data-testid=grid-cell]');
	if (!parent || !cell) return () => {};
	let disposed = false,
		frame = 0,
		generation = 0,
		previousKey = '';
	const schedule = () => {
		if (disposed || frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			if (disposed || !span.isConnected) return;
			const cs = getComputedStyle(span),
				p = contentBox(parent),
				c = contentBox(cell);
			const key = JSON.stringify([
				span.textContent,
				preferredCss,
				cs.fontFamily,
				cs.fontWeight,
				cs.fontStyle,
				cs.letterSpacing,
				cs.wordSpacing,
				cs.direction,
				cs.writingMode,
				p.width,
				p.height,
				c.width,
				c.height,
				generation
			]);
			if (key === previousKey) return;
			previousKey = key;
			fitCaption(span, preferredCss);
		});
	};
	const fontsChanged = () => {
		generation++;
		schedule();
	};
	const observer = new ResizeObserver(schedule);
	observer.observe(parent);
	observer.observe(cell);
	window.addEventListener('resize', schedule);
	window.visualViewport?.addEventListener('resize', schedule);
	document.fonts.addEventListener('loadingdone', fontsChanged);
	document.fonts.addEventListener('loadingerror', fontsChanged);
	void document.fonts.ready.then(() => {
		if (!disposed) fontsChanged();
	});
	schedule();
	return () => {
		disposed = true;
		observer.disconnect();
		if (frame) cancelAnimationFrame(frame);
		window.removeEventListener('resize', schedule);
		window.visualViewport?.removeEventListener('resize', schedule);
		document.fonts.removeEventListener('loadingdone', fontsChanged);
		document.fonts.removeEventListener('loadingerror', fontsChanged);
		span.style.fontSize = preferredCss;
		receipts.delete(span);
		failures.delete(span);
	};
}
