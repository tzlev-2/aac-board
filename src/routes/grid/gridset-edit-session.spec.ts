import { describe, it, expect } from 'vitest';
import { editedFilename, upsertCellEdit, validateCellEdit } from './gridset-edit-session';
import type { CellEdit } from '$lib/gridset/gridSetSource';
describe('sparse edits and validation', () => {
	it('merges fields in first-application order with separate address parts', () => {
		const a: CellEdit = { page: 'a|1', x: 2, y: 0, caption: ' ' };
		const b: CellEdit = { page: 'a', x: 1, y: 2, colours: { BackColour: '#11223300' } };
		const applied = upsertCellEdit(upsertCellEdit([], a), b);
		const next = upsertCellEdit(applied, { ...a, colours: { FontColour: '#12345680' } });
		expect(next).toEqual([{ ...a, colours: { FontColour: '#12345680' } }, b]);
		expect(applied).toEqual([a, b]);
		expect(upsertCellEdit(next, { page: 'a', x: 3, y: 2 })).toEqual(next);
		expect(upsertCellEdit(next, { ...a, caption: '' })[0].caption).toBe('');
	});
	it('rejects unknown fields, bad coordinates, colours and XML code points without trimming', () => {
		const a: CellEdit = { page: 'p', x: 0, y: 0 };
		for (const patch of [
			{ x: -1 },
			{ y: 1.5 },
			{ caption: '\u0000' },
			{ caption: '\ud800' },
			{ caption: '\ufffe' },
			{ colours: { BackColour: '#fff' } },
			{ colours: { Other: '#000000FF' } },
			{ extra: 1 }
		])
			expect(() => validateCellEdit({ ...a, ...patch } as CellEdit)).toThrow();
		for (const caption of ['', ' ', '\n\t\r', 'אֵ🙂&<>'])
			expect(() => validateCellEdit({ ...a, caption })).not.toThrow();
	});
	it('always emits a safe GridSet filename', () => {
		expect(
			[
				'plain',
				'odd.json',
				'he-edited-edited.gridset',
				'dir/file.gridset',
				'dir\\file.gridset',
				'',
				'אב.gridset',
				'x\u0000.gridset'
			].map(editedFilename)
		).toEqual([
			'plain-edited.gridset',
			'odd-edited.gridset',
			'he-edited.gridset',
			'file-edited.gridset',
			'file-edited.gridset',
			'gridset-edited.gridset',
			'אב-edited.gridset',
			'x-edited.gridset'
		]);
	});
});
