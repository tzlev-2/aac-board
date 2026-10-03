import { getContext, setContext } from 'svelte';
import {
	createGridSetEditor,
	openFile,
	openUrl,
	stageOpened,
	nextFrame
} from '../../routes/grid/gridset-editor.svelte';
import { errorMessage, messages } from '../../routes/grid/editor-messages';
const CONTEXT = Symbol('application-session');
export interface Application {
	id: string;
	name: string;
	label: string;
	url?: string;
	file?: File;
}
export interface SelectionResult {
	status: 'opened' | 'stayed' | 'failed' | 'superseded' | 'navigation-failed';
	intent: number;
	applicationId: string;
}
export function createApplicationSession(navigate: (path: string) => Promise<void>) {
	const editor = createGridSetEditor();
	let active = $state.raw<Application | null>(null);
	let imports = $state.raw<Application[]>([]);
	let busy = $state(false);
	let intent = 0;
	let ordinal = 0;
	let authorizedNavigation: number | null = null;
	const samples: Application[] = [
		'org-1.gridset',
		'org-2.gridset',
		'org-3.gridset',
		'b037.gridset'
	].map((name, i) => ({ id: `sample:${name}`, name, label: messages.samples[i], url: '/' + name }));
	function invalidate() {
		intent++;
		busy = false;
		editor.setLoading(false);
		editor.invalidatePending();
	}
	async function openBoard(token: number, id: string): Promise<SelectionResult> {
		authorizedNavigation = token;
		try {
			await navigate('/board');
			return {
				status: token === intent ? 'opened' : 'superseded',
				intent: token,
				applicationId: id
			};
		} catch (e) {
			if (token !== intent) return { status: 'superseded', intent: token, applicationId: id };
			editor.setError(`${messages.navigationFailed} ${errorMessage(e)}`);
			return { status: 'navigation-failed', intent: token, applicationId: id };
		} finally {
			if (authorizedNavigation === token) authorizedNavigation = null;
		}
	}
	async function selectApplication(application: Application): Promise<SelectionResult> {
		if (busy || editor.saving || editor.pending)
			return { status: 'superseded', intent, applicationId: application.id };
		const token = ++intent;
		const result = (status: SelectionResult['status']): SelectionResult => ({
			status,
			intent: token,
			applicationId: application.id
		});
		busy = true;
		editor.setError('');
		try {
			if (active?.id === application.id) return await openBoard(token, application.id);
			editor.setLoading(true);
			await nextFrame();
			const staged = stageOpened(
				await (application.file ? openFile(application.file) : openUrl(application.url!))
			);
			if (token !== intent) return result('superseded');
			editor.setLoading(false);
			if (!(await editor.confirmReplacement()))
				return result(token === intent ? 'stayed' : 'superseded');
			if (token !== intent) return result('superseded');
			editor.publish(staged, application.name);
			active = application;
			if (application.file && !imports.some((a) => a.id === application.id))
				imports = [...imports, application];
			return await openBoard(token, application.id);
		} catch (e) {
			if (token !== intent) return result('superseded');
			editor.setError(`${messages.loadFailed} ${errorMessage(e)}`);
			return result('failed');
		} finally {
			if (token === intent) {
				busy = false;
				editor.setLoading(false);
			}
		}
	}
	function importFile(file: File) {
		if (busy || editor.saving || editor.pending)
			return Promise.resolve<SelectionResult>({ status: 'superseded', intent, applicationId: '' });
		const number = ++ordinal;
		return selectApplication({
			id: `import:${number}`,
			name: file.name,
			label: `${file.name} · ${messages.imported} ${number}`,
			file
		});
	}
	async function leave(continuation: () => Promise<void>) {
		if (busy || editor.saving || editor.pending) return;
		const token = ++intent;
		busy = true;
		try {
			if ((await editor.confirmReplacement()) && token === intent) {
				if (editor.unsaved && !editor.discardChanges()) return;
				await continuation();
			}
		} catch (e) {
			editor.setError(errorMessage(e));
		} finally {
			if (token === intent) busy = false;
		}
	}
	return {
		editor,
		samples,
		get active() {
			return active;
		},
		get imports() {
			return imports;
		},
		get busy() {
			return busy || editor.busy;
		},
		selectApplication,
		importFile,
		invalidate,
		leave,
		navigationAccepted: (path?: string, type?: string) => {
			if (!(authorizedNavigation === intent && path === '/board' && type === 'goto')) invalidate();
		},
		resume: () => (active ? selectApplication(active) : Promise.resolve(null))
	};
}
export type ApplicationSession = ReturnType<typeof createApplicationSession>;
export function provideApplicationSession(session: ApplicationSession) {
	setContext(CONTEXT, session);
}
export function applicationSession(): ApplicationSession {
	return getContext(CONTEXT);
}
