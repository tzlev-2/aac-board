<script lang="ts">
	/**
	 * 🛑 פרסור .gridset אמיתי (ZIP+XML) הוא slice/gridset-parser — מחוץ להיקף
	 * כאן. עד שהוא יתמזג, הטעינה כאן מקבלת JSON שכבר בצורת GridSet (ראו
	 * sampleGridSet.ts ו-__fixtures__/sample-gridset.json), רק כדי שסלייס
	 * הרינדור יהיה ניתן לבדיקה עצמאית מקצה-לקצה. GridBoard עצמו לא יודע/
	 * אכפת לו מאיפה ה-GridSet הגיע.
	 */
	import type { GridSet } from '$lib/gridset/types';
	import GridBoard from '$lib/components/gridset/GridBoard.svelte';
	import { createDemoRuntimeContext } from './createDemoRuntimeContext';
	import { SAMPLE_GRID_SET } from './sampleGridSet';

	let gridSet = $state<GridSet>(SAMPLE_GRID_SET);
	let error = $state('');

	const page = $derived(gridSet.pages[gridSet.startGrid]);
	const ctx = $derived(createDemoRuntimeContext(gridSet, page));

	function loadFromText(text: string) {
		try {
			const parsed = JSON.parse(text);
			if (!parsed || typeof parsed !== 'object' || !parsed.pages || !parsed.startGrid) {
				throw new Error('חסרים pages/startGrid');
			}
			gridSet = parsed as GridSet;
			error = '';
		} catch (e) {
			error = `קובץ לא תקין: ${e instanceof Error ? e.message : String(e)}`;
		}
	}

	async function handleFiles(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;
		loadFromText(await file.text());
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		handleFiles(e.dataTransfer?.files ?? null);
	}
</script>

<div class="grid-page">
	<div
		class="dropzone"
		role="button"
		tabindex="0"
		ondragover={(e) => e.preventDefault()}
		ondrop={handleDrop}
	>
		<label>
			טעינת GridSet (JSON זמני, עד שסלייס הפרסר יתמזג)
			<input
				type="file"
				accept="application/json,.json"
				onchange={(e) => handleFiles((e.currentTarget as HTMLInputElement).files)}
			/>
		</label>
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
	</div>

	{#if page}
		<GridBoard {page} {ctx} />
	{/if}
</div>

<style>
	.grid-page {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
		box-sizing: border-box;
		height: 100%;
	}
	.dropzone {
		border: 2px dashed #999;
		border-radius: 8px;
		padding: 8px 12px;
	}
	.error {
		color: #c62828;
	}
</style>
