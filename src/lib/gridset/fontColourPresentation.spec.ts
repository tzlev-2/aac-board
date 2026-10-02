import { describe, it, expect, vi } from 'vitest';
import {
	fontCoreTarget,
	fontPresentation,
	fontPresentationGradient,
	scheduleFontCaption,
	cancelFontCaption
} from './fontColourPresentation';
// וקטורים מה-predictor gamma1.7 הקפוא, ולא expected המחושב מתוך המימוש.
const golden = [
	{ f: [255, 187, 34], a: 128, b: [255, 255, 255], expected: [253, 214, 172] },
	{ f: [255, 187, 34], a: 128, b: [251, 251, 251], expected: [252, 212, 169] },
	{ f: [255, 187, 34], a: 128, b: [252, 252, 252], expected: [252, 213, 170] },
	{ f: [255, 187, 34], a: 128, b: [0, 51, 0], expected: [170, 129, 12] },
	{ f: [255, 187, 34], a: 64, b: [255, 255, 255], expected: [253, 231, 213] },
	{ f: [255, 187, 34], a: 64, b: [251, 251, 251], expected: [251, 228, 209] },
	{ f: [255, 187, 34], a: 64, b: [252, 252, 252], expected: [251, 229, 210] },
	{ f: [255, 187, 34], a: 64, b: [0, 51, 0], expected: [101, 95, 6] },
	{ f: [255, 187, 34], a: 192, b: [255, 255, 255], expected: [253, 200, 116] },
	{ f: [255, 187, 34], a: 192, b: [251, 251, 251], expected: [253, 199, 115] },
	{ f: [255, 187, 34], a: 192, b: [252, 252, 252], expected: [253, 200, 115] },
	{ f: [255, 187, 34], a: 192, b: [0, 51, 0], expected: [215, 155, 20] },
	{ f: [0, 0, 255], a: 128, b: [255, 255, 255], expected: [171, 171, 253] },
	{ f: [0, 0, 255], a: 128, b: [251, 251, 251], expected: [168, 168, 252] },
	{ f: [0, 0, 255], a: 128, b: [252, 252, 252], expected: [169, 169, 252] },
	{ f: [0, 0, 255], a: 128, b: [0, 51, 0], expected: [0, 34, 170] },
	{ f: [0, 0, 0], a: 128, b: [255, 255, 255], expected: [171, 171, 171] },
	{ f: [0, 0, 0], a: 128, b: [251, 251, 251], expected: [168, 168, 168] },
	{ f: [0, 0, 0], a: 128, b: [252, 252, 252], expected: [169, 169, 169] },
	{ f: [0, 0, 0], a: 128, b: [0, 51, 0], expected: [0, 34, 0] },
	{ f: [255, 187, 34], a: 128, b: [255, 255, 255], expected: [253, 214, 172] },
	{ f: [255, 187, 34], a: 128, b: [251, 251, 251], expected: [252, 212, 169] },
	{ f: [255, 187, 34], a: 128, b: [252, 252, 252], expected: [252, 213, 170] },
	{ f: [255, 187, 34], a: 128, b: [0, 51, 0], expected: [170, 129, 12] },
	{ f: [255, 187, 34], a: 128, b: [255, 255, 255], expected: [253, 214, 172] },
	{ f: [255, 187, 34], a: 128, b: [251, 251, 251], expected: [252, 212, 169] },
	{ f: [255, 187, 34], a: 128, b: [252, 252, 252], expected: [252, 213, 170] },
	{ f: [255, 187, 34], a: 128, b: [0, 51, 0], expected: [170, 129, 12] }
];
describe('font presentation', () => {
	it('matches frozen golden vectors', () => {
		for (const v of golden)
			expect(
				fontCoreTarget(v.f as [number, number, number], v.a, v.b as [number, number, number])
			).toEqual(v.expected);
	});
	it('keeps source FF and transparent 00', () => {
		expect(fontCoreTarget([1, 2, 3], 0, [4, 5, 6])).toEqual([4, 5, 6]);
		expect(fontCoreTarget([1, 2, 3], 255, [4, 5, 6])).toEqual([1, 2, 3]);
		for (const aa of ['00', 'FF'])
			expect(fontPresentation('#FFBB22' + aa, '#FFFFFFFF', true, false).eligible).toBe(false);
	});
	it('requires known opaque background and caption-only content', () => {
		for (const [f, b, only, disabled] of [
			['bad', '#FFFFFFFF', true, false],
			['#FFBB2280', '#FFFFFF80', true, false],
			['#FFBB2280', '#FFFFFFFF', false, false],
			['#FFBB2280', '#FFFFFFFF', true, true]
		] as const)
			expect(fontPresentation(f, b, only, disabled).eligible).toBe(false);
		expect(fontPresentation('#FFBB2280', '#FFFFFFFF', true, false).eligible).toBe(true);
	});
	it('bounds gradient size and rejects invalid geometry', () => {
		const m = fontPresentation('#FFBB2280', '#003300FF', true, false);
		expect(m.eligible).toBe(true);
		if (!m.eligible) return;
		expect(fontPresentationGradient(m, 260)).toContain('in srgb');
		expect(fontPresentationGradient(m, 0)).toBe('');
		expect(fontPresentationGradient(m, 5000)).toBe('');
	});
});

it('coalesces caption measurements before writes and cancels an unmounted caption', () => {
	let callback: FrameRequestCallback | undefined;
	const raf = vi.fn((fn: FrameRequestCallback) => {
		callback = fn;
		return 1;
	});
	const cancel = vi.fn();
	vi.stubGlobal('requestAnimationFrame', raf);
	vi.stubGlobal('cancelAnimationFrame', cancel);
	const events: string[] = [];
	const a = () => {
		events.push('read-a');
		return () => {
			events.push('write-a');
		};
	};
	const b = () => {
		events.push('read-b');
		return () => {
			events.push('write-b');
		};
	};
	try {
		scheduleFontCaption(a);
		scheduleFontCaption(a);
		scheduleFontCaption(b);
		expect(raf).toHaveBeenCalledTimes(1);
		callback!(0);
		expect(events).toEqual(['read-a', 'read-b', 'write-a', 'write-b']);
		scheduleFontCaption(a);
		cancelFontCaption(a);
		expect(cancel).toHaveBeenCalledWith(1);
	} finally {
		cancelFontCaption(a);
		cancelFontCaption(b);
		vi.unstubAllGlobals();
	}
});
