import { it, expect, vi } from 'vitest';
import { tick } from 'svelte';
import { buildGridset } from '$lib/gridset/__fixtures__/buildGridset';
import { createRuntime } from '$lib/gridset/runtime.svelte';
import { writeGridSet, openGridSet } from '$lib/gridset/gridSetSource';
import { createGridSetEditor, validateJsonGridSet } from './gridset-editor.svelte';

function bytes(caption = 'original') {
	return buildGridset({
		startGrid: 'P',
		language: 'he',
		styles: [{ key: 'base', backColour: '#11223380' }],
		pages: [
			{
				name: 'P',
				columns: 2,
				rows: 1,
				cells: [
					{ x: 0, y: 0, caption, basedOnStyle: 'base' },
					{ x: 1, y: 0, caption: 'other' }
				]
			},
			{ name: 'Q', columns: 1, rows: 1, cells: [{ x: 0, y: 0, caption: 'Q' }] }
		]
	});
}
async function loaded() {
	const editor = createGridSetEditor();
	editor.loadFile(new File([new Uint8Array(bytes())], 'probe.gridset'));
	await expect.poll(() => editor.sourceName).toBe('probe.gridset');
	editor.runtimeReady(
		createRuntime(editor.gridSet, { speech: { speak: () => {}, stop: () => {} } })
	);
	editor.mode(true);
	return editor;
}
it('keeps invalid input separate, removes reverted overrides and asks before selection/page/mode transitions', async () => {
	const editor = await loaded();
	const identity = editor.gridSet;
	const source = editor.source!.bytes.slice();
	editor.select(editor.runtime!.page, editor.runtime!.page.cells[0]);
	expect(editor.appliedEdits).toEqual([]);
	editor.colour('BackColour', '#99887780');
	expect(editor.gridSet.pages.P.cells[0].style.backColour).toBe('#99887780');
	editor.colour('BackColour', '#11223380');
	expect(editor.hasDraft).toBe(false);
	editor.caption('valid');
	editor.colour('FontColour', 'oops');
	expect(editor.draftError).toContain('#RRGGBBAA');
	expect(editor.gridSet.pages.P.cells[0].caption).toBe('valid');
	expect(editor.apply()).toBe(false);
	editor.navigate('Q');
	expect(editor.pending).toBe('draft');
	editor.resolvePending('stay');
	expect(editor.runtime!.pageName).toBe('P');
	editor.cancel();
	expect(editor.gridSet.pages.P.cells[0].caption).toBe('original');
	editor.caption('A');
	editor.apply();
	editor.caption('draft');
	editor.mode(false);
	editor.resolvePending('cancel');
	expect(editor.editing).toBe(false);
	expect(editor.gridSet.pages.P.cells[0].caption).toBe('A');
	expect(editor.gridSet).toBe(identity);
	expect(editor.source!.bytes).toEqual(source);
	const output = await openGridSet(writeGridSet(editor.source!, editor.appliedEdits));
	expect(output.gridSet.pages.P.cells[0].caption).toBe('A');
});
it('copies an immutable resolved snapshot across pages and keeps no-op revisions stable', async () => {
	const editor = await loaded();
	const source = editor.gridSet.pages.P.cells[0];
	editor.select(editor.runtime!.page, source);
	editor.caption('draft source');
	editor.copyCaptionColours();
	expect(editor.pending).toBe('draft');
	await editor.resolvePending('stay');
	expect(editor.clipboard).toBeNull();
	editor.copyCaptionColours();
	await editor.resolvePending('apply');
	expect(editor.clipboard?.caption).toBe('draft source');
	expect(editor.clipboard?.colours.BackColour).toBe('#11223380');
	const initialRevision = editor.unsaved;
	editor.pasteCaptionColours();
	expect(editor.hasDraft).toBe(false);
	expect(editor.unsaved).toBe(initialRevision);
	editor.caption('later source');
	editor.apply();
	editor.navigate('Q');
	editor.select(editor.runtime!.page, editor.runtime!.page.cells[0]);
	editor.pasteCaptionColours();
	expect(editor.form?.caption).toBe('draft source');
	expect(editor.form?.colours.BackColour).toBe('#11223380');
	expect(editor.hasDraft).toBe(true);
	editor.cancel();
	expect(editor.gridSet.pages.Q.cells[0].caption).toBe('Q');
	editor.pasteCaptionColours();
	editor.apply();
	const count = editor.appliedEdits.length;
	editor.pasteCaptionColours();
	expect(editor.hasDraft).toBe(false);
	expect(editor.appliedEdits).toHaveLength(count);
	const saved = await openGridSet(writeGridSet(editor.source!, editor.appliedEdits));
	expect(saved.gridSet.pages.Q.cells[0].caption).toBe('draft source');
	expect(saved.gridSet.pages.P.cells[0].caption).toBe('later source');
});

it('preserves nil on empty paste and clear while allowing colours on hidden and disabled cells', async () => {
	const editor = createGridSetEditor();
	const input = buildGridset({
		startGrid: 'P',
		language: 'he',
		styles: [{ key: 'base', backColour: '#11223380' }],
		pages: [
			{
				name: 'P',
				columns: 5,
				rows: 1,
				cells: [
					{ x: 0, y: 0, caption: null, basedOnStyle: 'base' },
					{ x: 1, y: 0, caption: null, visibility: 'Hidden' },
					{ x: 2, y: 0, caption: 'disabled', visibility: 'Disabled', columnSpan: 2 },
					{ x: 4, y: 0, contentType: 'AutoContent' }
				]
			}
		]
	});
	await editor.loadFile(new File([new Uint8Array(input)], 'nil.gridset'));
	editor.mode(true);
	editor.select(editor.runtime!.page, editor.runtime!.page.cells[0]);
	editor.copyCaptionColours();
	editor.select(editor.runtime!.page, editor.runtime!.page.cells[1]);
	editor.clearCaption();
	expect(editor.hasDraft).toBe(false);
	editor.pasteCaptionColours();
	expect(editor.hasDraft).toBe(true);
	expect(editor.gridSet.pages.P.cells[1].caption).toBeUndefined();
	editor.apply();
	editor.select(editor.runtime!.page, editor.runtime!.page.cells[2]);
	editor.clearCaption();
	expect(editor.gridSet.pages.P.cells[2].caption).toBe('');
	editor.apply();
	editor.select(editor.runtime!.page, editor.runtime!.page.cells[3]);
	editor.copyCaptionColours();
	expect(editor.operationStatus).toContain('דינמי');
	const output = writeGridSet(editor.source!, editor.appliedEdits);
	const xml = new TextDecoder().decode(
		(await import('fflate')).unzipSync(output)['Grids/P/grid.xml']
	);
	expect(xml.match(/xsi:nil="true"/g)).toHaveLength(2);
	expect(xml).toContain('ColumnSpan="2"');
	expect(xml).toContain('<Visibility>Hidden</Visibility>');
	expect(xml).toContain('<Visibility>Disabled</Visibility>');
});
it('publishes only the latest load and retains source/model/edits on failed replacement', async () => {
	const editor = createGridSetEditor();
	let release!: (r: Response) => void;
	const delayed = new Promise<Response>((resolve) => {
		release = resolve;
	});
	const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => delayed);
	try {
		editor.loadUrl('/delayed', 'delayed.gridset');
		await tick();
		editor.loadFile(new File([new Uint8Array(bytes('manual'))], 'manual.gridset'));
		await expect.poll(() => editor.sourceName).toBe('manual.gridset');
		release(new Response(new Uint8Array(bytes('automatic'))));
		await new Promise((resolve) => setTimeout(resolve, 60));
		expect(editor.sourceName).toBe('manual.gridset');
		expect(editor.gridSet.pages.P.cells[0].caption).toBe('manual');
		const identity = editor.gridSet;
		const source = editor.source;
		editor.loadFile(new File([new Uint8Array([0x50, 0x4b, 0, 0])], 'broken.gridset'));
		await expect.poll(() => editor.error).toContain('ZIP');
		expect(editor.gridSet).toBe(identity);
		expect(editor.source).toBe(source);
	} finally {
		fetchMock.mockRestore();
	}
});

it('accepts a complete JSON model and rejects a missing start page before replacing the board', async () => {
	const editor = await loaded();
	const identity = editor.gridSet;
	const source = editor.source;
	const valid = JSON.parse(JSON.stringify({ ...editor.gridSet, media: undefined }));
	validateJsonGridSet(valid);
	editor.loadFile(new File([JSON.stringify(valid)], 'valid.json', { type: 'application/json' }));
	await expect.poll(() => editor.sourceName).toBe('valid.json');
	expect(editor.source).toBeNull();
	const validIdentity = editor.gridSet;

	editor.loadFile(
		new File(['{"pages":{},"startGrid":"missing"}'], 'bad.json', {
			type: 'application/json'
		})
	);
	await expect.poll(() => editor.error).toContain('דף פתיחה קיים');
	expect(editor.gridSet).toBe(validIdentity);
	expect(editor.source).toBeNull();
	expect(editor.gridSet).not.toBe(identity);
	expect(source).not.toBeNull();
});

it('Back guards a retained runtime, preserves draft decisions and applied edits, and rechecks history', async () => {
	const editor = await loaded();
	const runtime = editor.runtime!;
	const model = editor.gridSet;
	editor.select(runtime.page, runtime.page.cells[0]);
	const initialSelection = editor.selection;
	editor.back();
	expect(editor.selection).toBe(initialSelection);
	expect(editor.canGoBack).toBe(false);
	expect(runtime.backRevision).toBe(0);
	editor.navigate('Q');
	editor.select(runtime.page, runtime.page.cells[0]);
	editor.caption('applied Q');
	const form = editor.form;
	const selection = editor.selection;
	const back = vi.spyOn(runtime, 'back');
	editor.setLoading(true);
	editor.back();
	expect(back).not.toHaveBeenCalled();
	expect(runtime.backRevision).toBe(0);
	expect(editor.pending).toBeNull();
	editor.setLoading(false);
	editor.back();
	expect(editor.pending).toBe('draft');
	editor.back();
	expect(back).not.toHaveBeenCalled();
	expect(runtime.backRevision).toBe(0);
	await editor.resolvePending('stay');
	expect(runtime.pageName).toBe('Q');
	expect(runtime.history).toEqual(['P']);
	expect(editor.form).toBe(form);
	expect(runtime.backRevision).toBe(0);
	expect(editor.selection).toBe(selection);
	editor.back();
	await editor.resolvePending('apply');
	expect(back).toHaveBeenCalledTimes(1);
	expect(runtime.backRevision).toBe(1);
	expect(editor.runtime).toBe(runtime);
	expect(editor.gridSet).toBe(model);
	expect(editor.selection).toBeNull();
	expect(editor.appliedEdits[0].caption).toBe('applied Q');
	expect(editor.unsaved).toBe(true);
	editor.navigate('Q');
	editor.select(runtime.page, runtime.page.cells[0]);
	editor.caption('discard only draft');
	editor.back();
	await editor.resolvePending('cancel');
	expect(back).toHaveBeenCalledTimes(2);
	expect(runtime.backRevision).toBe(2);
	expect(model.pages.Q.cells[0].caption).toBe('applied Q');
	editor.navigate('Q');
	editor.select(runtime.page, runtime.page.cells[0]);
	editor.colour('FontColour', 'invalid');
	editor.back();
	await editor.resolvePending('apply');
	expect(editor.pending).toBe('draft');
	expect(back).toHaveBeenCalledTimes(2);
	expect(runtime.backRevision).toBe(2);
	await editor.resolvePending('stay');
	editor.cancel();
	editor.caption('stale history');
	editor.back();
	runtime.home();
	await editor.resolvePending('apply');
	expect(back).toHaveBeenCalledTimes(2);
	expect(runtime.backRevision).toBe(2);
	// Accepted draft was applied, but an exhausted history must not reset selection.
	expect(editor.selection).not.toBeNull();
	expect(editor.canGoBack).toBe(false);
});

it('keeps a WordList draft off the opened pages and asks before replacing the board', async () => {
	const editor = createGridSetEditor();
	const fileBytes = buildGridset({
		startGrid: 'News',
		language: 'he',
		pages: [
			{
				name: 'News',
				columns: 2,
				rows: 1,
				wordList: [{ text: 'one' }, { text: 'two' }],
				cells: [
					{ x: 0, y: 0, contentType: 'AutoContent', contentSubType: 'WordList' },
					{ x: 1, y: 0, caption: 'save', commands: [{ id: 'Prediction.AddToWordList' }] }
				]
			},
			{ name: 'Other', columns: 1, rows: 1, cells: [{ x: 0, y: 0, caption: 'other' }] }
		]
	});
	await editor.loadFile(new File([new Uint8Array(fileBytes)], 'news.gridset'));
	const runtime = editor.runtime!;
	const original = runtime.page.wordList;
	runtime.output.insert({ text: 'saved' });
	runtime.toggleWordListArm('add');
	expect(runtime.applyWordListTarget(0)).toBe(true);
	expect(runtime.page.wordList).toBe(original);
	expect(runtime.visibleWordList()[0].text.paragraphs[0].sentences[0].runs[0]).toBe('saved');
	expect(editor.dirty).toBe(true);
	expect(editor.unsaved).toBe(true);
	expect(editor.source!.bytes).toEqual(fileBytes);
	const stay = editor.loadFile(new File([new Uint8Array(bytes('new'))], 'other.gridset'));
	await expect.poll(() => editor.pending).toBe('load');
	await editor.resolvePending('stay');
	expect(await stay).toBe(false);
	expect(runtime.visibleWordList()[0].text.paragraphs[0].sentences[0].runs[0]).toBe('saved');
	expect(editor.discardChanges()).toBe(true);
	expect(runtime.visibleWordList()).toEqual(original);
	expect(editor.dirty).toBe(false);
	expect(editor.unsaved).toBe(false);
	expect(editor.wordListEdits).toEqual([]);
});
