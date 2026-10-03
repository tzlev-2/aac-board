<script lang="ts">
	import { messages } from './editor-messages';
	let {
		kind,
		invalid = false,
		busy = false,
		error = '',
		onChoice
	}: {
		kind: 'draft' | 'load';
		invalid?: boolean;
		busy?: boolean;
		error?: string;
		onChoice: (choice: 'apply' | 'cancel' | 'stay' | 'save') => void;
	} = $props();
	function modal(dialog: HTMLDialogElement) {
		const invoker = document.activeElement;
		dialog.showModal();
		return () => {
			dialog.close();
			requestAnimationFrame(() => {
				if (
					invoker instanceof HTMLElement &&
					invoker !== document.body &&
					invoker.isConnected &&
					!invoker.matches(':disabled, [inert]')
				)
					invoker.focus();
				else document.querySelector<HTMLElement>('h1')?.focus();
			});
		};
	}
</script>

<dialog
	{@attach modal}
	aria-label={kind === 'draft' ? messages.draftDecision : messages.loadDecision}
	oncancel={(e) => {
		e.preventDefault();
		if (!busy) onChoice('stay');
	}}
>
	<p>{kind === 'draft' ? messages.draftDecision : messages.loadDecision}</p>
	{#if error}<p role="alert">{error}</p>{/if}
	{#if busy}<p role="status">{messages.saving}</p>{/if}
	{#if kind === 'draft'}
		<button type="button" disabled={invalid || busy} onclick={() => onChoice('apply')}
			>{messages.apply}</button
		>
		<button type="button" disabled={busy} onclick={() => onChoice('cancel')}
			>{messages.cancel}</button
		>
	{:else}<button type="button" disabled={busy} onclick={() => onChoice('cancel')}
			>{messages.discardLoad}</button
		><button type="button" disabled={invalid || busy} onclick={() => onChoice('save')}
			>{messages.saveContinue}</button
		>{/if}
	<button type="button" disabled={busy} onclick={() => onChoice('stay')}>{messages.stay}</button>
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
