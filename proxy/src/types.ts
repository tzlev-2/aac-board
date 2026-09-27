/** Cloudflare Worker environment bindings for aac-proxy. */
export interface Env {
	AUDIO_CACHE: R2Bucket;
	/** PCS symbol library (licensed). Private bucket, org account. */
	PCS_ASSETS: R2Bucket;
	ELEVENLABS_API_KEY: string;
	GEMINI_API_KEY: string;
	/**
	 * Gate for the licensed-image routes. FAILS CLOSED: any value other than
	 * the two below — including unset — makes `/v1/img/**` return 403.
	 *
	 * - `dev-open`   local development only. Never set this on a deployment.
	 * - `access-jwt` require a verified Cloudflare Access JWT.
	 *
	 * Rationale: an accidental `wrangler deploy` must not expose PCS. The
	 * default of "no variable" is the safe one, so forgetting is safe.
	 */
	PCS_AUTH_MODE?: string;
}

/** TTS providers supported by the proxy. */
export type TtsProviderId = 'elevenlabs' | 'gemini';

export interface TtsRequest {
	text: string;
	provider: TtsProviderId;
	voiceId: string;
	modelId: string;
	lang?: string;
}

export interface TtsResponse {
	/** 16 hex chars. Deterministic on TtsRequest fields. */
	hash: string;
	mimeType: 'audio/wav' | 'audio/mpeg';
	/** Whether the response was served from R2 cache. */
	cached: boolean;
}

export interface ProxyError {
	error: string;
	code: 'origin_failed' | 'invalid_request' | 'unauthorized' | 'not_found' | 'internal';
}
