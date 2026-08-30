<script lang="ts">
	import Layout from '../../components/Layout.svelte'
	import type { Site } from '../../../shared/types'
	import DateRangePicker from '../../components/analytics/DateRangePicker.svelte'
	import { DATE_RANGES } from '../../lib/date-ranges'
	import EmptyState from '../../components/analytics/EmptyState.svelte'

	let { site }: { site: Site } = $props()

	type CampaignRow = { utm_campaign: string; visitors: number; pageviews: number }
	type NamedRow = { name: string; visitors: number }

	let range = $state('28d')
	const ranges = DATE_RANGES

	let campaigns = $state<CampaignRow[]>([])
	let contents = $state<NamedRow[]>([])
	let terms = $state<NamedRow[]>([])
	let sources = $state<NamedRow[]>([])
	let mediums = $state<NamedRow[]>([])
	let loading = $state(true)
	let error = $state<string | null>(null)

	// Distinct gradient per campaign, cycled through a curated palette.
	const GRADIENTS = [
		'linear-gradient(90deg, oklch(0.55 0.2 250), oklch(0.62 0.2 190))', // blue → cyan
		'linear-gradient(90deg, oklch(0.55 0.2 290), oklch(0.62 0.22 350))', // violet → fuchsia
		'linear-gradient(90deg, oklch(0.72 0.16 80), oklch(0.66 0.2 50))', // amber → orange
		'linear-gradient(90deg, oklch(0.6 0.18 160), oklch(0.6 0.14 200))', // emerald → teal
	]
	function gradient(i: number): string {
		return GRADIENTS[i % GRADIENTS.length] ?? ''
	}

	async function fetchCampaigns() {
		loading = true
		try {
			const res = await fetch(`/api/analytics/campaigns/detail?site_id=${site.id}&range=${range}`)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const data = (await res.json()) as {
				campaigns: CampaignRow[]
				contents: { utm_content: string; visitors: number }[]
				terms: { utm_term: string; visitors: number }[]
				sources: { source: string; visitors: number }[]
				mediums: { medium: string; visitors: number }[]
			}
			campaigns = data.campaigns ?? []
			contents = (data.contents ?? []).map((r) => ({ name: r.utm_content, visitors: r.visitors }))
			terms = (data.terms ?? []).map((r) => ({ name: r.utm_term, visitors: r.visitors }))
			sources = (data.sources ?? []).map((r) => ({ name: r.source, visitors: r.visitors }))
			mediums = (data.mediums ?? []).map((r) => ({ name: r.medium, visitors: r.visitors }))
			error = null
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load'
			campaigns = []
			contents = []
			terms = []
			sources = []
			mediums = []
		} finally {
			loading = false
		}
	}

	$effect(() => {
		fetchCampaigns()
	})

	let totalVisitors = $derived(campaigns.reduce((s, c) => s + c.visitors, 0))
	let totalPageviews = $derived(campaigns.reduce((s, c) => s + c.pageviews, 0))
	let maxVisitors = $derived(campaigns.length ? Math.max(...campaigns.map((c) => c.visitors)) : 0)

	function pct(visitors: number, total: number): string {
		if (!total) return '0%'
		return ((visitors / total) * 100).toFixed(1) + '%'
	}

	// Per-column totals for percentage context.
	let contentTotal = $derived(contents.reduce((s, r) => s + r.visitors, 0))
	let termTotal = $derived(terms.reduce((s, r) => s + r.visitors, 0))
	let sourceTotal = $derived(sources.reduce((s, r) => s + r.visitors, 0))
	let mediumTotal = $derived(mediums.reduce((s, r) => s + r.visitors, 0))

	function colMax(rows: NamedRow[]): number {
		return rows.length ? Math.max(...rows.map((r) => r.visitors)) : 0
	}
</script>

<svelte:head><title>Campaigns — {site.name}</title></svelte:head>

<Layout>
	<div class="flex items-center justify-between gap-4 flex-wrap mb-6">
		<div>
			<h1 class="text-[1.6rem] m-0 mb-1 tracking-tight font-bold">Campaigns</h1>
			<p class="text-muted m-0 text-sm">{site.name}</p>
		</div>
		<DateRangePicker bind:value={range} options={ranges} />
	</div>

	{#if loading}
		<div class="bg-surface shadow-card rounded-radius p-5">
			<p class="text-sm text-muted text-center py-8">Loading…</p>
		</div>
	{:else if error}
		<div class="bg-surface shadow-card rounded-radius p-5">
			<p class="text-sm text-muted text-center py-8">{error}</p>
		</div>
	{:else if campaigns.length === 0}
	<EmptyState
		icon="campaigns"
		title="No campaign data yet"
		message="UTM campaign data appears when visitors arrive via URLs with utm_source, utm_medium, or utm_campaign parameters."
		hint='Try adding UTM params to your marketing links. Example: <code class="bg-bg px-1.5 py-0.5 rounded text-xs">?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale</code>'
		actionHref={`/sites/${site.id}/analytics/tracking`}
		actionLabel="View tracking guide"
	/>
	{:else}
		<!-- Hero total: gradient banner, distinct from other pages' plain cards -->
		<div
			class="rounded-radius shadow-card mb-6 p-8 flex flex-col items-center justify-center overflow-hidden relative"
			style="background: linear-gradient(120deg, oklch(0.55 0.2 270), oklch(0.55 0.2 330))"
		>
			<div class="absolute -top-12 -right-10 w-48 h-48 rounded-full bg-white/10 blur-2xl"></div>
			<div class="absolute -bottom-16 -left-10 w-56 h-56 rounded-full bg-white/10 blur-2xl"></div>
			<span class="text-5xl font-bold tracking-tight text-white tabular-nums relative">
				{totalVisitors.toLocaleString()}
			</span>
			<span class="text-sm text-white/80 mt-2 relative">visitors from {campaigns.length}
				{campaigns.length === 1 ? 'campaign' : 'campaigns'}</span>
			<span class="text-xs text-white/60 mt-1 relative tabular-nums">
				{totalPageviews.toLocaleString()} pageviews
			</span>
		</div>

		<!-- Campaign cards: wide, gradient-accented, relative performance bar -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
			{#each campaigns as c, i (c.utm_campaign)}
				<div class="bg-surface shadow-card rounded-radius p-5 relative overflow-hidden">
					<div class="absolute top-0 left-0 w-1.5 h-full" style="background: {gradient(i)}"></div>
					<div class="flex items-start gap-3 mb-4 pl-2">
						<div
							class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
							style="background: {gradient(i)}"
						>
							<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="m3 11 18-5v12L3 14v-3z" />
								<path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
							</svg>
						</div>
						<div class="min-w-0 flex-1">
							<h3 class="text-sm font-semibold m-0 truncate">{c.utm_campaign}</h3>
							<span class="text-xs text-muted">{pct(c.visitors, totalVisitors)} of campaign traffic</span>
						</div>
					</div>

					<div class="flex items-end gap-6 mb-3 pl-2">
						<div>
							<span class="block text-2xl font-bold tabular-nums leading-none">
								{c.visitors.toLocaleString()}
							</span>
							<span class="text-xs text-muted">visitors</span>
						</div>
						<div>
							<span class="block text-2xl font-bold tabular-nums leading-none text-muted">
								{c.pageviews.toLocaleString()}
							</span>
							<span class="text-xs text-muted">pageviews</span>
						</div>
					</div>

					<!-- Relative performance bar: gradient fill on bg-primary/10 track -->
					<div class="relative h-2 rounded-full bg-primary/10 overflow-hidden pl-0">
						<div
							class="absolute inset-y-0 left-0 rounded-full"
							style="width: {maxVisitors ? (c.visitors / maxVisitors) * 100 : 0}%; background: {gradient(i)}"
						></div>
					</div>
				</div>
			{/each}
		</div>

		<!-- UTM breakdown: 4 columns, each a bar list with heading + icon -->
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
			<!-- UTM Content -->
			<div class="bg-surface shadow-card rounded-radius p-5">
				<div class="flex items-center gap-2 mb-3 border-b border-border pb-2">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted" aria-hidden="true">
						<rect x="3" y="3" width="18" height="18" rx="2" />
						<path d="M3 9h18M9 21V9" />
					</svg>
					<h2 class="text-sm font-semibold m-0">UTM Content</h2>
				</div>
				<span class="text-xs text-muted block mb-3">Ad placement</span>
				{#if contents.length === 0}
					<p class="text-sm text-muted text-center py-6">No data</p>
				{:else}
					<div class="flex flex-col">
						{#each contents as row (row.name)}
							<div class="relative h-9 rounded-md hover:bg-bg/50 px-3 flex items-center gap-2">
								<div
									class="absolute inset-y-1 left-1 right-1 rounded bg-primary/10"
									style="width: calc({(row.visitors / colMax(contents)) * 100}% - 8px)"
								></div>
								<span class="text-sm font-medium relative z-10 truncate">{row.name}</span>
								<span class="ml-auto text-sm tabular-nums relative z-10">{row.visitors.toLocaleString()}</span>
								<span class="text-muted text-sm tabular-nums relative z-10 w-12 text-right">
									{pct(row.visitors, contentTotal)}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- UTM Term -->
			<div class="bg-surface shadow-card rounded-radius p-5">
				<div class="flex items-center gap-2 mb-3 border-b border-border pb-2">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted" aria-hidden="true">
						<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
						<circle cx="7" cy="7" r="1.5" />
					</svg>
					<h2 class="text-sm font-semibold m-0">UTM Term</h2>
				</div>
				<span class="text-xs text-muted block mb-3">Keywords</span>
				{#if terms.length === 0}
					<p class="text-sm text-muted text-center py-6">No data</p>
				{:else}
					<div class="flex flex-col">
						{#each terms as row (row.name)}
							<div class="relative h-9 rounded-md hover:bg-bg/50 px-3 flex items-center gap-2">
								<div
									class="absolute inset-y-1 left-1 right-1 rounded bg-primary/10"
									style="width: calc({(row.visitors / colMax(terms)) * 100}% - 8px)"
								></div>
								<span class="text-sm font-medium relative z-10 truncate">{row.name}</span>
								<span class="ml-auto text-sm tabular-nums relative z-10">{row.visitors.toLocaleString()}</span>
								<span class="text-muted text-sm tabular-nums relative z-10 w-12 text-right">
									{pct(row.visitors, termTotal)}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- UTM Source -->
			<div class="bg-surface shadow-card rounded-radius p-5">
				<div class="flex items-center gap-2 mb-3 border-b border-border pb-2">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted" aria-hidden="true">
						<circle cx="12" cy="12" r="10" />
						<path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
					</svg>
					<h2 class="text-sm font-semibold m-0">UTM Source</h2>
				</div>
				<span class="text-xs text-muted block mb-3">Traffic source</span>
				{#if sources.length === 0}
					<p class="text-sm text-muted text-center py-6">No data</p>
				{:else}
					<div class="flex flex-col">
						{#each sources as row (row.name)}
							<div class="relative h-9 rounded-md hover:bg-bg/50 px-3 flex items-center gap-2">
								<div
									class="absolute inset-y-1 left-1 right-1 rounded bg-primary/10"
									style="width: calc({(row.visitors / colMax(sources)) * 100}% - 8px)"
								></div>
								<span class="text-sm font-medium relative z-10 truncate">{row.name}</span>
								<span class="ml-auto text-sm tabular-nums relative z-10">{row.visitors.toLocaleString()}</span>
								<span class="text-muted text-sm tabular-nums relative z-10 w-12 text-right">
									{pct(row.visitors, sourceTotal)}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- UTM Medium -->
			<div class="bg-surface shadow-card rounded-radius p-5">
				<div class="flex items-center gap-2 mb-3 border-b border-border pb-2">
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted" aria-hidden="true">
						<path d="m12 2 3.5 7L22 10l-5 5 1 7-6-3-6 3 1-7-5-5 6.5-1z" />
					</svg>
					<h2 class="text-sm font-semibold m-0">UTM Medium</h2>
				</div>
				<span class="text-xs text-muted block mb-3">Channel</span>
				{#if mediums.length === 0}
					<p class="text-sm text-muted text-center py-6">No data</p>
				{:else}
					<div class="flex flex-col">
						{#each mediums as row (row.name)}
							<div class="relative h-9 rounded-md hover:bg-bg/50 px-3 flex items-center gap-2">
								<div
									class="absolute inset-y-1 left-1 right-1 rounded bg-primary/10"
									style="width: calc({(row.visitors / colMax(mediums)) * 100}% - 8px)"
								></div>
								<span class="text-sm font-medium relative z-10 truncate">{row.name}</span>
								<span class="ml-auto text-sm tabular-nums relative z-10">{row.visitors.toLocaleString()}</span>
								<span class="text-muted text-sm tabular-nums relative z-10 w-12 text-right">
									{pct(row.visitors, mediumTotal)}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</Layout>
