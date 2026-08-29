<script lang="ts">
	import { cn } from '../../lib/cn'

	let {
		value = $bindable(),
		options,
	}: {
		value: string
		options: { value: string; label: string; shortcut?: string }[]
	} = $props()

	let open = $state(false)
	let containerRef = $state<HTMLDivElement | null>(null)

	let selectedLabel = $derived(
		options.find((o) => o.value === value)?.label ?? 'Select range'
	)

	function toggle() {
		open = !open
	}

	function select(val: string) {
		value = val
		open = false
	}

	function handleClickOutside(e: MouseEvent) {
		if (containerRef && !containerRef.contains(e.target as Node)) {
			open = false
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('click', handleClickOutside)
			return () => document.removeEventListener('click', handleClickOutside)
		}
	})
</script>

<div class="relative" bind:this={containerRef}>
	<button
		type="button"
		onclick={toggle}
		class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text transition-colors hover:bg-bg"
	>
		<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<rect x="3" y="4" width="18" height="18" rx="2" />
			<line x1="16" y1="2" x2="16" y2="6" />
			<line x1="8" y1="2" x2="8" y2="6" />
			<line x1="3" y1="10" x2="21" y2="10" />
		</svg>
		{selectedLabel}
		<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class={cn('transition-transform', open && 'rotate-180')}>
			<polyline points="6 9 12 15 18 9" />
		</svg>
	</button>

	{#if open}
		<div
			class="absolute right-0 z-50 mt-1 min-w-[200px] rounded-md border border-border bg-surface py-1 shadow-lg"
			role="listbox"
		>
			{#each options as opt (opt.value)}
				<button
					type="button"
					onclick={() => select(opt.value)}
					class={cn(
						'flex w-full items-center justify-between px-3 py-1.5 text-sm transition-colors text-left',
						value === opt.value
							? 'bg-bg font-medium text-text'
							: 'text-muted hover:bg-bg hover:text-text',
					)}
					role="option"
					aria-selected={value === opt.value}
				>
					<span>{opt.label}</span>
					{#if opt.shortcut}
						<kbd class="ml-2 rounded border border-border px-1 text-[10px] font-mono text-muted">{opt.shortcut}</kbd>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
