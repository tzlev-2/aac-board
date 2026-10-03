<script lang="ts">
	import GridEditorPage from '$lib/components/gridset/GridEditorPage.svelte';
	import { applicationSession } from '$lib/gridset/application-session.svelte';
	import { messages } from '../grid/editor-messages';
	const session = applicationSession();
</script>

<svelte:head
	><title>{session.active?.label ?? messages.emptyBoard} — Grid AAC Clone</title></svelte:head
>
{#if session.active}<GridEditorPage />{:else}
	<main dir="rtl">
		<h1 tabindex="-1">{messages.emptyBoard}</h1>
		<a href="/">{messages.selector}</a>
	</main>
{/if}

<style>
	main {
		padding: 20px;
	}
	a {
		display: inline-flex;
		align-items: center;
		min-block-size: 44px;
		padding-inline: 8px;
	}
</style>
