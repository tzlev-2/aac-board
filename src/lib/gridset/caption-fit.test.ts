import { describe, expect, it } from 'vitest';
import { searchCaptionFont } from './caption-fit';

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
});
