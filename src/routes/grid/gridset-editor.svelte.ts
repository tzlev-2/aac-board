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
import { createRuntime } from '$lib/gridset/runtime.svelte';
import { validateJsonGridSet } from '$lib/gridset/validate-json';
export { validateJsonGridSet } from '$lib/gridset/validate-json';
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

/** Layout-owned editor state: archives stay raw; preview replaces individual pages. */
export function createGridSetEditor() {
	let gridSet = $state<GridSet>(structuredClone(SAMPLE_GRID_SET));
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
	let pending = $state.raw<{
		kind: 'draft' | 'load';
		run: () => void;
		settle?: (success: boolean) => void;
	} | null>(null);
	let generation = 0;
	let revision = $state(0);
	let lastDownloadRevision = $state(0);
	const busy = $derived(loading || saving);
	const hasDraft = $derived(Boolean((draft && hasCellPatch(draft)) || draftError));
	const dirty = $derived(appliedEdits.length > 0 || hasDraft);
	const unsaved = $derived(hasDraft || revision !== lastDownloadRevision);

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
		try {
			const effective =
				draft && hasCellPatch(draft) ? upsertCellEdit(appliedEdits, draft) : appliedEdits;
			const nextBaseline = selection
				? formOf(
						gridSet.pages[selection.page].cells.find(
							(c) => c.x === selection!.x && c.y === selection!.y
						)!
					)
				: null;
			if (draft && hasCellPatch(draft)) revision++;
			appliedEdits = effective;
			draft = null;
			baseline = nextBaseline;
			form = nextBaseline;
			return true;
		} catch (e) {
			error = errorMessage(e);
			return false;
		}
	}
	function cancel() {
		if (busy || !selection || !session) return false;
		try {
			gridSet.pages[selection.page] = session.preview(selection.page, appliedEdits);
			form = baseline;
			draft = null;
			draftError = '';
			return true;
		} catch (e) {
			error = errorMessage(e);
			return false;
		}
	}
	async function resolvePending(choice: 'apply' | 'cancel' | 'stay' | 'save') {
		const action = pending;
		if (!action || saving) return;
		if (choice === 'stay') {
			pending = null;
			action.settle?.(false);
			return;
		}
		try {
			if (action.kind === 'draft') {
				if (choice === 'apply' && !apply()) return;
				if (choice === 'cancel' && !cancel()) return;
			} else if (choice === 'save' && !(await prepareCopy(() => pending === action))) return;
			if (pending !== action) return;
			pending = null;
			action.settle?.(true);
			action.run();
		} catch (e) {
			error = errorMessage(e);
		}
	}
	function confirmReplacement(): Promise<boolean> {
		if (pending || saving) return Promise.resolve(false);
		if (!unsaved) return Promise.resolve(true);
		return new Promise((settle) => {
			pending = { kind: 'load', run: () => {}, settle };
		});
	}
	function discardChanges(): boolean {
		try {
			const pages = appliedEdits
				.map((e) => e.page)
				.concat(selection ? [selection.page] : [])
				.filter((name, index, all) => all.indexOf(name) === index);
			const replacements = pages.map((name) => [name, session!.preview(name, [])] as const);
			for (const [name, page] of replacements) gridSet.pages[name] = page;
			appliedEdits = [];
			revision = 0;
			lastDownloadRevision = 0;
			resetSelection();
			return true;
		} catch (e) {
			error = errorMessage(e);
			return false;
		}
	}
	function invalidatePending() {
		const action = pending;
		pending = null;
		action?.settle?.(false);
	}
	function publish(
		opened: {
			gridSet: GridSet;
			source: GridSetSource | null;
			editSession: GridSetEditSession | null;
		},
		name: string
	) {
		// All fallible prerequisites belong to staging; the runtime uses this exact reactive model.
		runtime?.dispose();
		source = opened.source;
		session = opened.editSession;
		sourceName = name;
		appliedEdits = [];
		revision = 0;
		lastDownloadRevision = 0;
		editing = false;
		downloaded = '';
		resetSelection();
		gridSet = opened.gridSet;
		runtime = createRuntime(gridSet);
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
		if (saving || pending) return false;
		const token = ++generation;
		loading = true;
		error = '';
		try {
			await nextFrame();
			const opened = await loader();
			const staged = stageOpened(opened);
			if (token !== generation) return false;
			loading = false;
			if (!(await confirmReplacement()) || token !== generation) return false;
			publish(staged, name);
			return true;
		} catch (e) {
			if (token === generation) error = `${prefix} ${errorMessage(e)}`;
			return false;
		} finally {
			if (token === generation) loading = false;
		}
	}
	function loadFile(file: File) {
		return load(() => openFile(file), file.name, messages.invalidFile);
	}
	function loadUrl(url: string, name: string) {
		return load(() => openUrl(url), name, messages.loadFailed);
	}
	async function prepareCopy(valid: () => boolean = () => true): Promise<boolean> {
		if (!source || saving || draftError) return false;
		error = '';
		saving = true;
		let url: string | undefined;
		try {
			await nextFrame();
			if (!valid()) return false;
			const effective =
				draft && hasCellPatch(draft) ? upsertCellEdit(appliedEdits, draft) : appliedEdits;
			// Preview/baseline preparation must succeed before download or any state mutation.
			const nextBaseline = selection
				? formOf(
						gridSet.pages[selection.page].cells.find(
							(c) => c.x === selection!.x && c.y === selection!.y
						)!
					)
				: null;
			const bytes = writeGridSet(source, effective);
			url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/zip' }));
			if (!valid()) return false;
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = editedFilename(sourceName);
			anchor.click();
			if (draft && hasCellPatch(draft)) revision++;
			appliedEdits = effective;
			draft = null;
			baseline = nextBaseline;
			form = nextBaseline;
			downloaded = anchor.download;
			lastDownloadRevision = revision;
			return true;
		} catch (e) {
			error = `${messages.saveFailed} ${errorMessage(e)}`;
			return false;
		} finally {
			if (url) {
				const cleanupUrl = url;
				setTimeout(() => URL.revokeObjectURL(cleanupUrl), 1000);
			}
			saving = false;
		}
	}
	async function saveCopy() {
		if (busy || pending) return false;
		return prepareCopy();
	}
	return {
		get unsaved() {
			return unsaved;
		},
		confirmReplacement,
		invalidatePending,
		publish,
		discardChanges,
		setLoading: (value: boolean) => {
			loading = value;
		},
		setError: (value: string) => {
			error = value;
		},
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
			if (value.gridSet === gridSet && (!runtime || runtime === value)) runtime = value;
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

export async function openFile(file: File) {
	const bytes = new Uint8Array(await file.arrayBuffer());
	if (bytes[0] === 0x50 && bytes[1] === 0x4b) return openGridSet(bytes);
	const parsed = JSON.parse(new TextDecoder().decode(bytes));
	validateJsonGridSet(parsed);
	return { gridSet: parsed, source: null };
}
export async function openUrl(url: string) {
	const response = await fetch(url);
	if (!response.ok) throw new Error(String(response.status));
	return openGridSet(new Uint8Array(await response.arrayBuffer()));
}
export function stageOpened(opened: { gridSet: GridSet; source: GridSetSource | null }) {
	if (!Object.hasOwn(opened.gridSet.pages, opened.gridSet.startGrid))
		throw new Error('invalid-json');
	return {
		...opened,
		editSession: opened.source
			? createGridSetEditSession(opened.source, opened.gridSet.styles)
			: null
	};
}
