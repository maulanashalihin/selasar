<script lang="ts">
	let {
		count,
		loading = false,
	}: {
		count: number
		loading?: boolean
	} = $props()

	let hasVisitors = $derived(count > 0)
</script>

<span
	class="inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap {hasVisitors ? 'bg-success/10 text-success' : 'bg-bg text-muted border border-border'}"
>
	{#if hasVisitors}
		<span class="relative flex h-2 w-2">
			<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60"></span>
			<span class="relative inline-flex h-2 w-2 rounded-full bg-success"></span>
		</span>
	{:else}
		<span class="h-2 w-2 rounded-full bg-muted"></span>
	{/if}
	{#if loading}
		…
	{:else}
		{count} current visitor{count === 1 ? '' : 's'}
	{/if}
</span>
