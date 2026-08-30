<script lang="ts">
	import { cn } from '../../lib/cn'
	import DeltaBadge from './DeltaBadge.svelte'
	import Skeleton from '../ui/Skeleton.svelte'

	let {
		label,
		value,
		delta = null,
		loading = false,
		selected = false,
		onclick = undefined,
	}: {
		label: string
		value: string | number
		delta?: number | null
		loading?: boolean
		selected?: boolean
		onclick?: () => void
	} = $props()
</script>

<div
	class={cn(
		'flex-1 px-3 py-2.5 sm:px-4 sm:py-3 lg:py-2 lg:w-auto group select-none border-b border-r border-border lg:border-0',
		onclick && 'cursor-pointer',
	)}
	role={onclick ? 'button' : undefined}
	tabindex={onclick ? 0 : undefined}
	{onclick}
>
	<div
		class={cn(
			'flex flex-col gap-y-1 p-2 -mx-2 rounded-md transition-colors',
			onclick && 'hover:bg-bg/80',
			selected && 'bg-primary-soft',
		)}
	>
		<span
			style="letter-spacing: -0.01em"
			class={cn(
			'text-[10px] sm:text-xs uppercase tracking-[-0.01em] font-bold leading-tight sm:whitespace-nowrap sm:flex sm:w-fit',
				selected ? 'text-text' : 'text-muted group-hover:text-text',
			)}
		>
			{label}
		</span>

		{#if loading}
			<Skeleton class="h-5 w-20" />
		{:else}
			<span class="flex items-baseline whitespace-nowrap gap-2">
			<span class="font-bold text-xl sm:text-2xl text-text tabular-nums">
					{value}
				</span>
				{#if delta !== null}
					<DeltaBadge {delta} />
				{/if}
			</span>
		{/if}
	</div>
</div>
