<script lang="ts">
	import { cn } from '../../lib/cn'

	let { delta }: { delta: number } = $props()

	let positive = $derived(delta >= 0)
	let formatted = $derived(`${positive ? '+' : '−'}${Math.abs(delta)}%`)
</script>

<span
	class={cn(
		'inline-flex items-center text-xs font-medium',
		positive ? 'text-success' : 'text-danger',
	)}
>
	{#if positive}
		<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="inline-block mb-0.5">
			<path d="M7 17 17 7M17 7H9M17 7v8" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="inline-block mb-0.5">
			<path d="M17 7 7 17M7 17h8M7 17V9" />
		</svg>
	{/if}
	{formatted}
</span>
