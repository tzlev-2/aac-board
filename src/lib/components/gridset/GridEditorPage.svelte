<script lang="ts">
	import { onMount } from 'svelte';
	import GridSetView from '$lib/components/gridset/GridSetView.svelte';
	import GridSetCellEditor from '../../../routes/grid/GridSetCellEditor.svelte';
	import EditorDecision from '../../../routes/grid/EditorDecision.svelte';
	import { createGridSetEditor } from '../../../routes/grid/gridset-editor.svelte';
	import { messages } from '../../../routes/grid/editor-messages';
	const editor = createGridSetEditor();
	const pages = $derived(Object.keys(editor.gridSet.pages));
	const samples = ['org-1.gridset', 'org-2.gridset', 'org-3.gridset', 'b037.gridset'];
	onMount(() => {
		editor.loadUrl('/org-1.gridset', 'org-1.gridset');
	});
	function files(input: HTMLInputElement) {
		const file = input.files?.[0];
		input.value = '';
		if (file) editor.loadFile(file);
	}
	function drop(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files?.[0];
		if (file) editor.loadFile(file);
	}
</script>

<svelte:head><title>Grid AAC Clone</title></svelte:head>

<div class="grid-page" dir="rtl">
	<div
		class="dropzone"
		role="group"
		aria-label={messages.load}
		ondragover={(e) => e.preventDefault()}
		ondrop={drop}
	>
		<label
			>{messages.load}<input
				aria-label={messages.load}
				type="file"
				disabled={editor.saving}
				accept=".gridset,application/json,.json"
				onchange={(e) => files(e.currentTarget)}
			/></label
		>
		<div class="samples">
			{#each samples as name, i (name)}<button
					type="button"
					disabled={editor.saving}
					onclick={() => editor.loadUrl('/' + name, name)}>{messages.samples[i]}</button
				>{/each}
		</div>
		{#if editor.loading}<p data-testid="grid-loading" role="status">{messages.loading}</p>
		{:else if editor.sourceName}<p data-testid="grid-source">
				{editor.sourceName} · {pages.length}
				{messages.pages}
			</p>{/if}
	</div>
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
	{#if editor.error}<p class="error" role="alert">{editor.error}</p>{/if}
	{#if editor.downloaded}<p role="status" data-testid="grid-download">
			{messages.downloaded}
			{editor.downloaded}
		</p>{/if}
	<div class="workspace">
		<div class="board">
			{#key editor.gridSet}<GridSetView
					gridSet={editor.gridSet}
					editing={editor.editing || editor.busy}
					selection={editor.selection}
					onSelectCell={editor.select}
					onRuntimeReady={editor.runtimeReady}
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
	{#if editor.pending}
		<EditorDecision
			kind={editor.pending}
			invalid={Boolean(editor.draftError)}
			onChoice={editor.resolvePending}
		/>
	{/if}
</div>

<style>
	.grid-page {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		box-sizing: border-box;
		block-size: 100dvh;
		min-block-size: 500px;
	}
	.dropzone {
		border: 2px dashed #999;
		border-radius: 8px;
		padding: 6px 10px;
	}
	.samples,
	.toolbar {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}
	.samples {
		margin-block-start: 6px;
	}
	.toolbar label {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.toolbar select {
		max-inline-size: 280px;
		min-block-size: 44px;
		font: inherit;
	}
	.settings-link {
		display: inline-flex;
		align-items: center;
		min-block-size: 44px;
	}
	button {
		min-block-size: 44px;
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
	p {
		margin-block: 4px;
	}
	.error {
		color: #a21a1a;
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
	:is(button, input, select):focus-visible {
		outline: 3px solid #075dcc;
		outline-offset: 2px;
	}
	@media (max-width: 720px) {
		.grid-page {
			block-size: auto;
			min-block-size: 100dvh;
		}
		.workspace {
			flex-direction: column;
		}
		.board {
			block-size: 55dvh;
			flex: none;
		}
		.choose-cell {
			inline-size: 100%;
		}
	}
</style>
