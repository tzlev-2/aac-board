import { it, expect, vi } from 'vitest';
import { createApplicationSession } from './application-session.svelte';
import { buildGridset } from './__fixtures__/buildGridset';
import { validateJsonGridSet } from './validate-json';
const bytes = (caption = 'original') =>
	buildGridset({
		startGrid: 'P',
		language: 'he',
		pages: [
			{ name: 'P', columns: 1, rows: 1, cells: [{ x: 0, y: 0, caption }] },
			{ name: 'Q', columns: 1, rows: 1, cells: [] }
		]
	});
const file = (caption = 'original') => new File([new Uint8Array(bytes(caption))], 'same.gridset');
async function draft(session: ReturnType<typeof createApplicationSession>) {
	await session.importFile(file());
	const editor = session.editor;
	editor.mode(true);
	editor.select(editor.runtime!.page, editor.runtime!.page.cells[0]);
	editor.caption('draft');
	return editor;
}
it('isolates layout factories and resumes exact runtime/model/draft/output/pager without loading', async () => {
	const goto = vi.fn(async () => {});
	const a = createApplicationSession(goto);
	const b = createApplicationSession(goto);
	a.editor.gridSet.pages[a.editor.gridSet.startGrid].cells[0].caption = 'mutated';
	expect(b.editor.gridSet.pages[b.editor.gridSet.startGrid].cells[0].caption).not.toBe('mutated');
	const e = await draft(a);
	const model = e.gridSet;
	const runtime = e.runtime;
	runtime!.navigate('Q');
	runtime!.navigateWordList('next');
	runtime!.output.insert({ text: 'output' });
	const attachment = runtime!.attach();
	attachment.detach();
	await a.resume();
	expect(e.runtime).toBe(runtime);
	expect(e.gridSet).toBe(model);
	expect(e.form!.caption).toBe('draft');
	expect(runtime!.pageName).toBe('Q');
	expect(runtime!.wordListPage).toBe(1);
	expect(runtime!.outputText).toBe('output');
	expect(b.active).toBeNull();
});
it('stages failures before decisions, retains draft on stay/save failure and accepts duplicate names only on success', async () => {
	const a = createApplicationSession(async () => {});
	const e = await draft(a);
	const identity = a.active;
	const model = e.gridSet;
	const form = e.form;
	expect((await a.importFile(new File(['{}'], 'bad.json'))).status).toBe('failed');
	expect(e.pending).toBeNull();
	expect(e.gridSet).toBe(model);
	expect(e.form).toBe(form);
	const stay = a.importFile(file('new'));
	await expect.poll(() => e.pending).toBe('load');
	await e.resolvePending('stay');
	expect((await stay).status).toBe('stayed');
	expect(a.active).toBe(identity);
	expect(e.hasDraft).toBe(true);
	const open = a.importFile(file('new'));
	await expect.poll(() => e.pending).toBe('load');
	const create = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
		throw new Error('blob failure');
	});
	await e.resolvePending('save');
	create.mockRestore();
	expect(e.form).toBe(form);
	expect(e.hasDraft).toBe(true);
	expect(e.unsaved).toBe(true);
	expect(e.pending).toBe('load');
	await e.resolvePending('cancel');
	expect((await open).status).toBe('opened');
	expect(a.imports).toHaveLength(2);
	expect(a.imports[0].name).toBe(a.imports[1].name);
	expect(a.imports[0].id).not.toBe(a.imports[1].id);
	expect(a.imports[0].label).not.toBe(a.imports[1].label);
	expect(e.runtime!.pageName).toBe('P');
	expect(e.hasDraft).toBe(false);
});
it('saves from a pending decision, keeps dirty separate from unsaved and does not reload on failed goto retry', async () => {
	const goto = vi.fn(async () => {});
	const a = createApplicationSession(goto);
	const e = await draft(a);
	const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
	const copy = a.importFile(file('new'));
	await expect.poll(() => e.pending).toBe('load');
	await e.resolvePending('save');
	expect((await copy).status).toBe('opened');
	expect(click).toHaveBeenCalledTimes(1);
	e.mode(true);
	e.select(e.runtime!.page, e.runtime!.page.cells[0]);
	e.caption('saved');
	expect(await e.saveCopy()).toBe(true);
	expect(e.dirty).toBe(true);
	expect(e.unsaved).toBe(false);
	click.mockRestore();
	goto.mockRejectedValueOnce(new Error('navigation aborted'));
	const next = await a.importFile(file('third'));
	expect(next.status).toBe('navigation-failed');
	const model = e.gridSet;
	const runtime = e.runtime;
	expect(e.pending).toBeNull();
	expect(a.busy).toBe(false);
	expect(e.error).toContain('navigation aborted');
	await a.resume();
	expect(e.gridSet).toBe(model);
	expect(e.runtime).toBe(runtime);
});
it('invalidates staged and pending intents on accepted navigation and rejects repeated busy handlers', async () => {
	const goto = vi.fn(async () => {});
	const a = createApplicationSession(goto);
	const e = await draft(a);
	let release!: (response: Response) => void;
	const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(
		() =>
			new Promise((resolve) => {
				release = resolve;
			})
	);
	const old = a.selectApplication(a.samples[0]);
	await expect.poll(() => Boolean(release)).toBe(true);
	expect((await a.importFile(file('busy'))).status).toBe('superseded');
	a.navigationAccepted();
	release(new Response(new Uint8Array(bytes('late'))));
	expect((await old).status).toBe('superseded');
	expect(e.form!.caption).toBe('draft');
	fetch.mockRestore();
	const pending = a.importFile(file('pending'));
	await expect.poll(() => e.pending).toBe('load');
	a.navigationAccepted();
	expect((await pending).status).toBe('superseded');
	await e.resolvePending('cancel');
	expect(e.form!.caption).toBe('draft');
	expect(goto).toHaveBeenCalledTimes(1);
});
it('rejects malformed nested JSON render inputs and preserves valid unknown commands', async () => {
	const a = createApplicationSession(async () => {});
	await a.importFile(file());
	const json = () => JSON.parse(JSON.stringify({ ...a.editor.gridSet, media: undefined }));
	const mutations: [string[], unknown][] = [
		[['pages', 'P', 'cells'], [{}]],
		[['pages', 'P', 'cells', '0', 'style', 'fontSize'], 'bad'],
		[
			['pages', 'P', 'cells', '0', 'commands'],
			[{ id: 'Unknown', params: { text: { paragraphs: [{}] } } }]
		],
		[['pages', 'P', 'wordList'], [{ text: 'bad' }]],
		[['pages', 'P', 'columnWidths'], ['bad']],
		[['pages', 'P', 'background', 'colour'], {}],
		[['media'], {}],
		[['symbolSearchKeys'], [5]]
	];
	for (const [path, value] of mutations) {
		const v = json();
		let target: Record<string, unknown> = v;
		for (const key of path.slice(0, -1)) target = target[key] as Record<string, unknown>;
		target[path.at(-1)!] = value;
		expect(() => validateJsonGridSet(v)).toThrow('invalid-json');
	}
	const valid = json();
	valid.pages.P.cells[0].commands = [{ id: 'Unknown.WellFormed', params: { text: 'Latin עברית' } }];
	expect(() => validateJsonGridSet(valid)).not.toThrow();
});

it('exempts only its own board goto; unrelated accepted navigation invalidates an unfinished goto', async () => {
	let owned!: ReturnType<typeof createApplicationSession>;
	owned = createApplicationSession(async () => {
		owned.navigationAccepted('/board', 'goto');
	});
	expect((await owned.importFile(file())).status).toBe('opened');
	let moved!: ReturnType<typeof createApplicationSession>;
	moved = createApplicationSession(async () => {
		moved.navigationAccepted('/settings', 'link');
		throw new Error('aborted');
	});
	expect((await moved.importFile(file())).status).toBe('superseded');
	expect(moved.editor.error).toBe('');
	expect(moved.busy).toBe(false);
});
