<script lang="ts">
	import type { Cell } from '$lib/gridset/types';
	import type { CellColourField } from '$lib/gridset/xmlEdit';
	import type { CellForm } from './gridset-editor.svelte';
	import { COLOUR_FIELDS, COLOUR_PROPERTIES, type CellAddress } from './gridset-edit-session';
	import { messages, colourLabels, cellLabel } from './editor-messages';
	let {
		cell,
		selection,
		form,
		error = '',
		busy = false,
		hasDraft = false,
		onCaption,
		onColour,
		onApply,
		onCancel
	}: {
		cell: Cell;
		selection: CellAddress;
		form: CellForm;
		error?: string;
		busy?: boolean;
		hasDraft?: boolean;
		onCaption: (value: string) => void;
		onColour: (field: CellColourField, value: string) => void;
		onApply: () => void;
		onCancel: () => void;
	} = $props();
	function validColour(field: CellColourField): string {
		return /^#[0-9a-f]{8}$/i.test(form.colours[field])
			? form.colours[field]
			: cell.style[COLOUR_PROPERTIES[field]];
	}
	function rgb(field: CellColourField, value: string) {
		onColour(field, value + validColour(field).slice(-2));
	}
	function alpha(field: CellColourField, value: string) {
		const number = Number(value);
		onColour(
			field,
			validColour(field).slice(0, 7) +
				(value !== '' && Number.isInteger(number) && number >= 0 && number <= 255
					? number.toString(16).padStart(2, '0')
					: '??')
		);
	}
</script>

<aside class="cell-editor" aria-label={messages.edit}>
	<h2>{cellLabel(selection.page, selection.x, selection.y)}</h2>
	<label
		>{messages.caption}
		<textarea
			value={form.caption}
			disabled={busy || Boolean(cell.contentType)}
			oninput={(e) => onCaption(e.currentTarget.value)}
			dir="rtl"
			rows="2"
		></textarea>
	</label>
	{#if cell.contentType}<p class="hint">{messages.dynamicCaption}</p>{/if}
	{#each COLOUR_FIELDS as field (field)}
		<fieldset disabled={busy}>
			<legend>{colourLabels[field]}</legend>
			<label class="hex"
				>{colourLabels[field]}<input
					aria-label={colourLabels[field]}
					dir="ltr"
					value={form.colours[field]}
					oninput={(e) => onColour(field, e.currentTarget.value)}
					spellcheck="false"
				/></label
			>
			<div class="colour-tools">
				<input
					type="color"
					aria-label={`${colourLabels[field]} ${messages.rgb}`}
					value={validColour(field).slice(0, 7)}
					oninput={(e) => rgb(field, e.currentTarget.value)}
				/>
				<label
					>{messages.alpha}<input
						type="number"
						min="0"
						max="255"
						aria-label={`${colourLabels[field]} ${messages.alpha}`}
						value={parseInt(validColour(field).slice(-2), 16)}
						onchange={(e) => alpha(field, e.currentTarget.value)}
						dir="ltr"
					/></label
				>
				<button type="button" onclick={() => onColour(field, validColour(field).slice(0, 7) + '00')}
					>{messages.transparent}</button
				>
			</div>
		</fieldset>
	{/each}
	{#if error}<p role="alert">{error}</p>{/if}
	<div class="actions">
		<button type="button" disabled={busy || Boolean(error) || !hasDraft} onclick={onApply}
			>{messages.apply}</button
		>
		<button type="button" disabled={busy || !hasDraft} onclick={onCancel}>{messages.cancel}</button>
	</div>
</aside>

<style>
	.cell-editor {
		inline-size: 300px;
		max-inline-size: 100%;
		overflow: auto;
		border: 1px solid #bcc8d0;
		border-radius: 8px;
		padding: 10px;
		box-sizing: border-box;
		background: #f8fafc;
	}
	h2 {
		font-size: 1rem;
		margin-block: 0 8px;
	}
	label {
		display: block;
		font-size: 0.85rem;
	}
	textarea,
	input {
		font: inherit;
		box-sizing: border-box;
		max-inline-size: 100%;
	}
	textarea,
	.hex input {
		inline-size: 100%;
		min-block-size: 44px;
	}
	fieldset {
		margin-block: 6px;
		padding: 6px;
		border: 1px solid #b6c1cc;
	}
	legend {
		font-size: 0.9rem;
	}
	.hex {
		font-size: 0;
	}
	.hex input {
		font-size: 1rem;
	}
	.colour-tools {
		display: flex;
		align-items: end;
		gap: 6px;
		margin-block-start: 4px;
	}
	.colour-tools input[type='color'] {
		inline-size: 44px;
		block-size: 44px;
		padding: 2px;
	}
	.colour-tools input[type='number'] {
		inline-size: 70px;
		min-block-size: 44px;
	}
	.colour-tools label {
		flex: 1;
	}
	.actions {
		display: flex;
		gap: 8px;
	}
	button {
		min-block-size: 44px;
		padding-inline: 10px;
		cursor: pointer;
		font: inherit;
	}
	button:disabled {
		cursor: default;
	}
	:is(button, input, textarea):focus-visible {
		outline: 3px solid #075dcc;
		outline-offset: 2px;
	}
	[role='alert'] {
		color: #a21a1a;
	}
	.hint {
		font-size: 0.8rem;
	}
</style>
