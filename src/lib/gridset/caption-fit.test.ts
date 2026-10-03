import { describe, expect, it, vi } from 'vitest';
import { fitCaption, searchCaptionFont } from './caption-fit';

describe('bounded caption font search', () => {
	it('preserves a fitting preferred font even below the floor', () => {
		const calls: number[] = [];
		expect(
			searchCaptionFont(12, (size) => {
				calls.push(size);
				return true;
			})
		).toEqual({ outcome: 'PREFERRED', size: 12 });
		expect(calls).toEqual([12]);
	});
	it('tests fractional preferred, floor, coarse and refined points and keeps the largest tested pass', () => {
		const calls: number[] = [];
		const result = searchCaptionFont(33.5, (size) => {
			calls.push(size);
			return size <= 25.8;
		});
		expect(result).toEqual({ outcome: 'FITTED', size: 25.75 });
		expect(calls).toContain(20);
		expect(calls).toContain(result.size);
		expect(calls.length).toBeLessThanOrEqual(50);
	});
	it('checks all quarter steps in the bracket without assuming monotonic wrapping', () => {
		expect(searchCaptionFont(28, (size) => size === 20 || size === 24 || size === 25.25)).toEqual({
			outcome: 'FITTED',
			size: 25.25
		});
	});
	it('does not silently shrink below20 or accept an unfit floor', () => {
		expect(searchCaptionFont(19, () => false).outcome).toBe('PREFERRED_BELOW_FLOOR');
		expect(searchCaptionFont(32, () => false)).toEqual({ outcome: 'UNFIT_AT_FLOOR', size: 32 });
		expect(searchCaptionFont(97, () => false).outcome).toBe('INVALID_PREFERRED_SIZE');
	});
	it('restores preferred font when a Range read fails with an intermediate size installed', () => {
		const rect = { left: 0, top: 0, right: 40, bottom: 100, width: 40, height: 100 };
		const parent = { clientHeight: 100, getBoundingClientRect: () => rect };
		const span = {
			style: { fontSize: '32px' },
			textContent: 'full caption',
			isConnected: true,
			closest: () => parent,
			parentElement: null,
			clientWidth: 40,
			scrollWidth: 40,
			clientHeight: 160,
			scrollHeight: 160,
			getBoundingClientRect: () => ({ ...rect, top: -30, bottom: 130, height: 160 })
		} as unknown as HTMLElement;
		let reads = 0;
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
			transform: 'none',
			writingMode: 'horizontal-tb',
			clipPath: 'none',
			zoom: '1'
		}));
		vi.stubGlobal('document', {
			createRange: () => ({
				selectNodeContents: () => {},
				getClientRects: () => {
					if (++reads === 2) throw new Error('Range failed after floor write');
					return [span.getBoundingClientRect()];
				}
			})
		});
		try {
			expect(fitCaption(span, '32px')).toMatchObject({
				outcome: 'MEASUREMENT_FAILED',
				error: 'Error: Range failed after floor write'
			});
			expect(span.style.fontSize).toBe('32px');
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
