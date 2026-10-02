<script lang="ts">
	import { onMount } from 'svelte';
	import { messages } from './settings-messages';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { speak, getModelsForProvider, getVoicesForProvider } from '$lib/services/tts';
	import {
		getDefaultModelForProvider,
		type TtsModelOption,
		type TtsProviderId,
		type TtsVoice
	} from '$lib/services/tts-providers';
	import {
		ARASAAC_LICENSE_URL,
		ARASAAC_SITE_URL,
		ARASAAC_TERMS_URL,
		ATTRIBUTION_FIELDS,
		ATTRIBUTION_SENTENCE_EN,
		ATTRIBUTION_SENTENCE_HE
	} from '$lib/attribution';

	const sStore = settingsStore();

	let availableVoices = $state<TtsVoice[]>([]);
	let loadingVoices = $state(false);
	let availableModels = $state<TtsModelOption[]>([]);
	let loadingModels = $state(false);

	onMount(async () => {
		await sStore.init();
		await refreshModels();
		await refreshVoices();
	});

	async function refreshModels() {
		loadingModels = true;
		try {
			availableModels = await getModelsForProvider(sStore.settings.ttsProvider);
		} catch (e) {
			console.warn('[settings] refreshModels failed', e);
			availableModels = [];
		}
		loadingModels = false;
	}

	async function refreshVoices() {
		loadingVoices = true;
		try {
			availableVoices = await getVoicesForProvider(sStore.settings.ttsProvider, 'he');
		} catch (e) {
			console.warn('[settings] refreshVoices failed', e);
			availableVoices = [];
		}
		loadingVoices = false;
	}

	async function handleProviderChange(provider: TtsProviderId) {
		sStore.update({
			ttsProvider: provider,
			ttsModel: getDefaultModelForProvider(provider),
			ttsVoice: ''
		});
		await refreshModels();
		await refreshVoices();
	}

	function handleModelChange(modelId: string) {
		sStore.update({ ttsModel: modelId, ttsVoice: '' });
		refreshVoices();
	}

	function previewVoice() {
		speak(messages.previewText);
	}

	const providers: { id: TtsProviderId; label: string }[] = [
		{ id: 'webspeech', label: messages.browser },
		{ id: 'elevenlabs', label: 'ElevenLabs' },
		{ id: 'gemini', label: 'Gemini' }
	];
</script>

<svelte:head>
	<title>{messages.title}</title>
</svelte:head>

<div class="settings-page">
	<header class="settings-header">
		<a href="/" class="back-btn" aria-label={messages.back}>
			<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
				<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
			</svg>
		</a>
		<h1>{messages.heading}</h1>
	</header>

	<div class="settings-content">
		<section class="card">
			<h2 class="card-title">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
					/>
				</svg>
				{messages.voiceHeading}
			</h2>

			<div class="field">
				<span class="field-label">{messages.provider}</span>
				<div class="toggle-group">
					{#each providers as p (p.id)}
						<button
							class="toggle-btn"
							class:active={sStore.settings.ttsProvider === p.id}
							onclick={() => handleProviderChange(p.id)}
						>
							{p.label}
						</button>
					{/each}
				</div>
			</div>

			{#if availableModels.length > 0 || sStore.settings.ttsModel}
				<label class="field">
					<span class="field-label">{messages.model}</span>
					<select
						class="field-input"
						value={sStore.settings.ttsModel}
						onchange={(e) => handleModelChange((e.target as HTMLSelectElement).value)}
						disabled={loadingModels}
					>
						{#if sStore.settings.ttsModel && !availableModels.some((model) => model.id === sStore.settings.ttsModel)}
							<option value={sStore.settings.ttsModel}>{sStore.settings.ttsModel}</option>
						{/if}
						{#each availableModels as model (model.id)}
							<option value={model.id}>{model.label}</option>
						{/each}
					</select>
					{#if loadingModels}
						<span class="field-hint">{messages.loadingModels}</span>
					{:else if availableModels.find((model) => model.id === sStore.settings.ttsModel)?.description}
						<span class="field-hint">
							{availableModels.find((model) => model.id === sStore.settings.ttsModel)?.description}
						</span>
					{/if}
				</label>
			{/if}

			<label class="field">
				<span class="field-label">{messages.voice}</span>
				<select
					class="field-input"
					value={sStore.settings.ttsVoice}
					onchange={(e) => sStore.update({ ttsVoice: (e.target as HTMLSelectElement).value })}
					disabled={loadingVoices}
				>
					<option value="">{messages.defaultVoice}</option>
					{#if sStore.settings.ttsVoice && !availableVoices.some((voice) => voice.id === sStore.settings.ttsVoice)}
						<option value={sStore.settings.ttsVoice}>{sStore.settings.ttsVoice}</option>
					{/if}
					{#each availableVoices as voice (voice.id)}
						<option value={voice.id}>{voice.name}</option>
					{/each}
				</select>
				{#if loadingVoices}
					<span class="field-hint">{messages.loadingVoices}</span>
				{:else if availableVoices.length === 0 && sStore.settings.ttsProvider !== 'webspeech'}
					<span class="field-hint">{messages.noVoices}</span>
				{/if}
			</label>

			<label class="field">
				<span class="field-label">{messages.rate} {sStore.settings.ttsRate.toFixed(1)}</span>
				<input
					type="range"
					min="0.5"
					max="2"
					step="0.1"
					value={sStore.settings.ttsRate}
					oninput={(e) =>
						sStore.update({ ttsRate: parseFloat((e.target as HTMLInputElement).value) })}
				/>
			</label>

			<label class="field">
				<span class="field-label">{messages.pitch} {sStore.settings.ttsPitch.toFixed(1)}</span>
				<input
					type="range"
					min="0.5"
					max="2"
					step="0.1"
					value={sStore.settings.ttsPitch}
					oninput={(e) =>
						sStore.update({ ttsPitch: parseFloat((e.target as HTMLInputElement).value) })}
				/>
			</label>

			<button class="btn btn-preview" onclick={previewVoice}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<path d="M8 5v14l11-7z" />
				</svg>
				{messages.preview}
			</button>
		</section>

		<section class="card">
			<h2 class="card-title">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12z"
					/>
				</svg>
				{messages.display}
			</h2>

			<div class="field">
				<span class="field-label">{messages.theme}</span>
				<div class="toggle-group">
					<button
						class="toggle-btn"
						class:active={sStore.settings.theme === 'light'}
						onclick={() => sStore.update({ theme: 'light' })}
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
							<path
								d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"
							/>
						</svg>
						{messages.light}
					</button>
					<button
						class="toggle-btn"
						class:active={sStore.settings.theme === 'dark'}
						onclick={() => sStore.update({ theme: 'dark' })}
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
							<path
								d="M10 2c-1.82 0-3.53.5-5 1.35C7.99 5.08 10 8.3 10 12s-2.01 6.92-5 8.65C6.47 21.5 8.18 22 10 22c5.52 0 10-4.48 10-10S15.52 2 10 2z"
							/>
						</svg>
						{messages.dark}
					</button>
				</div>
			</div>
		</section>

		<section class="card" data-testid="attribution">
			<h2 class="card-title">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
					/>
				</svg>
				{messages.attribution}
			</h2>

			<p class="legal" dir="rtl">{ATTRIBUTION_SENTENCE_HE}</p>

			<p class="legal legal-en" dir="ltr">{ATTRIBUTION_SENTENCE_EN}</p>

			<dl class="attribution-fields">
				{#each ATTRIBUTION_FIELDS as field (field.label)}
					<dt>{field.label}</dt>
					<dd dir="ltr">{field.value}</dd>
				{/each}
			</dl>

			<p class="legal legal-links">
				<a href={ARASAAC_SITE_URL} target="_blank" rel="noopener noreferrer">arasaac.org</a>
				·
				<a href={ARASAAC_TERMS_URL} target="_blank" rel="noopener noreferrer">{messages.terms}</a>
				·
				<a href={ARASAAC_LICENSE_URL} target="_blank" rel="noopener noreferrer"
					>{messages.license}</a
				>
			</p>
		</section>
	</div>
</div>

<style>
	.settings-page {
		height: 100dvh;
		min-height: 100dvh;
		overflow-y: auto;
		overflow-x: hidden;
		background: var(--bg-app, #f0f4f8);
		direction: rtl;
		overscroll-behavior: contain;
	}

	.settings-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 20px;
		background: var(--bg-card, white);
		border-bottom: 1px solid var(--border-color, #e0e0e0);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.settings-header h1 {
		margin: 0;
		font-size: 20px;
		font-weight: 700;
		color: var(--text-primary, #212121);
	}

	.back-btn {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--bg-card-alt, #f5f5f5);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-primary, #212121);
		text-decoration: none;
		transition: background 0.15s;
	}

	.back-btn:hover {
		background: var(--border-color, #e0e0e0);
	}

	.settings-content {
		max-width: 520px;
		margin: 0 auto;
		padding: 16px 16px calc(24px + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.card {
		background: var(--bg-card, white);
		border-radius: 16px;
		padding: 20px;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.06);
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.card-title {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: 16px;
		font-weight: 700;
		color: var(--text-primary, #212121);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary, #616161);
	}

	.field-hint {
		font-size: 12px;
		color: var(--text-secondary, #9e9e9e);
		margin-top: 2px;
	}

	.field-input {
		padding: 8px 12px;
		border: 1.5px solid var(--border-color, #e0e0e0);
		border-radius: 8px;
		font-size: 15px;
		outline: none;
		background: var(--bg-card, white);
		color: var(--text-primary, #212121);
		transition: border-color 0.15s;
	}

	.field-input:focus {
		border-color: var(--primary, #1976d2);
	}

	input[type='range'] {
		width: 100%;
		accent-color: var(--primary, #1976d2);
	}

	.toggle-group {
		display: flex;
		gap: 6px;
	}

	.toggle-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 12px;
		border: 1.5px solid var(--border-color, #e0e0e0);
		border-radius: 8px;
		background: var(--bg-card, white);
		color: var(--text-secondary, #616161);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s;
	}

	.toggle-btn:hover {
		background: var(--bg-card-alt, #f5f5f5);
	}

	.toggle-btn.active {
		background: var(--primary-light, #e3f2fd);
		border-color: var(--primary, #1976d2);
		color: var(--primary, #1976d2);
	}

	.btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px 16px;
		border: none;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
		transition:
			background 0.15s,
			transform 0.1s;
	}

	.btn:active {
		transform: scale(0.97);
	}

	.btn-preview {
		align-self: flex-start;
		background: var(--primary-light, #e3f2fd);
		color: var(--primary, #1976d2);
	}

	.btn-preview:hover {
		background: #bbdefb;
	}

	.legal {
		margin: 0;
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-secondary, #616161);
	}

	.legal-en {
		font-style: italic;
	}

	.legal-links {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.legal a {
		color: var(--primary, #1976d2);
	}

	.attribution-fields {
		display: grid;
		/* תווית צרה + ערך שממלא — ‏auto/1fr, ולא רוחב קבוע שיישבר בתרגום. */
		grid-template-columns: auto 1fr;
		gap: 2px 10px;
		margin: 0;
		font-size: 12px;
	}

	.attribution-fields dt {
		font-weight: 600;
		color: var(--text-secondary, #616161);
	}

	.attribution-fields dd {
		margin: 0;
		/* 🛑 לוגי ולא `text-align: left` — הדף כולו RTL והערכים הם LTR. */
		text-align: start;
		color: var(--text-primary, #212121);
	}
</style>
