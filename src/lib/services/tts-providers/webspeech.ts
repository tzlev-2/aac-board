import type { SpeakOptions, TtsProvider, TtsVoice } from './types';

let currentUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Web Speech API provider — uses the browser's built-in speechSynthesis.
 * Always available (fallback provider).
 */
export const webSpeechProvider: TtsProvider = {
	id: 'webspeech',
	displayName: 'Web Speech (דפדפן)',

	isAvailable() {
		return typeof window !== 'undefined' && 'speechSynthesis' in window;
	},

	async getVoices(lang?: string): Promise<TtsVoice[]> {
		if (!this.isAvailable()) return [];
		const sysVoices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
			const existing = window.speechSynthesis.getVoices();
			if (existing.length > 0) {
				resolve(existing);
				return;
			}
			const handler = () => {
				window.speechSynthesis.removeEventListener('voiceschanged', handler);
				resolve(window.speechSynthesis.getVoices());
			};
			window.speechSynthesis.addEventListener('voiceschanged', handler);
			// Fallback timeout — on some browsers the event never fires
			setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
		});
		const filtered = lang
			? sysVoices.filter((v) => v.lang.startsWith(lang.slice(0, 2)))
			: sysVoices;
		return filtered.map((v) => ({ id: v.voiceURI, name: v.name, lang: v.lang }));
	},

	async speak(text: string, opts: SpeakOptions): Promise<void> {
		if (!this.isAvailable() || opts.signal?.aborted) return;
		window.speechSynthesis.cancel();
		return new Promise<void>((resolve) => {
			const utterance = new SpeechSynthesisUtterance(text);
			utterance.lang = opts.lang ?? 'he-IL';
			utterance.rate = opts.rate ?? 0.9;
			utterance.pitch = opts.pitch ?? 1;
			const voices = window.speechSynthesis.getVoices();
			const preferred = opts.voiceId ? voices.find((v) => v.voiceURI === opts.voiceId) : null;
			utterance.voice = preferred ?? voices.find((v) => v.lang.startsWith('he')) ?? null;
			currentUtterance = utterance;
			const abort = () => {
				if (currentUtterance === utterance) window.speechSynthesis.cancel();
				cleanup();
			};
			const cleanup = () => {
				opts.signal?.removeEventListener('abort', abort);
				if (currentUtterance === utterance) currentUtterance = null;
				resolve();
			};
			utterance.onend = cleanup;
			utterance.onerror = cleanup;
			opts.signal?.addEventListener('abort', abort, { once: true });
			window.speechSynthesis.speak(utterance);
		});
	},

	stop() {
		if (this.isAvailable()) window.speechSynthesis.cancel();
	}
};
