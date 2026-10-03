import { it, expect, vi } from 'vitest';
import { createRuntime } from './runtime.svelte';
import { executeCommands } from './commands';
import { buildGridset } from './__fixtures__/buildGridset';
import { openGridSet } from './gridSetSource';
import { createSymbolResolver } from './symbols';

it('permanently cancels a delayed actual cell chain on detach, preserving synchronous chains', async () => {
	const { gridSet } = await openGridSet(
		buildGridset({
			startGrid: 'P',
			pages: [
				{
					name: 'P',
					columns: 1,
					rows: 1,
					cells: [
						{
							x: 0,
							y: 0,
							commands: [
								{ id: 'CommandExecution.Wait', params: { waittime: '1' } },
								{ id: 'Action.InsertText', params: { text: 'late' } }
							]
						}
					]
				}
			]
		})
	);
	const runtime = createRuntime(gridSet, { speech: { speak: () => {}, stop: () => {} } });
	const a = runtime.attach();
	let release!: () => void;
	const chain = executeCommands(gridSet.pages.P.cells[0], runtime, undefined, {
		isCurrent: a.valid,
		delay: () =>
			new Promise((resolve) => {
				release = resolve;
			})
	});
	a.detach();
	const b = runtime.attach();
	release();
	await chain;
	expect(runtime.outputText).toBe('');
	expect(a.valid()).toBe(false);
	expect(b.valid()).toBe(true);
	const cell = {
		...gridSet.pages.P.cells[0],
		commands: [{ id: 'Action.InsertText', params: { text: 'now' } }]
	};
	const sync = executeCommands(cell, runtime, undefined, { isCurrent: b.valid });
	expect(runtime.outputText).toBe('now');
	await sync;
	b.detach();
});
it('releases owned embedded audio and reconnects fresh image resolution on identical references', async () => {
	const { gridSet } = await openGridSet(
		buildGridset({
			startGrid: 'P',
			pages: [{ name: 'P', columns: 1, rows: 1, cells: [{ x: 0, y: 0, caption: 'image' }] }]
		})
	);
	const cell = gridSet.pages.P.cells[0];
	cell.image = { library: '', path: 'test.png', embeddedPath: 'test.png' };
	gridSet.media = new Map([['test.png', new Uint8Array([137, 80, 78, 71])]]);
	const revoke = vi.spyOn(URL, 'revokeObjectURL');
	const resolver = createSymbolResolver(gridSet);
	const first = await resolver.resolve(cell);
	resolver.dispose?.();
	const next = createSymbolResolver(gridSet);
	const second = await next.resolve(cell);
	expect(first).not.toEqual(second);
	expect(revoke).toHaveBeenCalled();
	next.dispose?.();
	revoke.mockRestore();
	const audio = { play: vi.fn(), dispose: vi.fn() };
	const runtime = createRuntime(gridSet, { audio, speech: { speak: () => {}, stop: () => {} } });
	const a = runtime.attach();
	runtime.playSound('test.png');
	a.detach();
	expect(audio.dispose).toHaveBeenCalledTimes(1);
	const b = runtime.attach();
	runtime.playSound('test.png');
	expect(audio.play).toHaveBeenCalledTimes(2);
	b.detach();
});
