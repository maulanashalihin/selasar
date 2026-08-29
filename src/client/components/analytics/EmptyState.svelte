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

	const icons: Record<string, string> = {
		sources: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
		pages: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
		devices: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
		geography: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
		campaigns: '<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
		conversions: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
		realtime: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>',
		chart: '<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 6-6"/>',
		visitors: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
	}
</script>

<div class="bg-surface shadow-card rounded-radius p-12 flex flex-col items-center justify-center text-center">
	<div class="w-16 h-16 rounded-2xl bg-bg flex items-center justify-center mb-5">
		<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted opacity-60" aria-hidden="true">
			{@html icons[icon] ?? icons.chart}
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
