<script lang="ts">
	import { tick } from 'svelte';
	import GridSetView from '$lib/components/gridset/GridSetView.svelte';
	import GridSetCellEditor from '../../../routes/grid/GridSetCellEditor.svelte';
	import { applicationSession } from '$lib/gridset/application-session.svelte';
	import { messages } from '../../../routes/grid/editor-messages';
	const session = applicationSession();
	const editor = session.editor;
	const pages = $derived(Object.keys(editor.gridSet.pages));
	async function goBack(event: MouseEvent) {
		const button = event.currentTarget as HTMLButtonElement;
		const focused = document.activeElement === button;
		const heading = button.closest('.grid-page')?.querySelector<HTMLElement>('h1');
		editor.back();
		await tick();
		if (focused && !button.isConnected && document.activeElement === document.body)
			heading?.focus();
	}
</script>

<svelte:head><title>{session.active?.label} — Grid AAC Clone</title></svelte:head>

<div class={['grid-page', editor.editing && 'editing']} dir="rtl">
	<header>
		<h1 data-testid="grid-source" tabindex="-1">{session.active?.label}</h1>
		<a href="/">{messages.selector}</a>
	</header>
	<div class="toolbar">
		<a href="/settings" class="settings-link">{messages.settings}</a>
		<button
			type="button"
			aria-pressed={!editor.editing}
			disabled={editor.busy}
			onclick={() => editor.mode(false)}>{messages.use}</button
		>
		<button
			type="button"
			aria-pressed={editor.editing}
			disabled={!editor.source || editor.busy}
			onclick={() => editor.mode(true)}>{messages.edit}</button
		>
		{#if editor.canGoBack}
			<button type="button" disabled={editor.busy || Boolean(editor.pending)} onclick={goBack}
				>{messages.back}</button
			>
		{/if}
		{#if editor.editing}
			<label
				>{messages.page}<select
					aria-label={messages.page}
					disabled={editor.busy || !editor.runtime}
					value={editor.runtime?.pageName ?? editor.gridSet.startGrid}
					onchange={(e) => {
						editor.navigate(e.currentTarget.value);
						e.currentTarget.value = editor.runtime?.pageName ?? editor.gridSet.startGrid;
					}}
				>
					{#each pages as name (name)}<option value={name}>{name}</option>{/each}
				</select></label
			>
		{/if}
		<span data-testid="grid-dirty">{editor.dirty ? messages.dirty : messages.clean}</span>
		<button
			type="button"
			disabled={!editor.source ||
				editor.busy ||
				Boolean(editor.draftError) ||
				Boolean(editor.pending)}
			onclick={editor.saveCopy}>{editor.saving ? messages.saving : messages.save}</button
		>
	</div>
	{#if !editor.source}<p class="hint">{messages.sourceMissing}</p>{/if}
	<div class="workspace">
		<div class="board">
			{#key editor.gridSet}<GridSetView
					gridSet={editor.gridSet}
					editing={editor.editing || editor.busy}
					selection={editor.selection}
					onSelectCell={editor.select}
					retainedRuntime={editor.runtime ?? undefined}
				/>{/key}
		</div>
		{#if editor.editing}
			{#if editor.selectedCell && editor.selection && editor.form}
				<GridSetCellEditor
					cell={editor.selectedCell}
					selection={editor.selection}
					form={editor.form}
					error={editor.draftError}
					busy={editor.busy}
					hasDraft={editor.hasDraft}
					onCaption={editor.caption}
					onColour={editor.colour}
					onApply={editor.apply}
					onCancel={editor.cancel}
				/>
			{:else}<aside class="choose-cell">{messages.select}</aside>{/if}
		{/if}
	</div>
</div>

<style>
	.grid-page {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		box-sizing: border-box;
		/* The shell allocates the space left by its visible session status. */
		flex: 1;
		min-block-size: 0;
		min-inline-size: 0;
	}
	header {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		flex: none;
	}
	h1 {
		font-size: 1rem;
		margin: 0;
		overflow-wrap: anywhere;
	}
	a {
		min-block-size: 44px;
		display: inline-flex;
		align-items: center;
		padding-inline: 8px;
	}
	.toolbar {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
		flex: none;
	}
	.toolbar label {
		display: flex;
		align-items: center;
		gap: 6px;
		min-inline-size: 0;
		max-inline-size: 100%;
	}
	.toolbar select {
		max-inline-size: 280px;
		min-inline-size: 0;
		min-block-size: 44px;
		font: inherit;
	}
	.toolbar label select {
		flex: 1;
	}
	.settings-link {
		display: inline-flex;
		align-items: center;
		min-block-size: 44px;
	}
	button {
		min-block-size: 44px;
		min-inline-size: 44px;
		padding-inline: 10px;
		border: 1px solid #9bb;
		border-radius: 6px;
		background: #eef6f8;
		cursor: pointer;
		font: inherit;
	}
	button[aria-pressed='true'] {
		background: #d3e7fa;
		border-color: #075dcc;
	}
	button:disabled {
		cursor: default;
		opacity: 0.6;
	}
	.hint {
		font-size: 0.9rem;
	}
	.workspace {
		display: flex;
		gap: 12px;
		flex: 1;
		min-block-size: 0;
	}
	.board {
		display: flex;
		flex: 1;
		min-inline-size: 0;
		min-block-size: 0;
	}
	.choose-cell {
		inline-size: 280px;
		padding: 10px;
		box-sizing: border-box;
	}
	:is(button, select):focus-visible {
		outline: 3px solid #075dcc;
		outline-offset: 2px;
	}
	@media (max-width: 720px) {
		.grid-page.editing {
			block-size: auto;
			min-block-size: 100dvh;
			flex: none;
		}
		.workspace {
			flex-direction: column;
		}
		.editing .board {
			block-size: 55dvh;
			flex: none;
		}
		.choose-cell {
			inline-size: 100%;
		}
	}
</style>
