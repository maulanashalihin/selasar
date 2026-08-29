<script lang="ts">
	import Layout from '../components/Layout.svelte'
	import DateRangePicker from '../components/analytics/DateRangePicker.svelte'
	import MetricCard from '../components/analytics/MetricCard.svelte'
	import LiveBadge from '../components/analytics/LiveBadge.svelte'
	import TrafficChart from '../components/analytics/TrafficChart.svelte'
	import { DATE_RANGES } from '../lib/date-ranges'

	let { site, appUrl = '' }: { site: Site; appUrl?: string } = $props()

	let range = $state('28d')
	const ranges = DATE_RANGES

	type ChartMetric = 'visitors' | 'visits' | 'pageviews' | 'bounce_rate' | 'duration' | 'views_per_visit'
	let selectedMetric = $state<ChartMetric>('visitors')

	type Overview = {
		visitors: number
		visits: number
		pageviews: number
		bounceRate: number
		avgDuration: number
		changes?: {
			visitors: number | null
			visits: number | null
			pageviews: number | null
			bounceRate: number | null
			avgDuration: number | null
		}
	}
	let overviewLoading = $state(true)
	let overview = $state<Overview | null>(null)

	type TrafficPoint = { date: string; visitors: number; pageviews: number }
	let trafficLoading = $state(true)
	let trafficData = $state<TrafficPoint[]>([])

	// All breakdown data — fetched once, all types
	let sourcesRows = $state<Record<string, unknown>[]>([])
	let channelsRows = $state<Record<string, unknown>[]>([])
	let pagesRows = $state<Record<string, unknown>[]>([])
	let entryPagesRows = $state<Record<string, unknown>[]>([])
	let exitPagesRows = $state<Record<string, unknown>[]>([])
	let devicesRows = $state<Record<string, unknown>[]>([])
	let browsersRows = $state<Record<string, unknown>[]>([])
	let osRows = $state<Record<string, unknown>[]>([])
	let geoRows = $state<Record<string, unknown>[]>([])
	let campaignsRows = $state<Record<string, unknown>[]>([])
	let visitorTypesRows = $state<{ type: string; visitors: number; visits: number; pageviews: number }[]>([])
	let conversionEvents = $state<{ event_name: string; visitors: number; total: number; conversion_rate: number }[]>([])
	let breakdownLoading = $state(true)

	let liveCount = $state(0)
	let liveLoading = $state(true)
	let copied = $state(false)
	let trackingSnippet = $derived(
		`<script async defer src="${appUrl || 'https://your-selasar-instance.com'}/tracker.js" data-tracking-id="${site.trackingId}"><\/script>`,
	)

	// Derived display values
	let visitorsDelta = $derived(overview?.changes?.visitors ?? null)
	let visitsDelta = $derived(overview?.changes?.visits ?? null)
	let pageviewsDelta = $derived(overview?.changes?.pageviews ?? null)
	let bounceDelta = $derived(overview?.changes?.bounceRate ?? null)
	let durationDelta = $derived(overview?.changes?.avgDuration ?? null)
	let hasData = $derived(overview !== null && overview.visitors > 0)
	let visitorsValue = $derived(hasData ? formatNumber(overview!.visitors) : '—')
	let visitsValue = $derived(hasData ? formatNumber(overview!.visits) : '—')
	let pageviewsValue = $derived(hasData ? formatNumber(overview!.pageviews) : '—')
	let bounceValue = $derived(hasData ? formatPercent(overview!.bounceRate) : '—')
	let durationValue = $derived(hasData ? formatDuration(overview!.avgDuration) : '—')
	let viewsPerVisit = $derived(hasData ? (overview!.pageviews / overview!.visitors).toFixed(1) : '—')

	// Derived for visuals
	let sourcesTotal = $derived(sourcesRows.reduce((s, r) => s + Number(r.visitors), 0))
	let sourcesChart = $derived(
		sourcesRows.slice(0, 3).map((r) => ({
			source: String(r.source),
			pct: sourcesTotal > 0 ? (Number(r.visitors) / sourcesTotal) * 100 : 0,
		})),
	)
	let channelsTotal = $derived(channelsRows.reduce((s, r) => s + Number(r.visitors), 0))
	let pagesMaxViews = $derived(Math.max(...pagesRows.map((r) => Number(r.views)), 1))
	let pagesTotalViews = $derived(pagesRows.reduce((s, r) => s + Number(r.views), 0))
	let entryMaxViews = $derived(Math.max(...entryPagesRows.map((r) => Number(r.views)), 1))
	let exitMaxViews = $derived(Math.max(...exitPagesRows.map((r) => Number(r.views)), 1))
	let geoTotal = $derived(geoRows.reduce((s, r) => s + Number(r.visitors), 0))
	let campaignsTotal = $derived(campaignsRows.reduce((s, r) => s + Number(r.visitors), 0))
	let visitorTypesTotal = $derived(visitorTypesRows.reduce((s, r) => s + r.visitors, 0))

	let deviceSummary = $derived.by(() => {
		const map = new Map<string, number>()
		for (const r of devicesRows) {
			const d = String(r.device)
			map.set(d, (map.get(d) ?? 0) + Number(r.visitors))
		}
		const total = Array.from(map.values()).reduce((s, v) => s + v, 0) || 1
		return Array.from(map.entries())
			.map(([device, visitors]) => ({ device, visitors, pct: Math.round((visitors / total) * 100) }))
			.sort((a, b) => b.visitors - a.visitors)
	})

	let browserSummary = $derived.by(() => {
		const map = new Map<string, number>()
		for (const r of browsersRows) {
			const b = String(r.browser)
			map.set(b, (map.get(b) ?? 0) + Number(r.visitors))
		}
		const total = Array.from(map.values()).reduce((s, v) => s + v, 0) || 1
		return Array.from(map.entries())
			.map(([browser, visitors]) => ({ browser, visitors, pct: Math.round((visitors / total) * 100) }))
			.sort((a, b) => b.visitors - a.visitors)
	})

	let osSummary = $derived.by(() => {
		const map = new Map<string, number>()
		for (const r of osRows) {
			const o = String(r.device)
			map.set(o, (map.get(o) ?? 0) + Number(r.visitors))
		}
		const total = Array.from(map.values()).reduce((s, v) => s + v, 0) || 1
		return Array.from(map.entries())
			.map(([os, visitors]) => ({ os, visitors, pct: Math.round((visitors / total) * 100) }))
			.sort((a, b) => b.visitors - a.visitors)
	})

	let maxConversionRate = $derived(Math.max(...conversionEvents.map((e) => e.conversion_rate), 1))
	let totalConversions = $derived(conversionEvents.reduce((s, e) => s + e.visitors, 0))

	const osIcons: Record<string, string> = {
		Windows: 'M3 5h8v14H3z M13 5h8v14h-8z',
		macOS: 'M14 2c0 2-2 4-4 4 M12 6c-3 0-5 3-5 7s2 9 5 9 5-5 5-9-2-7-5-7z',
		Linux: 'M12 2a4 4 0 0 0-4 4v3l-3 3a3 3 0 0 0 3 5l4 2 4-2a3 3 0 0 0 3-5l-3-3V6a4 4 0 0 0-4-4z',
		Android: 'M5 7l2 10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l2-10 M9 7V4 M15 7V4 M7 12h10',
		iOS: 'M16 2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z M11 18h2',
		Unknown: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 8v4 M12 16h.01',
	}

	const channelColors: Record<string, string> = {
		search: 'oklch(0.55 0.2 250)',
		social: 'oklch(0.6 0.2 350)',
		direct: 'oklch(0.6 0.2 150)',
		referral: 'oklch(0.6 0.2 50)',
	}

	function flagEmoji(code: string): string {
		if (!code || code.length !== 2) return '🏳️'
		return code.toUpperCase().split('').map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)).join('')
	}

	function formatNumber(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
		if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
		return n.toLocaleString('en-US')
	}
	function formatPercent(n: number): string {
		return `${Math.round(n)}%`
	}
	function formatDuration(ms: number): string {
		const totalSec = Math.round(ms / 1000)
		const m = Math.floor(totalSec / 60)
		const s = totalSec % 60
		if (m === 0) return `${s}s`
		return `${m}m ${s}s`
	}

	async function copyTracking() {
		try {
			await navigator.clipboard.writeText(trackingSnippet)
			copied = true
			setTimeout(() => (copied = false), 2000)
		} catch {
			/* clipboard unavailable */
		}
	}

	async function fetchOverview(silent = false) {
		if (!silent) overviewLoading = true
		try {
			const res = await fetch(`/api/analytics/overview?site_id=${site.id}&range=${range}`)
			if (!res.ok) throw new Error('overview failed')
			overview = (await res.json()) as Overview
		} catch {
			overview = null
		} finally {
			overviewLoading = false
		}
	}

	async function fetchTraffic(silent = false) {
		if (!silent) trafficLoading = true
		try {
			const res = await fetch(`/api/analytics/traffic?site_id=${site.id}&range=${range}&metric=${selectedMetric}`)
			if (!res.ok) throw new Error('traffic failed')
			const body = await res.json()
			trafficData = (body.data ?? []) as TrafficPoint[]
		} catch {
			trafficData = []
		} finally {
			trafficLoading = false
		}
	}

	async function fetchAllBreakdowns() {
		breakdownLoading = true
		const base = `/api/analytics`
		const params = `site_id=${site.id}&range=${range}`
		try {
		const [
			sourcesRes, channelsRes, pagesRes, entryRes, exitRes,
			devicesRes, browsersRes, osRes, geoRes, campaignsRes, conversionsRes, visitorTypesRes,
		] = await Promise.all([
			fetch(`${base}/sources?${params}&type=sources`),
			fetch(`${base}/sources?${params}&type=channels`),
			fetch(`${base}/pages?${params}&type=top`),
			fetch(`${base}/pages?${params}&type=entry`),
			fetch(`${base}/pages?${params}&type=exit`),
			fetch(`${base}/devices?${params}&type=devices`),
			fetch(`${base}/devices?${params}&type=browsers`),
			fetch(`${base}/devices?${params}&type=os`),
			fetch(`${base}/geography?${params}&type=countries`),
			fetch(`${base}/campaigns?${params}`),
			fetch(`${base}/conversions?${params}`),
			fetch(`${base}/visitor-types?${params}`),
		])

		const [s, ch, p, e, ex, d, b, o, g, c, conv, vt] = await Promise.all([
			sourcesRes.json(), channelsRes.json(), pagesRes.json(), entryRes.json(), exitRes.json(),
			devicesRes.json(), browsersRes.json(), osRes.json(), geoRes.json(), campaignsRes.json(), conversionsRes.json(),
			visitorTypesRes.json(),
		])

		sourcesRows = s.sources ?? []
		channelsRows = ch.sources ?? []
		pagesRows = p.pages ?? []
		entryPagesRows = e.pages ?? []
		exitPagesRows = ex.pages ?? []
		devicesRows = d.devices ?? []
		browsersRows = b.devices ?? []
		osRows = o.devices ?? []
		geoRows = g.countries ?? []
		campaignsRows = c.campaigns ?? []
		conversionEvents = conv.events ?? []
		visitorTypesRows = vt.visitorTypes ?? []
		} catch {
			// keep existing data
		} finally {
			breakdownLoading = false
		}
	}

	async function fetchRealtime() {
		liveLoading = true
		try {
			const res = await fetch(`/api/analytics/realtime?site_id=${site.id}`)
			if (!res.ok) throw new Error('realtime failed')
			const body = await res.json()
			liveCount = body.activeVisitors ?? 0
		} catch {
			liveCount = 0
		} finally {
			liveLoading = false
		}
	}

	$effect(() => {
		void range
		void site.id
		fetchOverview(true)
		fetchTraffic(true)
		fetchAllBreakdowns()
	})

	$effect(() => {
		void selectedMetric
		void range
		void site.id
		fetchTraffic(true)
	})

	$effect(() => {
		void site.id
		fetchRealtime()
		const interval = setInterval(fetchRealtime, 30000)
		return () => clearInterval(interval)
	})
</script>

<svelte:head><title>Analytics — {site.name}</title></svelte:head>

<Layout>
	<!-- Top bar -->
	<div class="mb-6 flex items-center justify-between gap-4 flex-wrap">
		<div>
			<h1 class="text-[1.6rem] m-0 mb-1 tracking-tight font-bold">{site.name}</h1>
			<p class="text-muted text-sm m-0">{site.primaryDomain ?? 'No domain set'}</p>
		</div>
		<div class="flex items-center gap-3">
			<LiveBadge count={liveCount} loading={liveLoading} />
			<DateRangePicker bind:value={range} options={ranges} />
		</div>
	</div>

	<!-- Metric cards + chart -->
	<div class="relative w-full bg-surface rounded-radius shadow-card mb-6">
		<div class="flex relative border-b border-border overflow-x-auto">
			<MetricCard label="Unique Visitors" value={visitorsValue} delta={visitorsDelta} loading={overviewLoading} selected={selectedMetric === 'visitors'} onclick={() => (selectedMetric = 'visitors')} />
			<div class="border-l border-border my-3"></div>
			<MetricCard label="Total Visits" value={visitsValue} delta={visitsDelta} loading={overviewLoading} selected={selectedMetric === 'visits'} onclick={() => (selectedMetric = 'visits')} />
			<div class="border-l border-border my-3"></div>
			<MetricCard label="Total Pageviews" value={pageviewsValue} delta={pageviewsDelta} loading={overviewLoading} selected={selectedMetric === 'pageviews'} onclick={() => (selectedMetric = 'pageviews')} />
			<div class="border-l border-border my-3"></div>
			<MetricCard label="Views per Visit" value={viewsPerVisit} loading={overviewLoading} selected={selectedMetric === 'views_per_visit'} onclick={() => (selectedMetric = 'views_per_visit')} />
			<div class="border-l border-border my-3"></div>
			<MetricCard label="Bounce Rate" value={bounceValue} delta={bounceDelta} loading={overviewLoading} selected={selectedMetric === 'bounce_rate'} onclick={() => (selectedMetric = 'bounce_rate')} />
			<div class="border-l border-border my-3"></div>
			<MetricCard label="Visit Duration" value={durationValue} delta={durationDelta} loading={overviewLoading} selected={selectedMetric === 'duration'} onclick={() => (selectedMetric = 'duration')} />
		</div>
		<TrafficChart data={trafficData} loading={trafficLoading} metric={selectedMetric === 'visits' ? 'visitors' : selectedMetric === 'views_per_visit' ? 'visitors' : selectedMetric === 'bounce_rate' ? 'visitors' : selectedMetric === 'duration' ? 'visitors' : selectedMetric} />
	</div>

	{#if breakdownLoading}
		<div class="flex items-center justify-center py-24">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary"></div>
		</div>
	{:else if !hasData}
		<!-- Empty state: no data yet -->
		<div class="bg-surface shadow-card rounded-radius p-12 mb-6 flex flex-col items-center justify-center text-center">
			<div class="w-16 h-16 rounded-2xl bg-bg flex items-center justify-center mb-5">
				<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted" aria-hidden="true">
					<path d="M3 3v18h18" />
					<path d="M7 14l4-4 4 4 6-6" />
				</svg>
			</div>
			<h2 class="text-lg font-semibold m-0 mb-2">No data yet</h2>
			<p class="text-sm text-muted m-0 mb-6 max-w-sm">
				Install the tracker on your site to start collecting analytics. It takes less than a minute.
			</p>
		<div class="bg-bg rounded-lg max-w-lg w-full text-left overflow-hidden">
			<div class="flex items-center justify-between px-4 py-2.5 border-b border-border">
				<p class="text-xs font-semibold text-muted uppercase tracking-wide m-0">Tracker Installation</p>
				<button
					type="button"
					class="text-xs font-medium text-muted hover:text-text transition-colors flex items-center gap-1"
					onclick={copyTracking}
				>
					{#if copied}
						<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
						Copied
					{:else}
						<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
						Copy
					{/if}
				</button>
			</div>
			<pre class="p-4 overflow-x-auto text-sm text-text m-0 font-mono leading-relaxed"><code>{trackingSnippet}</code></pre>
		</div>
		<a href={`/sites/${site.id}/analytics/tracking`} class="mt-5 text-sm text-primary hover:text-primary-hover font-medium">View tracking guide →</a>
		</div>
	{:else}
		<!-- Sources: channels donut + full source list -->
		<div class="bg-surface shadow-card rounded-radius p-5 mb-6">
			<div class="flex items-center justify-between border-b border-border pb-2 mb-4">
				<h3 class="m-0 text-sm font-semibold">Traffic Sources</h3>
				<a href={`/sites/${site.id}/analytics/sources`} class="text-xs text-primary hover:text-primary-hover font-medium">View full →</a>
			</div>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<!-- Channels donut -->
				<div class="flex flex-col items-center">
					<div class="relative w-28 h-28 mb-3">
						<div class="w-28 h-28 rounded-full" style={`background: conic-gradient(${
							channelsRows.map((r, i) => {
								const prev = channelsRows.slice(0, i).reduce((s, x) => s + (Number(x.visitors) / (channelsTotal || 1)) * 100, 0)
								const curr = (Number(r.visitors) / (channelsTotal || 1)) * 100
								const color = channelColors[String(r.source)] ?? 'oklch(0.6 0.1 200)'
								return `${color} ${prev}% ${prev + curr}%`
							}).join(', ')
						})`}></div>
						<div class="absolute inset-0 m-auto w-16 h-16 bg-surface rounded-full flex items-center justify-center">
							<span class="text-sm font-bold tabular-nums">{channelsRows.length}</span>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-x-4 gap-y-1.5">
						{#each channelsRows as row (row.source)}
							<div class="flex items-center gap-1.5 text-xs">
								<span class="w-2.5 h-2.5 rounded-full shrink-0" style={`background: ${channelColors[String(row.source)] ?? 'oklch(0.6 0.1 200)'}`}></span>
								<span class="font-medium capitalize">{row.source}</span>
								<span class="text-muted tabular-nums">{Math.round((Number(row.visitors) / (channelsTotal || 1)) * 100)}%</span>
							</div>
						{/each}
					</div>
				</div>

				<!-- Full source list -->
				<div class="md:col-span-2 flex flex-col gap-1">
					{#each sourcesRows as row (row.source)}
						<div class="relative h-8 rounded-md hover:bg-bg/50 px-3 flex items-center gap-3 overflow-hidden">
							<div class="absolute inset-y-0.5 left-0.5 rounded bg-primary/10" style={`width: calc(${(Number(row.visitors) / (sourcesTotal || 1)) * 100}% - 4px)`}></div>
							{#if String(row.source) === '(direct)'}
								<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="text-muted relative z-10 shrink-0" aria-hidden="true">
									<circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
								</svg>
							{:else}
								<img src="https://icons.duckduckgo.com/ip3/{row.source}.ico" alt="" class="w-3.5 h-3.5 rounded-sm relative z-10 shrink-0" onerror={(e) => (e.currentTarget.style.display = 'none')} />
							{/if}
							<span class="text-sm font-medium relative z-10 truncate flex-1 min-w-0">{row.source}</span>
							<span class="text-sm tabular-nums text-muted relative z-10 shrink-0 w-10 text-right">{Math.round((Number(row.visitors) / (sourcesTotal || 1)) * 100)}%</span>
							<span class="text-sm tabular-nums relative z-10 shrink-0 w-16 text-right">{Number(row.visitors).toLocaleString()}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Pages: top + entry + exit side by side -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
			<!-- Top Pages -->
			<div class="bg-surface shadow-card rounded-radius p-5">
				<div class="flex items-center justify-between border-b border-border pb-2 mb-3">
					<h3 class="m-0 text-sm font-semibold">Top Pages</h3>
					<a href={`/sites/${site.id}/analytics/pages`} class="text-xs text-primary hover:text-primary-hover font-medium">Full →</a>
				</div>
				<div class="flex flex-col gap-1">
					{#each pagesRows.slice(0, 8) as row (row.page_path)}
						<div class="relative h-8 rounded-md hover:bg-bg/50 px-3 flex items-center overflow-hidden">
							<div class="absolute inset-y-0.5 left-0.5 rounded bg-primary/10" style={`width: calc(${(Number(row.views) / (pagesMaxViews || 1)) * 100}% - 4px)`}></div>
							<span class="text-sm font-medium relative z-10 truncate flex-1 min-w-0">{row.page_path}</span>
							<span class="text-sm tabular-nums text-muted relative z-10 shrink-0 ml-2">{Number(row.views).toLocaleString()}</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- Entry Pages -->
			<div class="bg-surface shadow-card rounded-radius p-5">
				<h3 class="m-0 text-sm font-semibold border-b border-border pb-2 mb-3">Entry Pages</h3>
				<div class="flex flex-col gap-1">
					{#each entryPagesRows.slice(0, 8) as row (row.page_path)}
						<div class="relative h-8 rounded-md hover:bg-bg/50 px-3 flex items-center overflow-hidden">
							<div class="absolute inset-y-0.5 left-0.5 rounded bg-primary/10" style={`width: calc(${(Number(row.views) / (entryMaxViews || 1)) * 100}% - 4px)`}></div>
							<span class="text-sm font-medium relative z-10 truncate flex-1 min-w-0">{row.page_path}</span>
							<span class="text-sm tabular-nums text-muted relative z-10 shrink-0 ml-2">{Number(row.views).toLocaleString()}</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- Exit Pages -->
			<div class="bg-surface shadow-card rounded-radius p-5">
				<h3 class="m-0 text-sm font-semibold border-b border-border pb-2 mb-3">Exit Pages</h3>
				<div class="flex flex-col gap-1">
					{#each exitPagesRows.slice(0, 8) as row (row.page_path)}
						<div class="relative h-8 rounded-md hover:bg-bg/50 px-3 flex items-center overflow-hidden">
							<div class="absolute inset-y-0.5 left-0.5 rounded bg-primary/10" style={`width: calc(${(Number(row.views) / (exitMaxViews || 1)) * 100}% - 4px)`}></div>
							<span class="text-sm font-medium relative z-10 truncate flex-1 min-w-0">{row.page_path}</span>
							<span class="text-sm tabular-nums text-muted relative z-10 shrink-0 ml-2">{Number(row.views).toLocaleString()}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Devices + Browsers + OS: 3 columns -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
			<!-- Device types -->
			<div class="bg-surface shadow-card rounded-radius p-5">
				<div class="flex items-center justify-between border-b border-border pb-2 mb-3">
					<h3 class="m-0 text-sm font-semibold">Devices</h3>
					<a href={`/sites/${site.id}/analytics/devices`} class="text-xs text-primary hover:text-primary-hover font-medium">Full →</a>
				</div>
				<div class="flex flex-col gap-3">
					{#each deviceSummary as dt (dt.device)}
						<div class="flex items-center gap-3">
							<div class="w-8 h-8 rounded-lg bg-bg flex items-center justify-center shrink-0">
								<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="text-text" aria-hidden="true">
									{#if dt.device === 'Desktop'}
										<rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" />
									{:else if dt.device === 'Mobile'}
										<rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" />
									{:else}
										<rect x="4" y="2" width="16" height="20" rx="2" /><path d="M12 18h.01" />
									{/if}
								</svg>
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center justify-between mb-1">
									<span class="text-sm font-medium">{dt.device}</span>
									<span class="text-sm tabular-nums text-muted">{dt.pct}%</span>
								</div>
								<div class="h-1.5 rounded-full bg-bg overflow-hidden">
									<div class="h-full rounded-full bg-primary transition-all duration-500" style={`width: ${dt.pct}%`}></div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Browsers -->
			<div class="bg-surface shadow-card rounded-radius p-5">
				<h3 class="m-0 text-sm font-semibold border-b border-border pb-2 mb-3">Browsers</h3>
				<div class="flex flex-col gap-3">
					{#each browserSummary as b (b.browser)}
						<div class="flex items-center gap-3">
							<div class="w-8 h-8 rounded-lg bg-bg flex items-center justify-center shrink-0">
								<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="text-text" aria-hidden="true">
									<circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0 1 10 10 M2 12a10 10 0 0 1 10-10" />
								</svg>
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center justify-between mb-1">
									<span class="text-sm font-medium">{b.browser}</span>
									<span class="text-sm tabular-nums text-muted">{b.pct}%</span>
								</div>
								<div class="h-1.5 rounded-full bg-bg overflow-hidden">
									<div class="h-full rounded-full bg-primary transition-all duration-500" style={`width: ${b.pct}%`}></div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Operating Systems -->
			<div class="bg-surface shadow-card rounded-radius p-5">
				<h3 class="m-0 text-sm font-semibold border-b border-border pb-2 mb-3">Operating Systems</h3>
				<div class="flex flex-col gap-3">
					{#each osSummary as o (o.os)}
						<div class="flex items-center gap-3">
							<div class="w-8 h-8 rounded-lg bg-bg flex items-center justify-center shrink-0">
								<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="text-text" aria-hidden="true">
									<path d={osIcons[o.os] ?? osIcons.Unknown} />
								</svg>
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center justify-between mb-1">
									<span class="text-sm font-medium">{o.os}</span>
									<span class="text-sm tabular-nums text-muted">{o.pct}%</span>
								</div>
								<div class="h-1.5 rounded-full bg-bg overflow-hidden">
									<div class="h-full rounded-full bg-primary transition-all duration-500" style={`width: ${o.pct}%`}></div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Geography: top 6 flag cards + full list -->
		<div class="bg-surface shadow-card rounded-radius p-5 mb-6">
			<div class="flex items-center justify-between border-b border-border pb-2 mb-4">
				<h3 class="m-0 text-sm font-semibold">Geography</h3>
				<a href={`/sites/${site.id}/analytics/geography`} class="text-xs text-primary hover:text-primary-hover font-medium">View full →</a>
			</div>
			<div class="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
				{#each geoRows.slice(0, 6) as row (row.country)}
					<div class="flex flex-col items-center justify-center py-3 rounded-md hover:bg-bg/50">
						<span class="text-3xl">{flagEmoji(String(row.country))}</span>
						<span class="text-sm font-bold tabular-nums mt-1">{Number(row.visitors).toLocaleString()}</span>
						<span class="text-xs text-muted tabular-nums">{Math.round((Number(row.visitors) / (geoTotal || 1)) * 100)}%</span>
					</div>
				{/each}
			</div>
			<div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 border-t border-border pt-3">
				{#each geoRows.slice(6) as row (row.country)}
					<div class="flex items-center gap-2 text-sm py-1">
						<span class="text-lg">{flagEmoji(String(row.country))}</span>
						<span class="font-medium flex-1 min-w-0 truncate uppercase">{row.country}</span>
						<span class="tabular-nums text-muted shrink-0">{Number(row.visitors).toLocaleString()}</span>
					</div>
				{/each}
			</div>
		</div>

		<!-- Campaigns (UTM) -->
	{#if visitorTypesRows.length > 0}
		<div class="bg-surface shadow-card rounded-radius p-5 mb-6">
			<h3 class="m-0 text-sm font-semibold border-b border-border pb-2 mb-4">Visitor Types</h3>
			<div class="flex items-center gap-6">
				{#each visitorTypesRows as vt (vt.type)}
					<div class="flex-1">
						<div class="flex items-center justify-between mb-2">
							<span class="text-sm font-medium capitalize">{vt.type} visitors</span>
							<span class="text-sm font-bold tabular-nums">{vt.visitors.toLocaleString()}</span>
						</div>
						<div class="h-3 rounded-full bg-bg overflow-hidden">
							<div class={`h-full rounded-full transition-all duration-500 ${vt.type === 'new' ? 'bg-gradient-to-r from-blue-500 to-cyan-400' : 'bg-gradient-to-r from-violet-500 to-fuchsia-400'}`} style={`width: ${visitorTypesTotal > 0 ? (vt.visitors / visitorTypesTotal) * 100 : 0}%`}></div>
						</div>
						<div class="flex items-center justify-between mt-1.5">
							<span class="text-xs text-muted tabular-nums">{visitorTypesTotal > 0 ? Math.round((vt.visitors / visitorTypesTotal) * 100) : 0}% of total</span>
							<span class="text-xs text-muted tabular-nums">{vt.visits.toLocaleString()} visits · {vt.pageviews.toLocaleString()} pageviews</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

		{#if campaignsRows.length > 0}
			<div class="bg-surface shadow-card rounded-radius p-5 mb-6">
				<div class="flex items-center justify-between border-b border-border pb-2 mb-3">
					<h3 class="m-0 text-sm font-semibold">Campaigns</h3>
					<a href={`/sites/${site.id}/analytics/campaigns`} class="text-xs text-primary hover:text-primary-hover font-medium">View full →</a>
				</div>
				<div class="flex flex-col gap-1">
					{#each campaignsRows as row (row.utm_campaign)}
						<div class="relative h-8 rounded-md hover:bg-bg/50 px-3 flex items-center gap-3 overflow-hidden">
							<div class="absolute inset-y-0.5 left-0.5 rounded bg-primary/10" style={`width: calc(${(Number(row.visitors) / (campaignsTotal || 1)) * 100}% - 4px)`}></div>
							<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="text-muted relative z-10 shrink-0" aria-hidden="true">
								<path d="M3 11l18-5v12L3 14v-3z M11.6 16.8a3 3 0 1 1-5.8-1.6" />
							</svg>
							<span class="text-sm font-medium relative z-10 truncate flex-1 min-w-0">{row.utm_campaign}</span>
							<span class="text-sm tabular-nums text-muted relative z-10 shrink-0 w-10 text-right">{Math.round((Number(row.visitors) / (campaignsTotal || 1)) * 100)}%</span>
							<span class="text-sm tabular-nums relative z-10 shrink-0 w-16 text-right">{Number(row.visitors).toLocaleString()}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Conversions -->
		{#if conversionEvents.length > 0}
			<div class="bg-surface shadow-card rounded-radius p-5">
				<div class="flex items-center justify-between border-b border-border pb-2 mb-4">
					<h3 class="m-0 text-sm font-semibold">Conversions</h3>
					<a href={`/sites/${site.id}/analytics/conversions`} class="text-xs text-primary hover:text-primary-hover font-medium">View full →</a>
				</div>
				<div class="flex flex-col gap-3">
					{#each conversionEvents as event (event.event_name)}
						<div class="flex items-center gap-4">
							<span class="text-sm font-medium w-40 shrink-0 truncate">{event.event_name}</span>
							<div class="flex-1 relative h-6 rounded-md bg-bg overflow-hidden">
								<div class="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500" style={`width: ${(event.conversion_rate / maxConversionRate) * 100}%`}></div>
							</div>
							<span class="text-sm font-bold tabular-nums w-12 text-right shrink-0">{event.conversion_rate}%</span>
							<span class="text-sm tabular-nums text-muted w-16 text-right shrink-0">{event.visitors.toLocaleString()}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</Layout>
