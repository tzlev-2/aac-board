<script lang="ts">
	import { messages } from './editor-messages';
	let {
		kind,
		invalid = false,
		onChoice
	}: {
		kind: 'draft' | 'load';
		invalid?: boolean;
		onChoice: (choice: 'apply' | 'cancel' | 'stay') => void;
	} = $props();
	function modal(dialog: HTMLDialogElement) {
		dialog.showModal();
		return () => dialog.close();
	}
</script>

<dialog
	{@attach modal}
	aria-label={kind === 'draft' ? messages.draftDecision : messages.loadDecision}
	oncancel={(e) => {
		e.preventDefault();
		onChoice('stay');
	}}
>
	<p>{kind === 'draft' ? messages.draftDecision : messages.loadDecision}</p>
	{#if kind === 'draft'}
		<button type="button" disabled={invalid} onclick={() => onChoice('apply')}
			>{messages.apply}</button
		>
		<button type="button" onclick={() => onChoice('cancel')}>{messages.cancel}</button>
	{:else}<button type="button" onclick={() => onChoice('cancel')}>{messages.discardLoad}</button
		>{/if}
	<button type="button" onclick={() => onChoice('stay')}>{messages.stay}</button>
</dialog>

<style>
	dialog {
		border: 1px solid #9bb;
		border-radius: 8px;
		padding: 20px;
		max-inline-size: 90%;
	}
	dialog::backdrop {
		background: #0008;
	}
	button {
		min-block-size: 44px;
		padding-inline: 10px;
		margin-inline-end: 8px;
		cursor: pointer;
		font: inherit;
	}
	button:focus-visible {
		outline: 3px solid #075dcc;
		outline-offset: 2px;
	}
</style>
