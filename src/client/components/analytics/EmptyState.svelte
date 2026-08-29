<script lang="ts">
	type Props = {
		icon: string
		title: string
		message: string
		hint?: string
		actionHref?: string
		actionLabel?: string
	}

	let { icon, title, message, hint, actionHref, actionLabel }: Props = $props()

	const iconPaths: Record<string, string> = {
		sources: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
		pages: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
		devices: 'M2 3h20v14H2z M8 21h8 M12 17v4',
		geography: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z M12 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
		campaigns: 'M3 11l18-5v12L3 14v-3z M11.6 16.8a3 3 0 1 1-5.8-1.6',
		conversions: 'M22 12h-4l-3 9L9 3l-3 9H2',
		realtime: 'M13 2 3 14h9l-1 8 10-12h-9l1-8Z',
		chart: 'M3 3v18h18 M7 14l4-4 4 4 6-6',
		visitors: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0 .01 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
	}
</script>

<div class="bg-surface shadow-card rounded-radius p-12 flex flex-col items-center justify-center text-center">
	<div class="w-16 h-16 rounded-2xl bg-bg flex items-center justify-center mb-5">
		<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted opacity-60" aria-hidden="true">
			<path d={iconPaths[icon] ?? iconPaths.chart} />
		</svg>
	</div>
	<h2 class="text-lg font-semibold m-0 mb-2">{title}</h2>
	<p class="text-sm text-muted m-0 max-w-sm">{message}</p>
	{#if hint}
		<p class="text-xs text-muted mt-3 max-w-sm">
			{@html hint}
		</p>
	{/if}
	{#if actionHref && actionLabel}
		<a href={actionHref} class="mt-5 text-sm text-primary hover:text-primary-hover font-medium">{actionLabel} →</a>
	{/if}
</div>
