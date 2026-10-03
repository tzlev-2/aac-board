import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { expect, test, vi } from 'vitest';

function worker() {
	const listeners: Record<string, (event: any) => void> = {};
	const stores = new Map<string, Map<string, Response>>();
	const cache = (name: string) => {
		if (!stores.has(name)) stores.set(name, new Map());
		const values = stores.get(name)!;
		return {
			addAll: vi.fn(async () => {}),
			put: async (key: any, response: Response) => {
				values.set(typeof key === 'string' ? key : key.url, response);
			},
			match: async (key: any) => values.get(typeof key === 'string' ? key : key.url)?.clone()
		};
	};
	const caches = {
		open: async (name: string) => cache(name),
		keys: async () => [...stores.keys()],
		delete: vi.fn(async (name: string) => stores.delete(name))
	};
	const fetch = vi.fn();
	const self = {
		location: { origin: 'https://clone.test' },
		clients: { claim: vi.fn() },
		skipWaiting: vi.fn(),
		addEventListener: (name: string, handler: any) => {
			listeners[name] = handler;
		}
	};
	const source = readFileSync(new URL('./service-worker.ts', import.meta.url), 'utf8').replace(
		"import { build, files, version } from '$service-worker';",
		"const build = ['/app.js'], files = ['/offline.html'], version = 'candidate';"
	);
	runInNewContext(
		ts
			.transpileModule(source, {
				compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
			})
			.outputText.replace(/export \{\};?/, ''),
		{ self, caches, fetch, Response, URL, setTimeout, clearTimeout, console }
	);
	return {
		stores,
		cache,
		caches,
		fetch,
		activate: () =>
			new Promise<void>((resolve, reject) =>
				listeners.activate({ waitUntil: (p: Promise<void>) => p.then(resolve, reject) })
			),
		navigate: (path: string) =>
			new Promise<Response>((resolve, reject) =>
				listeners.fetch({
					request: { url: 'https://clone.test' + path, mode: 'navigate', method: 'GET' },
					respondWith: (p: Promise<Response>) => p.then(resolve, reject)
				})
			)
	};
}

test('upgrade deletes only old app shells and retains unrelated CacheStorage', async () => {
	const w = worker();
	await w.cache('aac-board-old').put('/s/legacy', new Response('legacy'));
	await w.cache('aac-board-candidate').put('/offline.html', new Response('offline'));
	await w.cache('external-user-cache').put('/sentinel', new Response('retain'));
	await w.cache('aac-symbols').put('/symbol', new Response('symbol'));
	await w.activate();
	expect(w.caches.delete.mock.calls.map((c) => c[0])).toEqual(['aac-board-old']);
	expect(
		await w
			.cache('external-user-cache')
			.match('/sentinel')
			.then((r) => r?.text())
	).toBe('retain');
	expect(
		await w
			.cache('aac-symbols')
			.match('/symbol')
			.then((r) => r?.text())
	).toBe('symbol');
});

test('offline root uses current Clone only, and removed routes never fall back to a cached legacy page', async () => {
	const w = worker();
	await w.cache('aac-board-old').put('https://clone.test/', new Response('legacy-root'));
	await w.cache('unrelated').put('https://clone.test/s/old', new Response('legacy-board'));
	await w.cache('aac-board-candidate').put('/offline.html', new Response('Clone offline'));
	w.fetch.mockRejectedValue(new Error('offline'));
	expect(await (await w.navigate('/')).text()).toBe('Clone offline');
	w.fetch.mockResolvedValue(new Response('current Clone'));
	expect(await (await w.navigate('/')).text()).toBe('current Clone');
	w.fetch.mockRejectedValue(new Error('offline'));
	expect(await (await w.navigate('/')).text()).toBe('current Clone');
	expect(await (await w.navigate('/s/old')).text()).toBe('Clone offline');
	expect(await (await w.navigate('/sets')).text()).toBe('Clone offline');
});

test('404 legacy navigation is returned without caching it as a Clone shell', async () => {
	const w = worker();
	await w.cache('aac-board-candidate').put('/offline.html', new Response('Clone offline'));
	w.fetch.mockResolvedValue(new Response('missing', { status: 404 }));
	expect((await w.navigate('/s/old')).status).toBe(404);
	expect(w.stores.get('aac-board-candidate')!.has('https://clone.test/s/old')).toBe(false);
});

test('offline fallback strips the redirected flag of clean-URL static hosting', async () => {
	const w = worker();
	const response = new Response('offline HTML');
	const clone = response.clone.bind(response);
	Object.defineProperty(response, 'clone', {
		value: () => {
			const copy = clone();
			Object.defineProperty(copy, 'redirected', { value: true });
			return copy;
		}
	});
	await w.cache('aac-board-candidate').put('/offline.html', response);
	w.fetch.mockRejectedValue(new Error('offline'));
	const fallback = await w.navigate('/s/old');
	expect(fallback.redirected).toBe(false);
	expect(await fallback.text()).toBe('offline HTML');
});

test('/board keeps network-first current shell fallback and never caches a 404', async () => {
	const w = worker();
	await w.cache('aac-board-candidate').put('/offline.html', new Response('offline'));
	w.fetch.mockResolvedValue(new Response('current board shell'));
	expect(await (await w.navigate('/board')).text()).toBe('current board shell');
	w.fetch.mockRejectedValue(new Error('offline'));
	expect(await (await w.navigate('/board')).text()).toBe('current board shell');
	w.fetch.mockResolvedValue(new Response('missing', { status: 404 }));
	expect((await w.navigate('/board')).status).toBe(404);
	expect(
		await (await w.cache('aac-board-candidate').match('https://clone.test/board'))!.text()
	).toBe('current board shell');
});
