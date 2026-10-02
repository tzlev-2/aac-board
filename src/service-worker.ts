/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const CACHE_PREFIX = 'aac-board-';
const CACHE = `${CACHE_PREFIX}${version}`;
const OFFLINE = '/offline.html';
const PRECACHE = [...build, ...files];
const CLONE_ROUTES = new Set(['/', '/grid', '/settings']);

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then(async (cache) => {
			await cache.addAll(PRECACHE);
			await self.skipWaiting();
		})
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			// Only versioned app shells belong to this worker. Symbol/audio/user caches stay.
			await Promise.all(
				keys
					.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
					.map((key) => caches.delete(key))
			);
			await self.clients.claim();
		})
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(
			(async () => {
				let timer: ReturnType<typeof setTimeout> | undefined;
				const cache = await caches.open(CACHE);
				try {
					const response = await Promise.race([
						fetch(request, { redirect: 'follow' }),
						new Promise<never>((_, reject) => {
							timer = setTimeout(() => reject(new Error('Navigation timeout')), 4000);
						})
					]);
					if (response.ok && CLONE_ROUTES.has(url.pathname)) {
						await cache.put(request, response.clone());
					}
					return response;
				} catch {
					// Never consult other caches or serve a shell for a removed legacy route.
					if (CLONE_ROUTES.has(url.pathname)) {
						const cached = await cache.match(request);
						if (cached) return cached;
					}
					const offline = await cache.match(OFFLINE);
					// Static hosting redirects /offline.html to /offline. A navigation fallback
					// needs a fresh response so the cached redirect flag cannot reject it.
					return offline
						? new Response(offline.body, { status: 200, headers: offline.headers })
						: new Response('Offline', { status: 503 });
				} finally {
					clearTimeout(timer);
				}
			})()
		);
		return;
	}

	if (PRECACHE.includes(url.pathname)) {
		event.respondWith(
			caches.open(CACHE).then(async (cache) => (await cache.match(request)) ?? fetch(request))
		);
	}
});
