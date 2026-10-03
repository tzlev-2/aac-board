/**
 * Public TTS API — routes to the currently selected provider.
 *
 * Providers: webspeech (default), elevenlabs, gemini.
 * Settings stored in localStorage under `tts-settings`.
 *
 * For ElevenLabs and Gemini, audio is synthesized via the proxy and cached in
 * IndexedDB (L1). WebSpeech continues to use the browser's built-in TTS.
 */

import { getProvider, webSpeechProvider } from './tts-providers';
import { getDefaultModelForProvider } from './tts-providers/provider-models';
import { getOrCreateAudio } from './cache/audio-cache';
import { playAudioBlob } from './tts-providers/audio-playback';
import { createStore } from 'idb-keyval';
import type { TtsProviderId, TtsVoice } from './tts-providers';
import type { TtsModelOption } from './tts-providers/types';

type IdbStore = ReturnType<typeof createStore>;

export interface TtsSettings {
	/** Active provider */
	provider: TtsProviderId;
	/** Optional model identifier for providers that expose multiple TTS models */
	modelId: string;
	/** Voice ID within the active provider (format depends on provider) */
	voiceURI: string;
	rate: number;
	pitch: number;
}

const TTS_SETTINGS_KEY = 'tts-settings';

const DEFAULT_SETTINGS: TtsSettings = {
	provider: 'webspeech',
	modelId: '',
	voiceURI: '',
	rate: 0.9,
	pitch: 1
};

/** Read TTS settings from localStorage */
export function getTtsSettings(): TtsSettings {
	try {
		const raw = localStorage.getItem(TTS_SETTINGS_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as Partial<TtsSettings>;
			return { ...DEFAULT_SETTINGS, ...parsed };
		}
	} catch {
		/* empty */
	}
	return { ...DEFAULT_SETTINGS };
}

/** Get available TTS models for a provider. */
export async function getModelsForProvider(providerId: TtsProviderId): Promise<TtsModelOption[]> {
	const provider = getProvider(providerId);
	return provider.getModels?.() ?? [];
}

/** Save TTS settings to localStorage */
export function saveTtsSettings(settings: TtsSettings): void {
	try {
		localStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(settings));
	} catch {
		/* private browsing */
	}
}

/** Get Hebrew voices from the Web Speech API (legacy — used by settings UI directly). */
export function getHebrewVoices(): SpeechSynthesisVoice[] {
	if (!('speechSynthesis' in globalThis)) return [];
	return speechSynthesis.getVoices().filter((v) => v.lang.startsWith('he'));
}

/** Get voices for the currently-selected provider (or for a specific one). */
export async function getVoicesForProvider(
	providerId: TtsProviderId,
	lang = 'he'
): Promise<TtsVoice[]> {
	const provider = getProvider(providerId);
	return provider.getVoices(lang);
}

/** Providers that route through the proxy+cache instead of calling APIs directly. */
const PROXIED_PROVIDERS = new Set<TtsProviderId>(['elevenlabs', 'gemini']);

/** Optional dependency overrides for `speak()` — used in tests. */
export interface SpeakDeps {
	/** Override the TTS settings (default: read from localStorage). */
	settings?: TtsSettings;
	/** Cancels speech owned by a detached board attachment. */
	signal?: AbortSignal;
	/** Override the fetch function (default: globalThis.fetch). */
	fetchFn?: typeof globalThis.fetch;
	/** Override the proxy base URL (default: import.meta.env.VITE_PROXY_URL). */
	proxyUrl?: string;
	/** Override the IDB store used for the audio cache (default: global aac-cache). */
	store?: IdbStore;
}

/** Speak a single text string using the active provider, falling back to Web Speech on error. */
export async function speak(text: string, lang = 'he-IL', deps?: SpeakDeps): Promise<void> {
	if (deps?.signal?.aborted) return;
	const settings = deps?.settings ?? getTtsSettings();
	const provider = getProvider(settings.provider);

	// Proxied providers (elevenlabs, gemini) go through the audio cache
	if (PROXIED_PROVIDERS.has(settings.provider)) {
		const modelId = settings.modelId || getDefaultModelForProvider(settings.provider);
		const req = {
			text,
			provider: settings.provider as 'elevenlabs' | 'gemini',
			voiceId: settings.voiceURI || 'default',
			modelId: modelId || 'default',
			lang
		};
		try {
			const blob = await getOrCreateAudio(req, {
				fetch: deps?.fetchFn,
				proxyUrl: deps?.proxyUrl,
				store: deps?.store
			});
			if (deps?.signal?.aborted) return;
			await playAudioBlob(blob, {
				rate: settings.rate,
				pitch: settings.pitch,
				lang,
				signal: deps?.signal
			});
			return;
		} catch (e) {
			if (deps?.signal?.aborted) return;
			console.warn(
				`[tts] proxy cache for "${settings.provider}" failed — falling back to webspeech`,
				e
			);
		}
		// Fallback to Web Speech on proxy failure
		if (!deps?.signal?.aborted && webSpeechProvider.isAvailable()) {
			await webSpeechProvider.speak(text, {
				rate: settings.rate,
				pitch: settings.pitch,
				lang,
				signal: deps?.signal
			});
		}
		return;
	}

	// Non-proxied provider (webspeech) — use original path
	if (provider.isAvailable()) {
		try {
			const modelId = settings.modelId || getDefaultModelForProvider(settings.provider);
			await provider.speak(text, {
				voiceId: settings.voiceURI || undefined,
				modelId: modelId || undefined,
				rate: settings.rate,
				pitch: settings.pitch,
				lang,
				signal: deps?.signal
			});
			return;
		} catch (e) {
			if (deps?.signal?.aborted) return;
			console.warn(`[tts] provider "${settings.provider}" failed — falling back to webspeech`, e);
		}
	}

	// Fallback to Web Speech
	if (
		!deps?.signal?.aborted &&
		settings.provider !== 'webspeech' &&
		webSpeechProvider.isAvailable()
	) {
		await webSpeechProvider.speak(text, {
			rate: settings.rate,
			pitch: settings.pitch,
			lang,
			signal: deps?.signal
		});
	}
}

/** Speak an array of labels joined as a single sentence. */
export async function speakAll(labels: string[], lang = 'he-IL'): Promise<void> {
	const sentence = labels.join(' ');
	await speak(sentence, lang);
}

/** Stop any ongoing speech across all providers. */
export function stopSpeaking(): void {
	for (const id of ['webspeech', 'elevenlabs', 'gemini'] as TtsProviderId[]) {
		try {
			getProvider(id).stop();
		} catch {
			/* ignore */
		}
	}
}
