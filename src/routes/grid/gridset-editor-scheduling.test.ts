import { afterEach, expect, it, vi } from 'vitest';
import { createGridSetEditor, nextFrame } from './gridset-editor.svelte';
import { SAMPLE_GRID_SET } from './sampleGridSet';
import type { GridSetSource } from '$lib/gridset/gridSetSource';
import { readZipIndex } from '$lib/gridset/zipArchive';
import { buildGridset } from '$lib/gridset/__fixtures__/buildGridset';

function sourceOf(bytes: Uint8Array): GridSetSource {
	return {
		bytes,
		index: readZipIndex(bytes),
		pageEntry: new Map([[SAMPLE_GRID_SET.startGrid, `Grids/${SAMPLE_GRID_SET.startGrid}/grid.xml`]])
	};
}
function captureFrame() {
	let callback!: FrameRequestCallback;
	vi.stubGlobal('requestAnimationFrame', (value: FrameRequestCallback) => {
		callback = value;
		return 1;
	});
	return () => callback(0);
}
function editorWithDraft() {
	const gridSet = structuredClone(SAMPLE_GRID_SET);
	const page = gridSet.pages[gridSet.startGrid];
	const source = sourceOf(
		buildGridset({
			startGrid: page.name,
			pages: [
				{
					name: page.name,
					columns: page.columns,
					rows: page.rows,
					cells: [{ x: 0, y: 0, caption: 'original' }]
				}
			]
		})
	);
	const editor = createGridSetEditor();
	editor.publish(
		{
			gridSet,
			source,
			editSession: {
				editableCell: () => page.cells[0],
				preview: () => ({
					...page,
					cells: page.cells.map((cell, index) =>
						index === 0 ? { ...cell, caption: 'keep-draft' } : cell
					)
				})
			}
		},
		'scheduling.gridset'
	);
	editor.mode(true);
	editor.select(editor.runtime!.page, editor.runtime!.page.cells[0]);
	editor.caption('keep-draft');
	return editor;
}
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

it('rejects nextFrame when setTimeout throws inside the deferred rAF callback', async () => {
	const frame = captureFrame();
	const error = new Error('injected-nextFrame-scheduling-failure');
	vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
		throw error;
	});
	const rejected = expect(nextFrame()).rejects.toBe(error);
	frame();
	await rejected;
});
it('settles failed save and preserves its draft while clearing saving/busy after callback scheduler failure', async () => {
	const editor = editorWithDraft();
	const before = {
		form: editor.form,
		model: editor.gridSet,
		source: editor.source,
		patches: editor.appliedEdits,
		downloaded: editor.downloaded
	};
	const frame = captureFrame();
	vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
		throw new Error('scheduler failure');
	});
	const copy = editor.saveCopy();
	expect(editor.saving).toBe(true);
	frame();
	expect(await copy).toBe(false);
	expect(editor.saving).toBe(false);
	expect(editor.busy).toBe(false);
	expect(editor.hasDraft).toBe(true);
	expect(editor.unsaved).toBe(true);
	expect(editor.form).toBe(before.form);
	expect(editor.gridSet).toBe(before.model);
	expect(editor.source).toBe(before.source);
	expect(editor.appliedEdits).toBe(before.patches);
	expect(editor.downloaded).toBe(before.downloaded);
	expect(editor.error).toContain('scheduler failure');
});
it('retains a failed pending save decision so stay remains usable', async () => {
	const editor = editorWithDraft();
	const decision = editor.confirmReplacement();
	const frame = captureFrame();
	vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
		throw new Error('pending scheduler failure');
	});
	const saving = editor.resolvePending('save');
	frame();
	await saving;
	expect(editor.saving).toBe(false);
	expect(editor.pending).toBe('load');
	expect(editor.form!.caption).toBe('keep-draft');
	await editor.resolvePending('stay');
	expect(await decision).toBe(false);
});
it('falls back to immediate URL release on cleanup scheduling failure, even if release throws', async () => {
	const editor = createGridSetEditor();
	const gridSet = structuredClone(SAMPLE_GRID_SET);
	const page = gridSet.pages[gridSet.startGrid];
	const source = sourceOf(
		buildGridset({
			startGrid: page.name,
			pages: [{ name: page.name, columns: page.columns, rows: page.rows, cells: [] }]
		})
	);
	editor.publish({ gridSet, source, editSession: null }, 'cleanup.gridset');
	const frame = captureFrame();
	vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback, delay) => {
		if (delay === 1000) throw new Error('cleanup scheduling failure');
		(callback as () => void)();
		return 1 as unknown as ReturnType<typeof setTimeout>;
	});
	const click = vi.fn();
	vi.stubGlobal('document', { createElement: () => ({ href: '', download: '', click }) });
	const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {
		throw new Error('release failure');
	});
	const copy = editor.saveCopy();
	frame();
	expect(await copy).toBe(true);
	expect(click).toHaveBeenCalledOnce();
	expect(revoke).toHaveBeenCalledOnce();
	expect(editor.downloaded).toBe('cleanup-edited.gridset');
	expect(editor.saving).toBe(false);
	expect(editor.busy).toBe(false);
});

it('preserves draft and download marker when download fails and cleanup scheduling also fails', async () => {
	const editor = editorWithDraft();
	const before = {
		form: editor.form,
		preview: editor.selectedCell,
		patches: editor.appliedEdits,
		downloaded: editor.downloaded
	};
	const frame = captureFrame();
	vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback, delay) => {
		if (delay === 1000) throw new Error('cleanup scheduling failure');
		(callback as () => void)();
		return 1 as unknown as ReturnType<typeof setTimeout>;
	});
	vi.stubGlobal('document', {
		createElement: () => ({
			href: '',
			download: '',
			click: () => {
				throw new Error('download initiation failure');
			}
		})
	});
	const revoke = vi.spyOn(URL, 'revokeObjectURL');
	const copy = editor.saveCopy();
	frame();
	expect(await copy).toBe(false);
	expect(revoke).toHaveBeenCalledOnce();
	expect(editor.error).toContain('download initiation failure');
	expect(editor.form).toBe(before.form);
	expect(editor.selectedCell).toBe(before.preview);
	expect(editor.appliedEdits).toBe(before.patches);
	expect(editor.downloaded).toBe(before.downloaded);
	expect(editor.hasDraft).toBe(true);
	expect(editor.unsaved).toBe(true);
	expect(editor.saving).toBe(false);
	expect(editor.busy).toBe(false);
});
