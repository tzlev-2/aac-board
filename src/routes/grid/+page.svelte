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
	import { openGridSet, writeGridSet, type GridSetSource } from '$lib/gridset/gridSetSource';
	import GridSetView from '$lib/components/gridset/GridSetView.svelte';
	import { SAMPLE_GRID_SET } from './sampleGridSet';
	import { onMount } from 'svelte';

	// ‏`SAMPLE_GRID_SET` הוא לוח-הדגמה מוטבע בן 9 תאים. הוא נשאר כ**מצב
	// פתיחה** כדי שהדף יצייר משהו מיָד וב-SSR, אבל הוא **אינו מה שרוצים
	// לראות** — הלוח האמיתי נטען ב-`onMount` מיד אחריו.
	let gridSet = $state<GridSet>(SAMPLE_GRID_SET);
	let source = $state<GridSetSource | null>(null);
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
			if (isZip) {
				const opened = await openGridSet(bytes);
				gridSet = opened.gridSet;
				source = opened.source;
			} else {
				gridSet = parseJsonGridSet(new TextDecoder().decode(bytes));
				source = null;
			}
			sourceName = file.name;
		} catch (e) {
			error = `קובץ לא תקין: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			loading = false;
		}
	}

	/**
	 * ‏🛑 **תוכן Smartbox מורשה.** הלוחות תחת `static/` אינם בגיט
	 * (‏`*.gridset` ב-`.gitignore`) ואינם נשלחים עם הקוד — הם נכנסים
	 * **לתיקיית הבילד בלבד**, ולכן כל פריסה שמכילה אותם **חייבת לשבת
	 * מאחורי Cloudflare Access.**
	 *
	 * נפרס כך ⟨28.9.2026⟩: ‏`aac-board` בחשבון הארגוני, ‏Access הועמד על
	 * ‏`*.aac-board-bzq.pages.dev` **לפני** ההעלאה הראשונה. אומת שגם
	 * ‏`/org-1.gridset` עצמו חסום, ולא רק הדף.
	 */
	async function loadFromUrl(url: string, name: string) {
		loading = true;
		error = '';
		await nextFrame();
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`${res.status}`);
			const opened = await openGridSet(new Uint8Array(await res.arrayBuffer()));
			gridSet = opened.gridSet;
			source = opened.source;
			sourceName = name;
		} catch (e) {
			error = `טעינה נכשלה: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			loading = false;
		}
	}

	/**
	 * 🔑 טעינה אוטומטית של הלוח האמיתי.
	 *
	 * בלי זה הדף נפתח על לוח-ההדגמה בן ה-9 תאים, ומי שנכנס לכתובת רואה
	 * "לוח ישן" ומסיק שהפריסה לא עודכנה. ⟨נצרב 28.9.2026 — בדיוק זה קרה.⟩
	 *
	 * ‏`onMount` ולא בזמן-בנייה: הפרסור הוא של ZIP בצד-הלקוח.
	 * כישלון אינו מפיל את הדף — נשארים על לוח-ההדגמה ומודיעים.
	 */
	onMount(() => {
		void loadFromUrl('/org-1.gridset', 'org-1.gridset');
	});

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		handleFiles(e.dataTransfer?.files ?? null);
	}

	function saveCopy() {
		if (!source) return;
		error = '';
		try {
			const bytes = writeGridSet(source, []);
			const url = URL.createObjectURL(
				new Blob([new Uint8Array(bytes)], { type: 'application/zip' })
			);
			const a = document.createElement('a');
			a.href = url;
			a.download = sourceName.replace(/(\.[^.]+)?$/, '-edited$1');
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			error = `שמירה נכשלה: ${e instanceof Error ? e.message : String(e)}`;
		}
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
		<div class="samples">
			<button type="button" onclick={() => loadFromUrl('/org-1.gridset', 'org-1.gridset')}>
				טען לוח לדוגמה — ‏96 דפים
			</button>
			<button type="button" onclick={() => loadFromUrl('/org-2.gridset', 'org-2.gridset')}>
				לוח גדול יותר — ‏132 דפים
			</button>
			<!--
				🔑 הלוח היחיד עם סמלי PCS. ‏`org-1` ו-`org-2` הם **אפס** הפניות
				‏`[MJPCS#]` — ‏415 מתוך 415 יושבות כאן (‏76% מהפניות-הספרייה שלו).
				בלי הכפתור הזה אי אפשר לראות את שכבת ה-PCS בכלל.
			-->
			<button type="button" onclick={() => loadFromUrl('/org-3.gridset', 'org-3.gridset')}>
				לוח עם סמלי PCS — ‏34 דפים
			</button>
			<!--
				🔑 יעד מדידת A7.5 (TileColour) — הקובץ ב-.gitignore כמו שלושת האחרים.
				38 מופעי TileColour; org-* נושאים 0.
			-->
			<button type="button" onclick={() => loadFromUrl('/b037.gridset', 'b037.gridset')}>
				לוח b037 — מקלדת פשוטה (TileColour)
			</button>
		</div>
		<button type="button" disabled={source === null || loading} onclick={saveCopy}>שמור עותק</button
		>
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
	.samples {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.6rem;
		flex-wrap: wrap;
	}
	.samples button {
		padding: 0.45rem 0.9rem;
		border: 1px solid #9bb;
		border-radius: 6px;
		background: #eef6f8;
		cursor: pointer;
		font: inherit;
	}
	.samples button:hover {
		background: #dceef3;
	}
</style>
