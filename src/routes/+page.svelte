<script lang="ts">
	import { applicationSession } from '$lib/gridset/application-session.svelte';
	import { messages } from './grid/editor-messages';
	const session = applicationSession();
	async function files(input: HTMLInputElement) {
		const file = input.files?.[0];
		input.value = '';
		if (file && !session.busy) await session.importFile(file);
	}
	async function drop(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files?.[0];
		if (file && !session.busy) await session.importFile(file);
	}
</script>

<svelte:head><title>{messages.selectorTitle}</title></svelte:head>
<main dir="rtl" aria-busy={session.busy}>
	<h1 tabindex="-1">{messages.selector}</h1>
	<a href="/settings">{messages.settings}</a>
	{#if session.active}<button type="button" disabled={session.busy} onclick={() => session.resume()}
			>{messages.resume} · {session.active.label}</button
		>{/if}
	<section aria-labelledby="sample-heading">
		<h2 id="sample-heading">{messages.licensedSamples}</h2>
		<div class="catalog">
			{#each session.samples as application (application.id)}<button
					type="button"
					disabled={session.busy}
					onclick={() => session.selectApplication(application)}>{application.label}</button
				>{/each}
		</div>
	</section>
	<section
		class="dropzone"
		aria-label={messages.load}
		ondragover={(e) => e.preventDefault()}
		ondrop={drop}
	>
		<label
			>{messages.load}<input
				type="file"
				aria-label={messages.load}
				accept=".gridset,.json,application/json"
				disabled={session.busy}
				onchange={(e) => files(e.currentTarget)}
			/></label
		>
	</section>
	{#if session.imports.length}<section aria-labelledby="import-heading">
			<h2 id="import-heading">{messages.imports}</h2>
			<div class="catalog">
				{#each session.imports as application (application.id)}<button
						type="button"
						disabled={session.busy}
						onclick={() => session.selectApplication(application)}>{application.label}</button
					>{/each}
			</div>
		</section>{/if}
	{#if session.editor.loading}<p role="status" data-testid="grid-loading">
			{messages.loading}
		</p>{/if}
</main>

<style>
	main {
		max-inline-size: 900px;
		margin-inline: auto;
		padding: 20px;
		box-sizing: border-box;
	}
	h1 {
		font-size: 1.6rem;
	}
	h2 {
		font-size: 1.15rem;
	}
	.catalog {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
		gap: 12px;
	}
	button,
	input,
	a {
		font: inherit;
		min-block-size: 44px;
		box-sizing: border-box;
		max-inline-size: 100%;
	}
	button {
		padding: 12px;
		border: 1px solid #9bb;
		border-radius: 8px;
		background: #eef6f8;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	a {
		display: inline-flex;
		align-items: center;
		padding: 8px;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.dropzone {
		margin-block: 20px;
		border: 2px dashed #999;
		padding: 16px;
		border-radius: 8px;
	}
	:is(button, a, input):focus-visible {
		outline: 3px solid #075dcc;
		outline-offset: 2px;
	}
</style>
