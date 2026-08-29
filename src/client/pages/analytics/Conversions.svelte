<script lang="ts">
	import Layout from '../../components/Layout.svelte'
	import type { Site } from '../../../shared/types'
	import DateRangePicker from '../../components/analytics/DateRangePicker.svelte'
	import { DATE_RANGES } from '../../lib/date-ranges'

	let { site }: { site: Site } = $props()

	type EventConversion = {
		event_name: string
		visitors: number
		total: number
		conversion_rate: number
	}

	let range = $state('28d')
	const ranges = DATE_RANGES

	let totalVisitors = $state(0)
	let events = $state<EventConversion[]>([])
	let loading = $state(true)

	// Event icon mapping
	const eventIcons: Record<string, string> = {
		signup_click: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0 .01 M22 11h-6 M19 8v6',
		demo_request: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M10 9H8 M16 13H8 M16 17H8',
		newsletter_signup: 'M4 4h16v16H4z M4 4l8 8 8-8',
		pricing_view: 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
		docs_search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.3-4.3',
	}

	// Gradient colors for bars
	const barColors = [
		'from-blue-500 to-cyan-400',
		'from-violet-500 to-purple-400',
		'from-amber-500 to-orange-400',
		'from-emerald-500 to-green-400',
		'from-rose-500 to-pink-400',
	]

	let maxRate = $derived(Math.max(...events.map((e) => e.conversion_rate), 1))
	let maxVisitors = $derived(Math.max(...events.map((e) => e.visitors), 1))
	let totalConversions = $derived(events.reduce((s, e) => s + e.visitors, 0))
	let avgRate = $derived(
		events.length > 0
			? (events.reduce((s, e) => s + e.conversion_rate, 0) / events.length).toFixed(1)
			: '0',
	)

	async function fetchConversions() {
		loading = true
		try {
			const res = await fetch(`/api/analytics/conversions?site_id=${site.id}&range=${range}`)
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const data = (await res.json()) as {
				totalVisitors: number
				events: EventConversion[]
			}
			totalVisitors = data.totalVisitors
			events = data.events ?? []
		} catch {
			events = []
		} finally {
			loading = false
		}
	}

	$effect(() => {
		fetchConversions()
	})
</script>

<svelte:head><title>Conversions — {site.name}</title></svelte:head>

<Layout>
	<div class="flex items-center justify-between gap-4 flex-wrap mb-6">
		<div>
			<h1 class="text-[1.6rem] m-0 mb-1 tracking-tight font-bold">Conversions</h1>
			<p class="text-muted m-0 text-sm">{site.name}</p>
		</div>
		<DateRangePicker bind:value={range} options={ranges} />
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-24">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"></div>
		</div>
	{:else if events.length === 0}
		<div class="bg-surface shadow-card rounded-radius p-6 flex flex-col items-center justify-center py-24">
			<svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="opacity-30 mb-4">
				<path d="M22 12h-4l-3 9L9 3l-3 9H2" />
			</svg>
			<p class="text-muted text-sm">No custom events tracked yet</p>
			<p class="text-muted text-xs mt-1">Use <code class="bg-bg px-1.5 py-0.5 rounded text-xs">analytics.track('event_name')</code> in your site</p>
		</div>
	{:else}
		<!-- Summary cards -->
		<div class="grid grid-cols-3 gap-4 mb-6">
			<div class="bg-surface shadow-card rounded-radius p-6 flex flex-col items-center justify-center">
				<span class="text-3xl font-bold tabular-nums text-text">{totalVisitors.toLocaleString()}</span>
				<span class="text-sm text-muted mt-1">total visitors</span>
			</div>
			<div class="bg-surface shadow-card rounded-radius p-6 flex flex-col items-center justify-center">
				<span class="text-3xl font-bold tabular-nums text-text">{totalConversions.toLocaleString()}</span>
				<span class="text-sm text-muted mt-1">total conversions</span>
			</div>
			<div class="bg-surface shadow-card rounded-radius p-6 flex flex-col items-center justify-center">
				<span class="text-3xl font-bold tabular-nums text-text">{avgRate}%</span>
				<span class="text-sm text-muted mt-1">avg conversion rate</span>
			</div>
		</div>

		<!-- Conversion funnel bars -->
		<div class="bg-surface shadow-card rounded-radius p-6 mb-6">
			<h3 class="m-0 text-sm font-semibold mb-5">Conversion Funnel</h3>
			<div class="flex flex-col gap-4">
				{#each events as event, i (event.event_name)}
					<div class="flex items-center gap-4">
						<!-- Event name + icon -->
						<div class="flex items-center gap-2 w-48 shrink-0">
							<div class="w-8 h-8 rounded-lg bg-bg flex items-center justify-center shrink-0">
								<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted" aria-hidden="true">
									<path d={eventIcons[event.event_name] ?? 'M22 12h-4l-3 9L9 3l-3 9H2'} />
								</svg>
							</div>
							<span class="text-sm font-medium text-text truncate">{event.event_name}</span>
						</div>

						<!-- Bar -->
						<div class="flex-1 relative h-7 rounded-md bg-bg overflow-hidden">
							<div
								class="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r {barColors[i % barColors.length]} transition-all duration-500"
								style="width: {(event.conversion_rate / maxRate) * 100}%"
							></div>
						</div>

						<!-- Rate -->
						<div class="w-16 text-right shrink-0">
							<span class="text-sm font-bold tabular-nums text-text">{event.conversion_rate}%</span>
						</div>

						<!-- Visitors -->
						<div class="w-20 text-right shrink-0">
							<span class="text-sm tabular-nums text-muted">{event.visitors.toLocaleString()}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Event detail cards -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each events as event, i (event.event_name)}
				<div class="bg-surface shadow-card rounded-radius p-5">
					<div class="flex items-center gap-3 mb-4">
						<div class="w-10 h-10 rounded-xl bg-gradient-to-br {barColors[i % barColors.length]} flex items-center justify-center shrink-0">
							<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d={eventIcons[event.event_name] ?? 'M22 12h-4l-3 9L9 3l-3 9H2'} />
							</svg>
						</div>
						<div class="min-w-0">
							<p class="text-sm font-semibold text-text m-0 truncate">{event.event_name}</p>
							<p class="text-xs text-muted m-0 mt-0.5">{event.total.toLocaleString()} events fired</p>
						</div>
					</div>

					<div class="flex items-baseline gap-2 mb-3">
						<span class="text-2xl font-bold tabular-nums text-text">{event.visitors.toLocaleString()}</span>
						<span class="text-sm text-muted">visitors</span>
					</div>

					<div class="flex items-center justify-between mb-2">
						<span class="text-xs text-muted">conversion rate</span>
						<span class="text-sm font-bold tabular-nums text-text">{event.conversion_rate}%</span>
					</div>

					<!-- Progress bar -->
					<div class="h-2 rounded-full bg-bg overflow-hidden">
						<div
							class="h-full rounded-full bg-gradient-to-r {barColors[i % barColors.length]} transition-all duration-500"
							style="width: {(event.conversion_rate / maxRate) * 100}%"
						></div>
					</div>

					<!-- Relative to total -->
					<div class="flex items-center justify-between mt-3 pt-3 border-t border-border">
						<span class="text-xs text-muted">of {totalVisitors.toLocaleString()} visitors</span>
						<span class="text-xs tabular-nums text-muted">{((event.visitors / totalVisitors) * 100).toFixed(1)}%</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</Layout>
