<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { beforeNavigate, afterNavigate, goto } from '$app/navigation';
	import {
		createApplicationSession,
		provideApplicationSession
	} from '$lib/gridset/application-session.svelte';
	import EditorDecision from './grid/EditorDecision.svelte';
	import { messages } from './grid/editor-messages';
	const session = createApplicationSession((path) => goto(path));
	provideApplicationSession(session);
	let leaveTarget: string | null = null;
	const retainedRoutes = new Set(['/', '/board', '/grid', '/settings']);
	beforeNavigate((navigation) => {
		const target = navigation.to?.url;
		if (target && leaveTarget === target.href) {
			leaveTarget = null;
			session.navigationAccepted(target?.pathname, navigation.type);
			return;
		}
		if (
			target &&
			target.origin === navigation.from?.url.origin &&
			!retainedRoutes.has(target.pathname) &&
			session.editor.unsaved
		) {
			navigation.cancel();
			void session.leave(async () => {
				leaveTarget = target.href;
				try {
					await goto(target);
				} finally {
					leaveTarget = null;
				}
			});
			return;
		}
		if (navigation.willUnload) {
			if (session.editor.unsaved) navigation.cancel();
			return;
		}
		session.navigationAccepted(target?.pathname, navigation.type);
	});
	afterNavigate(() => {
		document.querySelector<HTMLElement>('.application-shell')?.scrollTo({ top: 0, left: 0 });
		document.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
	});
	import { runMigrationOnce } from '$lib/services/cache/migration';

	let { children } = $props();

	onMount(() => {
		// Remove legacy localStorage API keys on first visit after proxy migration.
		runMigrationOnce().catch((e) => console.warn('[migration] failed:', e));
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="application-shell">
	{@render children()}

	<div class="session-status" dir="rtl">
		{#if session.editor.error}<p role="alert">{session.editor.error}</p>{/if}
		{#if session.editor.downloaded}<p role="status" data-testid="grid-download">
				{messages.downloaded}
				{session.editor.downloaded}
			</p>{/if}
		{#if session.editor.pending}<EditorDecision
				kind={session.editor.pending}
				invalid={Boolean(session.editor.draftError) || !session.editor.source}
				busy={session.editor.saving}
				error={session.editor.error}
				onChoice={session.editor.resolvePending}
			/>{/if}
	</div>
</div>

<style>
	.application-shell {
		block-size: 100dvh;
		overflow: auto;
		scrollbar-width: none;
	}
	.application-shell::-webkit-scrollbar {
		display: none;
	}
	.application-shell:has(> :global(.grid-page)) {
		display: flex;
		flex-direction: column;
	}
	.session-status {
		padding-inline: 12px;
		flex: none;
	}
	p {
		margin-block: 4px;
		overflow-wrap: anywhere;
	}
	[role='alert'] {
		color: #a21a1a;
	}
</style>
