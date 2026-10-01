import {
	openGridSet,
	writeGridSet,
	type CellEdit,
	type GridSetSource
} from '$lib/gridset/gridSetSource';
import type { Cell, GridSet, Page } from '$lib/gridset/types';
import type { GridRuntime } from '$lib/gridset/runtime.svelte';
import type { CellColourField } from '$lib/gridset/xmlEdit';
import { SAMPLE_GRID_SET } from './sampleGridSet';
import {
	COLOUR_FIELDS,
	COLOUR_PROPERTIES,
	createGridSetEditSession,
	editedFilename,
	hasCellPatch,
	upsertCellEdit,
	validateCellEdit,
	type CellAddress,
	type GridSetEditSession
} from './gridset-edit-session';
import { errorMessage, messages } from './editor-messages';

export interface CellForm {
	caption: string;
	colours: Record<CellColourField, string>;
}
function formOf(cell: Cell): CellForm {
	return {
		caption: cell.caption ?? '',
		colours: Object.fromEntries(
			COLOUR_FIELDS.map((f) => [f, cell.style[COLOUR_PROPERTIES[f]]])
		) as Record<CellColourField, string>
	};
}
export function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/** Route-local state: the archive stays raw, only pages of the model are replaced. */
export function createGridSetEditor() {
	let gridSet = $state<GridSet>(SAMPLE_GRID_SET);
	let source = $state.raw<GridSetSource | null>(null);
	let session: GridSetEditSession | null = null;
	let runtime = $state.raw<GridRuntime | null>(null);
	let sourceName = $state('');
	let loading = $state(false);
	let saving = $state(false);
	let editing = $state(false);
	let error = $state('');
	let draftError = $state('');
	let downloaded = $state('');
	let appliedEdits = $state.raw<CellEdit[]>([]);
	let draft = $state.raw<CellEdit | null>(null);
	let selection = $state.raw<CellAddress | null>(null);
	let baseline: CellForm | null = null;
	let form = $state.raw<CellForm | null>(null);
	let pending = $state.raw<{ kind: 'draft' | 'load'; run: () => void } | null>(null);
	let generation = 0;
	let revision = $state(0);
	let lastDownloadRevision = $state(0);
	const busy = $derived(loading || saving);
	const hasDraft = $derived(Boolean((draft && hasCellPatch(draft)) || draftError));
	const dirty = $derived(appliedEdits.length > 0 || hasDraft);

	function resetSelection() {
		selection = null;
		baseline = null;
		form = null;
		draft = null;
		draftError = '';
	}
	function requestAction(run: () => void) {
		if (busy || pending) return;
		if (hasDraft) pending = { kind: 'draft', run };
		else run();
	}
	function select(page: Page, cell: Cell) {
		if (!editing) return;
		requestAction(() => {
			try {
				if (page.cells.filter((c) => c.x === cell.x && c.y === cell.y).length !== 1)
					throw new Error('ambiguous-cell');
				selection = { page: page.name, x: cell.x, y: cell.y };
				baseline = formOf(cell);
				form = baseline;
				draft = null;
				draftError = '';
				error = '';
			} catch (e) {
				error = errorMessage(e);
			}
		});
	}
	function updateForm(next: CellForm) {
		if (!selection || !baseline || !session || busy) return;
		form = next;
		const patch: CellEdit = { ...selection };
		if (next.caption !== baseline.caption) patch.caption = next.caption;
		for (const field of COLOUR_FIELDS) {
			if (next.colours[field].toUpperCase() !== baseline.colours[field].toUpperCase()) {
				patch.colours ??= {};
				patch.colours[field] = next.colours[field];
			}
		}
		try {
			validateCellEdit(patch);
			const effective = hasCellPatch(patch) ? upsertCellEdit(appliedEdits, patch) : appliedEdits;
			const candidate = session.preview(selection.page, effective);
			gridSet.pages[selection.page] = candidate;
			draft = hasCellPatch(patch) ? patch : null;
			draftError = '';
			error = '';
		} catch (e) {
			draftError = errorMessage(e);
		}
	}
	function caption(value: string) {
		if (form) updateForm({ ...form, caption: value });
	}
	function colour(field: CellColourField, value: string) {
		if (form) updateForm({ ...form, colours: { ...form.colours, [field]: value } });
	}
	function apply(): boolean {
		if (busy || draftError) return false;
		if (draft && hasCellPatch(draft)) {
			appliedEdits = upsertCellEdit(appliedEdits, draft);
			revision++;
		}
		draft = null;
		if (selection) {
			baseline = formOf(
				gridSet.pages[selection.page].cells.find(
					(c) => c.x === selection!.x && c.y === selection!.y
				)!
			);
			form = baseline;
		}
		return true;
	}
	function cancel() {
		if (busy || !selection || !session) return;
		try {
			gridSet.pages[selection.page] = session.preview(selection.page, appliedEdits);
			form = baseline;
			draft = null;
			draftError = '';
		} catch (e) {
			error = errorMessage(e);
		}
	}
	function resolvePending(choice: 'apply' | 'cancel' | 'stay') {
		const action = pending;
		if (!action) return;
		if (choice === 'stay') {
			pending = null;
			return;
		}
		if (action.kind === 'draft') {
			if (choice === 'apply' && !apply()) return;
			if (choice === 'cancel') cancel();
		}
		pending = null;
		action.run();
	}
	function mode(value: boolean) {
		if (value && !source) return;
		requestAction(() => {
			editing = value;
			if (!value) resetSelection();
		});
	}
	function navigate(page: string) {
		requestAction(() => {
			runtime?.navigate(page);
			resetSelection();
		});
	}
	async function load(
		loader: () => Promise<{ gridSet: GridSet; source: GridSetSource | null }>,
		name: string,
		prefix: string
	) {
		if (saving) return;
		const token = ++generation;
		loading = true;
		error = '';
		await nextFrame();
		try {
			const opened = await loader();
			const nextSession = opened.source
				? createGridSetEditSession(opened.source, opened.gridSet.styles)
				: null;
			if (token !== generation) return;
			source = opened.source;
			session = nextSession;
			sourceName = name;
			appliedEdits = [];
			revision = 0;
			lastDownloadRevision = 0;
			editing = false;
			downloaded = '';
			resetSelection();
			runtime = null;
			gridSet = opened.gridSet;
		} catch (e) {
			if (token === generation) error = `${prefix} ${errorMessage(e)}`;
		} finally {
			if (token === generation) loading = false;
		}
	}
	function requestLoad(run: () => void) {
		if (saving || pending) return;
		if (hasDraft || revision !== lastDownloadRevision) pending = { kind: 'load', run };
		else run();
	}
	function loadFile(file: File) {
		requestLoad(() => {
			void load(
				async () => {
					const bytes = new Uint8Array(await file.arrayBuffer());
					if (bytes[0] === 0x50 && bytes[1] === 0x4b) return openGridSet(bytes);
					const parsed = JSON.parse(new TextDecoder().decode(bytes));
					if (!parsed || typeof parsed !== 'object' || !parsed.pages || !parsed.startGrid)
						throw new Error('invalid-json');
					return { gridSet: parsed as GridSet, source: null };
				},
				file.name,
				messages.invalidFile
			);
		});
	}
	function loadUrl(url: string, name: string) {
		requestLoad(() => {
			void load(
				async () => {
					const response = await fetch(url);
					if (!response.ok) throw new Error(String(response.status));
					return openGridSet(new Uint8Array(await response.arrayBuffer()));
				},
				name,
				messages.loadFailed
			);
		});
	}
	async function saveCopy() {
		if (!source || busy || draftError || pending) return;
		error = '';
		downloaded = '';
		if (!apply()) return;
		saving = true;
		await nextFrame();
		let url: string | undefined;
		try {
			const bytes = writeGridSet(source, appliedEdits);
			url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }));
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = editedFilename(sourceName);
			anchor.click();
			downloaded = anchor.download;
			lastDownloadRevision = revision;
		} catch (e) {
			error = `${messages.saveFailed} ${errorMessage(e)}`;
		} finally {
			if (url) {
				const cleanupUrl = url;
				setTimeout(() => URL.revokeObjectURL(cleanupUrl), 0);
			}
			saving = false;
		}
	}
	return {
		get gridSet() {
			return gridSet;
		},
		get source() {
			return source;
		},
		get runtime() {
			return runtime;
		},
		runtimeReady: (value: GridRuntime) => {
			runtime = value;
		},
		get sourceName() {
			return sourceName;
		},
		get loading() {
			return loading;
		},
		get saving() {
			return saving;
		},
		get busy() {
			return busy;
		},
		get editing() {
			return editing;
		},
		get error() {
			return error;
		},
		get draftError() {
			return draftError;
		},
		get downloaded() {
			return downloaded;
		},
		get selection() {
			return selection;
		},
		get form() {
			return form;
		},
		get hasDraft() {
			return hasDraft;
		},
		get dirty() {
			return dirty;
		},
		get pending() {
			return pending?.kind ?? null;
		},
		get appliedEdits() {
			return appliedEdits;
		},
		get selectedCell() {
			return selection
				? (gridSet.pages[selection.page].cells.find(
						(c) => c.x === selection!.x && c.y === selection!.y
					) ?? null)
				: null;
		},
		select,
		caption,
		colour,
		apply,
		cancel,
		resolvePending,
		mode,
		navigate,
		loadFile,
		loadUrl,
		saveCopy
	};
}
