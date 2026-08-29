<script lang="ts">
	import Layout from '../../components/Layout.svelte'
	import type { Site } from '../../../shared/types'
	import DateRangePicker from '../../components/analytics/DateRangePicker.svelte'
	import { DATE_RANGES } from '../../lib/date-ranges'

	let { site }: { site: Site } = $props()

	type GeoRow = {
		country: string
		visitors: number
		pageviews: number
	}

	let range = $state('28d')
	const ranges = DATE_RANGES

	let rows = $state<GeoRow[]>([])
	let totalVisitors = $state(0)
	let loading = $state(true)
	let error = $state<string | null>(null)
	let cityRows = $state<GeoRow[]>([])

	async function fetchGeography() {
		loading = true
		try {
			const res = await fetch(`/api/analytics/geography?site_id=${site.id}&range=${range}`)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const data = (await res.json()) as { totalVisitors: number; countries: GeoRow[] }
			rows = data.countries ?? []
			totalVisitors = data.totalVisitors ?? 0
			error = null
			try {
				const cityRes = await fetch(`/api/analytics/geography?site_id=${site.id}&range=${range}&type=cities`)
				if (cityRes.ok) {
					const cityData = (await cityRes.json()) as { totalVisitors: number; countries: GeoRow[] }
					cityRows = cityData.countries ?? []
				} else {
					cityRows = []
				}
			} catch {
				cityRows = []
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load'
			rows = []
			totalVisitors = 0
		} finally {
			loading = false
		}
	}

	$effect(() => {
		fetchGeography()
	})

	function flagEmoji(code: string): string {
		if (!code || code.length !== 2) return '🏳️'
		return code
			.toUpperCase()
			.split('')
			.map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
			.join('')
	}

	let top5 = $derived(rows.slice(0, 5))
	let maxVisitors = $derived(rows.length ? Math.max(...rows.map((r) => r.visitors)) : 0)

	function pct(visitors: number): string {
		if (!totalVisitors) return '0%'
		return ((visitors / totalVisitors) * 100).toFixed(1) + '%'
	}

	let maxCityVisitors = $derived(cityRows.length ? Math.max(...cityRows.map((r) => r.visitors)) : 0)

	function pctCity(visitors: number): string {
		if (!totalVisitors) return '0%'
		return ((visitors / totalVisitors) * 100).toFixed(1) + '%'
	}
</script>

<svelte:head><title>Geography — {site.name}</title></svelte:head>

<Layout>
	<div class="flex items-center justify-between gap-4 flex-wrap mb-6">
		<div>
			<h1 class="text-[1.6rem] m-0 mb-1 tracking-tight font-bold">Geography</h1>
			<p class="text-muted m-0 text-sm">{site.name}</p>
		</div>
		<DateRangePicker bind:value={range} options={ranges} />
	</div>

	<div class="bg-surface shadow-card rounded-radius p-6 mb-6 flex flex-col items-center justify-center py-16">
		<span class="text-5xl font-bold tracking-tight text-text tabular-nums">{totalVisitors.toLocaleString()}</span>
		<span class="text-sm text-muted mt-2">total visitors this period</span>
	</div>

	{#if loading}
		<div class="bg-surface shadow-card rounded-radius p-5">
			<p class="text-sm text-muted text-center py-8">Loading…</p>
		</div>
	{:else if error}
		<div class="bg-surface shadow-card rounded-radius p-5">
			<p class="text-sm text-muted text-center py-8">{error}</p>
		</div>
	{:else if rows.length === 0}
		<div class="bg-surface shadow-card rounded-radius p-5">
			<p class="text-sm text-muted text-center py-8">No country data for this period.</p>
		</div>
	{:else}
		<div class="grid grid-cols-5 gap-4 mb-6">
			{#each top5 as row (row.country)}
				<div class="bg-surface shadow-card rounded-radius p-6 flex flex-col items-center justify-center">
					<span class="text-4xl">{flagEmoji(row.country)}</span>
					<span class="text-xs text-muted mt-2 uppercase tracking-wide">{row.country}</span>
					<span class="text-xl font-bold tabular-nums mt-1">{row.visitors.toLocaleString()}</span>
					<span class="text-sm text-muted mt-1">{pct(row.visitors)}</span>
				</div>
			{/each}
		</div>

		<div class="bg-surface shadow-card rounded-radius p-5">
			<h2 class="text-sm font-semibold mb-3 border-b border-border pb-2">All Countries</h2>
			<div class="max-h-[500px] overflow-y-auto">
				{#each rows as row (row.country)}
					<div class="relative h-9 rounded-md hover:bg-bg/50 px-3 flex items-center gap-3">
						<div
							class="absolute inset-y-1 left-1 rounded bg-primary/10"
							style="width: {maxVisitors ? (row.visitors / maxVisitors) * 100 : 0}%"
						></div>
						<span class="relative text-lg">{flagEmoji(row.country)}</span>
						<span class="relative text-sm font-medium uppercase">{row.country}</span>
						<span class="relative ml-auto text-sm tabular-nums">{row.visitors.toLocaleString()}</span>
						<span class="relative text-sm tabular-nums w-20 text-right">{row.pageviews.toLocaleString()}</span>
						<span class="relative text-sm text-muted tabular-nums w-16 text-right">{pct(row.visitors)}</span>
					</div>
				{/each}
			</div>
		</div>

		{#if cityRows.length > 0}
			<div class="bg-surface shadow-card rounded-radius p-5">
				<h2 class="text-sm font-semibold mb-3 border-b border-border pb-2 flex items-center gap-2">
					<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
						<circle cx="12" cy="10" r="3" />
					</svg>
					Top Cities
				</h2>
				<div class="max-h-[400px] overflow-y-auto">
					{#each cityRows as row (row.country)}
						<div class="relative h-9 rounded-md hover:bg-bg/50 px-3 flex items-center gap-3">
							<div
								class="absolute inset-y-1 left-1 rounded bg-primary/10"
								style="width: {maxCityVisitors ? (row.visitors / maxCityVisitors) * 100 : 0}%"
							></div>
							<span class="relative text-sm font-medium">{row.country}</span>
							<span class="relative ml-auto text-sm tabular-nums">{row.visitors.toLocaleString()}</span>
							<span class="relative text-sm tabular-nums w-20 text-right">{row.pageviews.toLocaleString()}</span>
							<span class="relative text-sm text-muted tabular-nums w-16 text-right">{pctCity(row.visitors)}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</Layout>
