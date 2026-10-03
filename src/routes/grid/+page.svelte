<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { applicationSession } from '$lib/gridset/application-session.svelte';
	import { messages } from './editor-messages';
	const session = applicationSession();
	onMount(() => {
		goto(session.active ? '/board' : '/', { replaceState: true }).catch((e) =>
			session.editor.setError(String(e))
		);
	});
</script>

<svelte:head><title>Grid AAC Clone</title></svelte:head>
<main dir="rtl">
	<h1 tabindex="-1">{messages.compatibility}</h1>
	<a href={session.active ? '/board' : '/'}
		>{session.active ? messages.resume : messages.selector}</a
	>
</main>
