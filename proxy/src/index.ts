import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { Env, ProxyError, TtsResponse } from './types';
import { ttsHash } from './domain/hash';
import { fetchElevenLabs } from './providers/elevenlabs';
import { fetchGemini } from './providers/gemini';

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// CORS — allow the SvelteKit client on any domain
// ---------------------------------------------------------------------------
app.use(
	'*',
	cors({
		origin: '*',
		allowMethods: ['GET', 'POST', 'OPTIONS'],
		allowHeaders: ['Content-Type']
	})
);

// ---------------------------------------------------------------------------
// GET /v1/health
// ---------------------------------------------------------------------------
app.get('/v1/health', (c) => c.json({ ok: true }));

// ---------------------------------------------------------------------------
// POST /v1/tts
// Synthesizes audio (or returns a cached hit) and stores the result in R2.
// Returns { hash, mimeType, cached } — the audio bytes are fetched separately
// via GET /v1/tts/:hash.
// ---------------------------------------------------------------------------
app.post('/v1/tts', async (c) => {
	// --- Parse & validate request body ---
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json<ProxyError>({ error: 'Invalid JSON body', code: 'invalid_request' }, 400);
	}

	const req = body as Record<string, unknown>;
	const { text, provider, voiceId, modelId, lang } = req;

	if (
		typeof text !== 'string' ||
		typeof provider !== 'string' ||
		typeof voiceId !== 'string' ||
		typeof modelId !== 'string'
	) {
		return c.json<ProxyError>(
			{ error: 'Missing or invalid required fields: text, provider, voiceId, modelId', code: 'invalid_request' },
			400
		);
	}

	if (provider !== 'elevenlabs' && provider !== 'gemini') {
		return c.json<ProxyError>(
			{ error: `Unsupported provider: "${provider}"`, code: 'invalid_request' },
			400
		);
	}

	// --- Compute deterministic hash (mirrors client-side hash.ts) ---
	const hash = await ttsHash(provider, voiceId, modelId, text);

	const ext = provider === 'elevenlabs' ? 'mp3' : 'wav';
	const mimeType: TtsResponse['mimeType'] = provider === 'elevenlabs' ? 'audio/mpeg' : 'audio/wav';
	const r2Key = `tts/${provider}/${hash}.${ext}`;

	// --- L2 cache: check R2 ---
	const existing = await c.env.AUDIO_CACHE.head(r2Key);
	if (existing !== null) {
		return c.json<TtsResponse>({ hash, mimeType, cached: true });
	}

	// --- Cache miss: call origin API ---
	let audioData: ArrayBuffer;
	try {
		if (provider === 'elevenlabs') {
			audioData = await fetchElevenLabs(text, voiceId, modelId, c.env.ELEVENLABS_API_KEY);
		} else {
			audioData = await fetchGemini(
				text,
				voiceId,
				modelId,
				c.env.GEMINI_API_KEY,
				typeof lang === 'string' ? lang : undefined
			);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error('[aac-proxy] origin error:', message);
		return c.json<ProxyError>({ error: message, code: 'origin_failed' }, 502);
	}

	// --- Store in R2 ---
	try {
		await c.env.AUDIO_CACHE.put(r2Key, audioData, {
			httpMetadata: { contentType: mimeType }
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error('[aac-proxy] R2 put error:', message);
		return c.json<ProxyError>({ error: 'Failed to store audio in cache', code: 'internal' }, 500);
	}

	return c.json<TtsResponse>({ hash, mimeType, cached: false });
});

// ---------------------------------------------------------------------------
// GET /v1/tts/:hash
// Returns the raw audio blob stored in R2, searching both providers.
// ---------------------------------------------------------------------------
app.get('/v1/tts/:hash', async (c) => {
	const hash = c.req.param('hash');

	// Validate hash format: exactly 16 lowercase hex characters
	if (!/^[0-9a-f]{16}$/.test(hash)) {
		return c.json<ProxyError>({ error: 'Invalid hash format', code: 'invalid_request' }, 400);
	}

	// Try both provider buckets in a single pass
	const candidates: Array<{ key: string; mimeType: string }> = [
		{ key: `tts/elevenlabs/${hash}.mp3`, mimeType: 'audio/mpeg' },
		{ key: `tts/gemini/${hash}.wav`, mimeType: 'audio/wav' }
	];

	for (const { key, mimeType } of candidates) {
		const obj = await c.env.AUDIO_CACHE.get(key);
		if (obj !== null) {
			return new Response(obj.body, {
				status: 200,
				headers: {
					'Content-Type': mimeType,
					'Cache-Control': 'public, max-age=31536000, immutable',
					'Access-Control-Allow-Origin': '*'
				}
			});
		}
	}

	return c.json<ProxyError>({ error: 'Audio not found', code: 'not_found' }, 404);
});

// ---------------------------------------------------------------------------
// GET /v1/models/elevenlabs
// ---------------------------------------------------------------------------
app.get('/v1/models/elevenlabs', async (c) => {
	try {
		const res = await fetch('https://api.elevenlabs.io/v1/models', {
			headers: { 'xi-api-key': c.env.ELEVENLABS_API_KEY }
		});
		if (!res.ok) {
			return c.json<ProxyError>({ error: 'Failed to fetch models from ElevenLabs', code: 'origin_failed' }, 502);
		}
		const data = (await res.json()) as Array<{
			model_id?: string;
			name?: string;
			description?: string;
			can_do_text_to_speech?: boolean;
		}>;
		const models = data
			.filter((m) => m.model_id && m.can_do_text_to_speech !== false)
			.map((m) => ({ id: m.model_id!, label: m.name ?? m.model_id!, description: m.description }));
		return c.json({ models });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return c.json<ProxyError>({ error: message, code: 'internal' }, 500);
	}
});

// ---------------------------------------------------------------------------
// GET /v1/models/gemini
// ---------------------------------------------------------------------------
app.get('/v1/models/gemini', async (c) => {
	try {
		const res = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models?key=${c.env.GEMINI_API_KEY}`
		);
		if (!res.ok) {
			return c.json<ProxyError>({ error: 'Failed to fetch models from Gemini', code: 'origin_failed' }, 502);
		}
		const data = (await res.json()) as {
			models?: Array<{ name: string; displayName?: string; description?: string }>;
		};
		const models = (data.models ?? [])
			.filter((m) => {
				const id = m.name.replace('models/', '').toLowerCase();
				const label = (m.displayName ?? '').toLowerCase();
				return id.includes('-tts') || label.includes('tts');
			})
			.map((m) => ({
				id: m.name.replace('models/', ''),
				label: m.displayName ?? m.name.replace('models/', ''),
				description: m.description
			}));
		return c.json({ models });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return c.json<ProxyError>({ error: message, code: 'internal' }, 500);
	}
});

// ---------------------------------------------------------------------------
// GET /v1/voices/elevenlabs
// Proxies the ElevenLabs voices list using the server-side API key.
// ---------------------------------------------------------------------------
app.get('/v1/voices/elevenlabs', async (c) => {
	try {
		const res = await fetch('https://api.elevenlabs.io/v1/voices', {
			headers: { 'xi-api-key': c.env.ELEVENLABS_API_KEY }
		});
		if (!res.ok) {
			return c.json<ProxyError>({ error: 'Failed to fetch voices from ElevenLabs', code: 'origin_failed' }, 502);
		}
		const data = (await res.json()) as { voices: { voice_id: string; name: string }[] };
		return c.json({ voices: data.voices.map((v) => ({ id: v.voice_id, name: v.name })) });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return c.json<ProxyError>({ error: message, code: 'internal' }, 500);
	}
});

// ---------------------------------------------------------------------------
// GET /v1/voices/gemini
// Returns the hardcoded list of Gemini prebuilt voices.
// ---------------------------------------------------------------------------
app.get('/v1/voices/gemini', (c) => {
	return c.json({
		voices: [
			{ id: 'Zephyr', name: 'Zephyr (בהיר)' },
			{ id: 'Puck', name: 'Puck (מרקדן)' },
			{ id: 'Charon', name: 'Charon (אינפורמטיבי)' },
			{ id: 'Kore', name: 'Kore (נחוש)' },
			{ id: 'Fenrir', name: 'Fenrir (נרגש)' },
			{ id: 'Leda', name: 'Leda (צעיר)' },
			{ id: 'Orus', name: 'Orus (יציב)' },
			{ id: 'Aoede', name: 'Aoede (קליל)' },
			{ id: 'Callirrhoe', name: 'Callirrhoe (רגוע)' },
			{ id: 'Autonoe', name: 'Autonoe (בהיר)' }
		]
	});
});

// ---------------------------------------------------------------------------
// GET /v1/img/pcs/:id
// Serves one PCS symbol from the private R2 bucket.
//
// PCS is licensed Mayer-Johnson content. The bucket is private and this is the
// only way bytes leave it, so the gate below is the whole protection.
// ---------------------------------------------------------------------------

/**
 * Authorization gate for the licensed-image routes.
 *
 * Returns a Response to send back when access is denied, or `null` to proceed.
 * Every path that is not an explicit allow ends in a denial — an unset
 * PCS_AUTH_MODE denies, so a deploy that forgets to configure it is safe.
 */
function denyImageAccess(c: Context<{ Bindings: Env }>): Response | null {
	const mode = c.env.PCS_AUTH_MODE;

	if (mode === 'dev-open') return null;

	// Cloudflare Access puts a signed JWT on every request that passed its
	// policy. Checking that the header merely *exists* is not verification —
	// anyone can send a header — so until the signature check lands we refuse
	// rather than pretend. Better a broken image than a false sense of a gate.
	if (mode === 'access-jwt') {
		return c.json<ProxyError>(
			{ error: 'Access JWT verification is not implemented yet', code: 'internal' },
			503
		);
	}

	return c.json<ProxyError>({ error: 'Forbidden', code: 'unauthorized' }, 403);
}

app.get('/v1/img/pcs/:id', async (c) => {
	const denied = denyImageAccess(c);
	if (denied) return denied;

	const id = c.req.param('id');

	// Keys are the numeric PCS id zero-padded to 5 digits. Anchoring the
	// pattern also rules out traversal and any other key shape.
	if (!/^[0-9]{5}$/.test(id)) {
		return c.json<ProxyError>({ error: 'Invalid PCS id', code: 'invalid_request' }, 400);
	}

	const obj = await c.env.PCS_ASSETS.get(`img/pcs/${id}.png`);
	if (obj === null) {
		return c.json<ProxyError>({ error: 'Symbol not found', code: 'not_found' }, 404);
	}

	return new Response(obj.body, {
		status: 200,
		headers: {
			'Content-Type': 'image/png',
			// `private` on purpose: licensed content must not be stored by any
			// shared cache between us and the authenticated browser.
			'Cache-Control': 'private, max-age=31536000, immutable'
		}
	});
});

// ---------------------------------------------------------------------------
// Catch-all 404
// ---------------------------------------------------------------------------
app.notFound((c) =>
	c.json<ProxyError>({ error: `Route not found: ${c.req.path}`, code: 'not_found' }, 404)
);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.onError((err, c) => {
	console.error('[aac-proxy] unhandled error:', err);
	return c.json<ProxyError>(
		{ error: err.message ?? 'Internal server error', code: 'internal' },
		500
	);
});

export default app;
