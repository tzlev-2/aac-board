import { afterEach, describe, expect, it, vi } from 'vitest';
import { captionFitReceipt, observeCaptionFit } from './caption-fit';

/** Layout fixture: preferred text overflows a short fixed box, reduced text fits. */
function layout() {
	let height = 30,
		origin = 0,
		failRange = false,
		reads = 0;
	const rect = () => ({
		left: 0,
		top: origin,
		right: 100,
		bottom: origin + height,
		width: 100,
		height
	});
	const parent = { clientHeight: 30, getBoundingClientRect: rect };
	const fontStyle = { fontSize: '32px' };
	const span = {
		style: fontStyle,
		textContent: 'full caption',
		isConnected: true,
		closest: () => parent,
		parentElement: null,
		clientWidth: 100,
		scrollWidth: 100,
		get clientHeight() {
			return parseFloat(fontStyle.fontSize);
		},
		get scrollHeight() {
			return parseFloat(fontStyle.fontSize);
		},
		getBoundingClientRect() {
			const size = parseFloat(fontStyle.fontSize);
			return {
				...rect(),
				top: origin + (height - size) / 2,
				bottom: origin + (height + size) / 2,
				height: size
			};
		}
	} as unknown as HTMLElement;
	const callbacks: (() => void)[] = [],
		observers: { disconnect: ReturnType<typeof vi.fn> }[] = [];
	vi.stubGlobal(
		'ResizeObserver',
		class {
			disconnect = vi.fn();
			observe = vi.fn();
			constructor(callback: () => void) {
				callbacks.push(callback);
				observers.push(this);
			}
		}
	);
	const fonts = new EventTarget(),
		viewport = new EventTarget(),
		win = new EventTarget();
	const ready = Promise.withResolvers<void>();
	Object.assign(fonts, { ready: ready.promise });
	Object.assign(win, { visualViewport: viewport });
	vi.stubGlobal('window', win);
	vi.stubGlobal('getComputedStyle', (el: HTMLElement) => ({
		borderLeftWidth: '0',
		borderRightWidth: '0',
		borderTopWidth: '0',
		borderBottomWidth: '0',
		paddingLeft: '0',
		paddingRight: '0',
		paddingTop: '0',
		paddingBottom: '0',
		fontSize: el.style?.fontSize ?? '32px',
		fontFamily: 'Arial',
		fontWeight: '400',
		fontStyle: 'normal',
		letterSpacing: 'normal',
		wordSpacing: 'normal',
		direction: 'rtl',
		writingMode: 'horizontal-tb',
		transform: 'none',
		clipPath: 'none',
		zoom: '1'
	}));
	vi.stubGlobal('document', {
		fonts,
		createRange: () => ({
			selectNodeContents() {},
			getClientRects() {
				reads++;
				if (failRange && span.style.fontSize === '20px')
					throw Error('Range failed after trial write');
				return [span.getBoundingClientRect()];
			}
		})
	});
	const raf = vi.fn();
	vi.stubGlobal('requestAnimationFrame', raf);
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
	const paints: { font: string; y: number; outcome: string | undefined }[] = [];
	const paint = () =>
		paints.push({
			font: span.style.fontSize,
			y: span.getBoundingClientRect().top,
			outcome: captionFitReceipt(span)?.outcome
		});
	return {
		span,
		paint,
		paints,
		callbacks,
		observers,
		fonts,
		viewport,
		win,
		ready,
		raf,
		resize(h: number, y = origin) {
			height = h;
			origin = y;
		},
		fail() {
			failRange = true;
		},
		get reads() {
			return reads;
		}
	};
}

afterEach(() => vi.unstubAllGlobals());
describe('caption fit transaction lifecycle', () => {
	it('commits paint from final fitted/restored geometry before each fixed-box notification returns', () => {
		const f = layout(),
			stop = observeCaptionFit(f.span, '32px', f.paint);
		expect(f.paints.at(-1)).toEqual({ font: '29px', y: 0.5, outcome: 'FITTED' });
		f.resize(60, 10);
		f.callbacks[0]();
		expect(f.paints.at(-1)).toEqual({ font: '32px', y: 24, outcome: 'PREFERRED' });
		f.resize(26, 5);
		f.callbacks[0]();
		expect(f.paints.at(-1)).toEqual({ font: '25px', y: 5.5, outcome: 'FITTED' });
		expect(f.raf).not.toHaveBeenCalled();
		stop();
	});
	it('repaints a changed origin with the same fit key without resetting the fitted font', () => {
		const f = layout(),
			stop = observeCaptionFit(f.span, '32px', f.paint),
			reads = f.reads;
		f.resize(30, 100);
		f.callbacks[0]();
		expect(f.reads).toBe(reads);
		expect(f.paints.at(-1)).toEqual({ font: '29px', y: 100.5, outcome: 'FITTED' });
		stop();
	});
	it('paints restored preferred geometry and retains the failed-fit diagnostic', () => {
		const f = layout();
		f.fail();
		const stop = observeCaptionFit(f.span, '32px', f.paint);
		expect(f.paints.at(-1)).toEqual({ font: '32px', y: -1, outcome: 'MEASUREMENT_FAILED' });
		expect(captionFitReceipt(f.span)).toMatchObject({
			error: 'Error: Range failed after trial write'
		});
		stop();
	});
	it('invalidates for font completion/error and disposes observers, events and late ready work', async () => {
		const f = layout(),
			stop = observeCaptionFit(f.span, '32px', f.paint),
			reads = f.reads;
		f.fonts.dispatchEvent(new Event('loadingdone'));
		expect(f.reads).toBeGreaterThan(reads);
		const doneReads = f.reads;
		f.fonts.dispatchEvent(new Event('loadingerror'));
		expect(f.reads).toBeGreaterThan(doneReads);
		stop();
		const count = f.paints.length;
		f.ready.resolve();
		await f.ready.promise;
		await Promise.resolve();
		f.callbacks[0]();
		f.fonts.dispatchEvent(new Event('loadingdone'));
		f.win.dispatchEvent(new Event('resize'));
		f.viewport.dispatchEvent(new Event('resize'));
		expect(f.paints).toHaveLength(count);
		expect(f.observers[0].disconnect).toHaveBeenCalledOnce();
		expect(f.span.style.fontSize).toBe('32px');
		expect(captionFitReceipt(f.span)).toBeUndefined();
	});
	it('does no work on a disconnected span', () => {
		const f = layout(),
			stop = observeCaptionFit(f.span, '32px', f.paint),
			reads = f.reads;
		Object.defineProperty(f.span, 'isConnected', { value: false });
		f.callbacks[0]();
		expect(f.reads).toBe(reads);
		expect(f.paints).toHaveLength(1);
		stop();
	});
});
