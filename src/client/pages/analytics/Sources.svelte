<script lang="ts">
	import Layout from '../../components/Layout.svelte'
	import type { Site } from '../../../shared/types'
	import DateRangePicker from '../../components/analytics/DateRangePicker.svelte'
	import { DATE_RANGES } from '../../lib/date-ranges'

	let { site }: { site: Site } = $props()

	type SourceRow = {
		source: string
		medium: string
		visitors: number
		pageviews: number
	}

	type Channel = {
		medium: string
		label: string
		visitors: number
		percentage: number
		color: string
	}

	let range = $state('28d')
	const ranges = DATE_RANGES

	let rows = $state<SourceRow[]>([])
	let totalVisitors = $state(0)
	let loading = $state(true)
	let error = $state<string | null>(null)
	let channels = $state<Channel[]>([])

	const CHANNEL_COLORS: Record<string, string> = {
		organic: 'oklch(0.55 0.2 250)',
		social: 'oklch(0.6 0.2 350)',
		'(none)': 'oklch(0.6 0.2 150)',
		referral: 'oklch(0.6 0.2 50)',
	}

	const CHANNEL_LABELS: Record<string, string> = {
		organic: 'Search',
		social: 'Social',
		'(none)': 'Direct',
		referral: 'Referral',
	}

	async function fetchSources() {
		loading = true
		try {
			const res = await fetch(`/api/analytics/sources?site_id=${site.id}&range=${range}`)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const data = (await res.json()) as { totalVisitors: number; sources: SourceRow[] }
			rows = data.sources ?? []
			totalVisitors = data.totalVisitors ?? 0
			error = null
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load'
			rows = []
			totalVisitors = 0
		} finally {
			loading = false
		}
	}

	$effect(() => {
		fetchSources()
	})

	// Derive channels from rows: group by medium, sum visitors, calculate percentage
	$effect(() => {
		const groups = new Map<string, number>()
		for (const r of rows) {
			groups.set(r.medium, (groups.get(r.medium) ?? 0) + r.visitors)
		}
		const total = totalVisitors || 1
		channels = [...groups.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([medium, visitors]) => ({
				medium,
				label: CHANNEL_LABELS[medium] ?? medium,
				visitors,
				percentage: Math.round((visitors / total) * 100),
				color: CHANNEL_COLORS[medium] ?? 'oklch(0.6 0.2 250)',
			}))
	})

	// Build conic-gradient string from channel segments
	let conicGradient = $derived.by(() => {
		if (channels.length === 0) return 'oklch(0.9 0 0)'
		let acc = 0
		const stops: string[] = []
		for (const ch of channels) {
			const start = acc
			acc += ch.percentage
			stops.push(`${ch.color} ${start}% ${acc}%`)
		}
		return `conic-gradient(${stops.join(', ')})`
	})

	let maxVisitors = $derived(Math.max(...rows.map((r) => r.visitors), 1))
	let topRows = $derived(rows.slice(0, 15))
</script>

<svelte:head><title>Sources — {site.name}</title></svelte:head>

<Layout>
	<div class="flex items-center justify-between gap-4 flex-wrap mb-6">
		<div>
			<h1 class="text-[1.6rem] m-0 mb-1 tracking-tight font-bold">Sources</h1>
			<p class="text-muted m-0 text-sm">{site.name}</p>
		</div>
		<DateRangePicker bind:value={range} options={ranges} />
	</div>

	<div class="bg-surface shadow-card rounded-radius p-6 mb-6 flex flex-col items-center justify-center py-16">
		<span class="text-5xl font-bold tracking-tight text-text tabular-nums">{totalVisitors.toLocaleString()}</span>
		<span class="text-sm text-muted mt-2">total visitors this period</span>
	</div>

	<div class="bg-surface shadow-card rounded-radius p-6 mb-6">
		<h2 class="text-sm font-semibold mb-4">Traffic Channels</h2>
		<div class="relative w-32 h-32 rounded-full mx-auto" style="background: {conicGradient}">
			<div class="absolute inset-0 flex items-center justify-center">
				<div class="bg-surface w-20 h-20 rounded-full flex flex-col items-center justify-center">
					<span class="text-lg font-bold tabular-nums">{totalVisitors.toLocaleString()}</span>
				</div>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-3 mt-4">
			{#each channels as ch}
				<div class="flex items-center gap-2 text-sm">
					<span class="w-3 h-3 rounded-full shrink-0" style="background: {ch.color}"></span>
					<span class="font-medium">{ch.label}</span>
					<span class="tabular-nums">{ch.percentage}%</span>
					<span class="text-muted tabular-nums">{ch.visitors.toLocaleString()}</span>
				</div>
			{/each}
		</div>
	</div>

	<div class="bg-surface shadow-card rounded-radius p-5">
		<h2 class="text-sm font-semibold mb-3 border-b border-border pb-2">Top Sources</h2>
		{#if loading}
			<div class="py-8 text-center text-muted text-sm">Loading…</div>
		{:else if error}
			<div class="py-8 text-center text-muted text-sm">{error}</div>
		{:else if topRows.length === 0}
			<div class="py-8 text-center text-muted text-sm">No source data for this period</div>
		{:else}
			<div class="flex flex-col">
				{#each topRows as row (row.source)}
					<div class="relative h-9 rounded-md hover:bg-bg/50 px-3 flex items-center gap-3">
						<div
							class="absolute inset-y-1 left-1 right-1 rounded bg-primary/10"
							style="width: calc({(row.visitors / maxVisitors) * 100}% - 8px)"
						></div>
					{#if row.source === '(direct)'}
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="text-muted relative z-10" aria-hidden="true">
							<circle cx="12" cy="12" r="10" />
							<path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
						</svg>
					{:else}
						<img
							src="https://icons.duckduckgo.com/ip3/{row.source}.ico"
							alt=""
							class="w-4 h-4 rounded-sm relative z-10"
							onerror={(e) => {
								const svg = e.currentTarget.nextElementSibling
								if (svg) svg.style.display = 'block'
								e.currentTarget.style.display = 'none'
							}}
						/>
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="text-muted relative z-10" style="display:none" aria-hidden="true">
							<circle cx="12" cy="12" r="10" />
							<path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
						</svg>
					{/if}
						<span class="text-sm font-medium relative z-10 truncate">{row.source}</span>
						<span class="ml-auto text-sm tabular-nums relative z-10">{row.visitors.toLocaleString()}</span>
						<span class="text-muted text-sm tabular-nums relative z-10 w-12 text-right">
							{Math.round((row.visitors / totalVisitors) * 100) || 0}%
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</Layout>
