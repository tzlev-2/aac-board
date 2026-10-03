import type { SpeakOptions } from './types';
let currentAudio: HTMLAudioElement | null = null;
let currentCleanup: (() => void) | null = null;
export function stopCurrentAudio(): void {
	currentAudio?.pause();
	currentCleanup?.();
}
export async function playAudioBlob(blob: Blob, opts: SpeakOptions): Promise<void> {
	if (opts.signal?.aborted) return;
	stopCurrentAudio();
	const url = URL.createObjectURL(blob);
	const audio = new Audio(url);
	audio.playbackRate = opts.rate ?? 1;
	currentAudio = audio;
	return new Promise<void>((resolve) => {
		let cleaned = false;
		const abort = () => {
			audio.pause();
			cleanup();
		};
		const cleanup = () => {
			if (cleaned) return;
			cleaned = true;
			opts.signal?.removeEventListener('abort', abort);
			audio.onended = null;
			audio.onerror = null;
			URL.revokeObjectURL(url);
			if (currentAudio === audio) {
				currentAudio = null;
				currentCleanup = null;
			}
			resolve();
		};
		currentCleanup = cleanup;
		audio.onended = cleanup;
		audio.onerror = cleanup;
		opts.signal?.addEventListener('abort', abort, { once: true });
		audio.play().catch(cleanup);
	});
}
