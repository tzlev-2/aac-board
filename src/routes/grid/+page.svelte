<script lang="ts">
	/**
	 * המסלול של הלוח: קובץ → מודל → מריץ חי.
	 *
	 * 🔑 `.gridset` הוא ZIP, ולכן הוא נקרא כבייטים ולא כטקסט — הבדיקה היא
	 * חתימת-הקובץ (`PK`) ולא הסיומת. ‏JSON שכבר בצורת `GridSet` ממשיך להיתמך
	 * (‏`sampleGridSet.ts`, ‏`__fixtures__/sample-gridset.json`, ‏E2E).
	 *
	 * 🛑 `parseGridSet` משתמש ב-`unzipSync` **במכוון** (`parse.ts:96` — הגרסה
	 * האסינכרונית של fflate פותחת Worker דרך blob URL), ולכן הפרסור חוסם את
	 * ה-thread. מכאן מחוון-הטעינה, ומכאן גם ה-frame שממתינים לו לפניו: בלעדיו
	 * המחוון לא נצבע כלל והמסך פשוט קופא.
	 */
	import type { GridSet } from '$lib/gridset/types';
	import { parseGridSet } from '$lib/gridset/parse';
	import GridSetView from '$lib/components/gridset/GridSetView.svelte';
	import { SAMPLE_GRID_SET } from './sampleGridSet';

	let gridSet = $state<GridSet>(SAMPLE_GRID_SET);
	let error = $state('');
	let loading = $state(false);
	let sourceName = $state('');

	const pageCount = $derived(Object.keys(gridSet.pages).length);

	function parseJsonGridSet(text: string): GridSet {
		const parsed = JSON.parse(text);
		if (!parsed || typeof parsed !== 'object' || !parsed.pages || !parsed.startGrid) {
			throw new Error('חסרים pages/startGrid');
		}
		return parsed as GridSet;
	}

	/** ‏frame אחד כדי שהמחוון ייצבע לפני הפרסור החוסם. */
	function nextFrame(): Promise<void> {
		return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
	}

	async function handleFiles(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;

		loading = true;
		error = '';
		await nextFrame();

		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			// חתימת ZIP: 50 4B ("PK"). כל השאר — JSON.
			const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
			gridSet = isZip
				? await parseGridSet(bytes)
				: parseJsonGridSet(new TextDecoder().decode(bytes));
			sourceName = file.name;
		} catch (e) {
			error = `קובץ לא תקין: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			loading = false;
		}
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
			טעינת לוח — גררו קובץ <code>.gridset</code> לכאן, או בחרו:
			<input
				type="file"
				accept=".gridset,application/json,.json"
				onchange={(e) => handleFiles((e.currentTarget as HTMLInputElement).files)}
			/>
		</label>
		{#if loading}
			<p class="status" data-testid="grid-loading" role="status">טוען את הלוח…</p>
		{:else if sourceName}
			<p class="status" data-testid="grid-source">{sourceName} · {pageCount} דפים</p>
		{/if}
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
	</div>

	{#key gridSet}
		<GridSetView {gridSet} />
	{/key}
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
	.status {
		margin: 4px 0 0;
		color: #555;
	}
	.error {
		color: #c62828;
	}
</style>
