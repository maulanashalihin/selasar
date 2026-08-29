<script lang="ts">
	import Layout from '../../components/Layout.svelte'
	import type { Site } from '../../../shared/types'

	let { site, appUrl = '' }: { site: Site; appUrl?: string } = $props()

	let copied = $state(false)
	let trackingSnippet = $derived(
		`<script async defer src="${appUrl || 'https://your-selasar-instance.com'}/tracker.js" data-tracking-id="${site.trackingId}"><\/script>`,
	)

	async function copyTracking() {
		try {
			await navigator.clipboard.writeText(trackingSnippet)
			copied = true
			setTimeout(() => (copied = false), 2000)
		} catch {
			/* clipboard unavailable */
		}
	}

	const eventExamples = [
		{ name: 'signup_click', code: `analytics.track('signup_click', { plan: 'pro' })`, desc: 'Track when a user clicks a signup button', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0 .01 M22 11h-6 M19 8v6' },
		{ name: 'purchase', code: `analytics.track('purchase', { amount: 99, currency: 'USD' })`, desc: 'Track completed purchases with revenue data', icon: 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
		{ name: 'newsletter_signup', code: `analytics.track('newsletter_signup')`, desc: 'Track newsletter form submissions', icon: 'M22 6l-10 7L2 6 M2 6h20v12H2z' },
		{ name: 'demo_request', code: `analytics.track('demo_request', { source: 'pricing_page' })`, desc: 'Track demo request form submissions', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6' },
		{ name: 'docs_search', code: `analytics.track('docs_search', { query: 'clickhouse setup' })`, desc: 'Track documentation searches', icon: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35' },
	]

	const autoTracked = [
		{ event: 'pageview', trigger: 'On page load and SPA route change', desc: 'Automatically sent when a visitor loads any page. Also fires on SPA navigation (pushState/replaceState/popstate).' },
		{ event: 'heartbeat', trigger: 'Every 10 seconds while tab is visible', desc: 'Keeps visit duration accurate. Only fires when the tab is active and visible.' },
		{ event: 'exit', trigger: 'On page hide / tab close', desc: 'Sends final duration_ms when the visitor leaves. Uses sendBeacon for reliability.' },
	]

	const utmParams = [
		{ param: 'utm_source', example: 'google, newsletter, twitter', desc: 'The traffic source that brought the visitor' },
		{ param: 'utm_medium', example: 'cpc, email, social', desc: 'The marketing medium (cost-per-click, email, etc.)' },
		{ param: 'utm_campaign', example: 'summer_sale, product_hunt', desc: 'The specific campaign name' },
		{ param: 'utm_content', example: 'banner_top, sidebar_ad', desc: 'The ad placement or content variant' },
		{ param: 'utm_term', example: 'analytics tool, clickhouse', desc: 'The paid search keyword' },
	]
</script>

<svelte:head><title>Tracking — {site.name}</title></svelte:head>

<Layout>
	<div class="flex items-center justify-between gap-4 flex-wrap mb-6">
		<div>
			<h1 class="text-[1.6rem] m-0 mb-1 tracking-tight font-bold">Tracking Setup</h1>
			<p class="text-muted m-0 text-sm">{site.name} · Tracking ID: {site.trackingId}</p>
		</div>
	</div>

	<!-- Installation -->
	<div class="bg-surface shadow-card rounded-radius p-6 mb-6">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary" aria-hidden="true">
					<rect x="2" y="3" width="20" height="14" rx="2" />
					<path d="M8 21h8 M12 17v4" />
				</svg>
			</div>
			<div>
				<h2 class="text-base font-semibold m-0">1. Install the tracker</h2>
				<p class="text-sm text-muted m-0">Add this snippet to the <code class="text-xs px-1.5 py-0.5 rounded bg-bg font-mono">&lt;head&gt;</code> of every page you want to track.</p>
			</div>
		</div>

		<div class="rounded-lg bg-bg overflow-hidden">
			<div class="flex items-center justify-between px-4 py-2.5 border-b border-border">
				<span class="text-xs font-semibold text-muted uppercase tracking-wide">HTML Snippet</span>
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

		<div class="mt-4 flex items-start gap-2.5 text-sm text-muted">
			<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 mt-0.5" aria-hidden="true">
				<circle cx="12" cy="12" r="10" /><path d="M12 16v-4 M12 8h.01" />
			</svg>
			<span>The tracker is <strong class="text-text font-semibold">cookieless</strong> and weighs ~3KB. No consent banner needed under GDPR. It uses <code class="text-xs px-1 py-0.5 rounded bg-bg font-mono">sendBeacon</code> for reliable event delivery even on page exit.</span>
		</div>
	</div>

	<!-- Auto-tracked events -->
	<div class="bg-surface shadow-card rounded-radius p-6 mb-6">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500" aria-hidden="true">
					<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
				</svg>
			</div>
			<div>
				<h2 class="text-base font-semibold m-0">2. Automatic tracking</h2>
				<p class="text-sm text-muted m-0">These events are tracked automatically — no code needed.</p>
			</div>
		</div>

		<div class="flex flex-col gap-3">
			{#each autoTracked as item (item.event)}
				<div class="flex items-start gap-4 p-4 rounded-lg bg-bg/50">
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<code class="text-sm font-mono font-semibold text-primary">{item.event}</code>
							<span class="text-xs text-muted">· {item.trigger}</span>
						</div>
						<p class="text-sm text-muted m-0">{item.desc}</p>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Custom events -->
	<div class="bg-surface shadow-card rounded-radius p-6 mb-6">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-violet-500" aria-hidden="true">
					<path d="M3 11l18-5v12L3 14v-3z M11.6 16.8a3 3 0 1 1-5.8-1.6" />
				</svg>
			</div>
			<div>
				<h2 class="text-base font-semibold m-0">3. Track custom events</h2>
				<p class="text-sm text-muted m-0">Call <code class="text-xs px-1.5 py-0.5 rounded bg-bg font-mono">analytics.track()</code> from your JavaScript to track conversions and custom actions.</p>
			</div>
		</div>

		<div class="flex flex-col gap-3">
			{#each eventExamples as ev (ev.name)}
				<div class="flex items-start gap-4 p-4 rounded-lg bg-bg/50">
					<div class="w-9 h-9 rounded-lg bg-bg flex items-center justify-center shrink-0">
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted" aria-hidden="true">
							<path d={ev.icon} />
						</svg>
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<code class="text-sm font-mono font-semibold text-text">{ev.name}</code>
						</div>
						<p class="text-sm text-muted m-0 mb-2">{ev.desc}</p>
						<pre class="text-xs text-text bg-bg rounded-md px-3 py-2 m-0 font-mono overflow-x-auto"><code>{ev.code}</code></pre>
					</div>
				</div>
			{/each}
		</div>

		<div class="mt-4 flex items-start gap-2.5 text-sm text-muted">
			<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 mt-0.5" aria-hidden="true">
				<circle cx="12" cy="12" r="10" /><path d="M12 16v-4 M12 8h.01" />
			</svg>
			<span>Custom events appear in the <a href={`/sites/${site.id}/analytics/conversions`} class="text-primary hover:text-primary-hover font-medium">Conversions</a> page with automatic conversion rate calculation.</span>
		</div>
	</div>

	<!-- UTM Parameters -->
	<div class="bg-surface shadow-card rounded-radius p-6 mb-6">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-500" aria-hidden="true">
					<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
					<circle cx="7" cy="7" r="1.5" />
				</svg>
			</div>
			<div>
				<h2 class="text-base font-semibold m-0">4. UTM campaign tracking</h2>
				<p class="text-sm text-muted m-0">Add UTM parameters to your URLs — the tracker auto-captures them. No extra code needed.</p>
			</div>
		</div>

		<div class="rounded-lg bg-bg overflow-hidden mb-4">
			<div class="px-4 py-2.5 border-b border-border">
				<span class="text-xs font-semibold text-muted uppercase tracking-wide">Example URL</span>
			</div>
			<pre class="p-4 overflow-x-auto text-sm text-text m-0 font-mono leading-relaxed"><code>https://yoursite.com/pricing?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale&utm_content=banner_top&utm_term=analytics</code></pre>
		</div>

		<div class="flex flex-col gap-2">
			{#each utmParams as utm (utm.param)}
				<div class="flex items-start gap-4 py-2.5 border-b border-border/50 last:border-0">
					<code class="text-sm font-mono font-semibold text-primary shrink-0 w-32">{utm.param}</code>
					<div class="flex-1 min-w-0">
						<p class="text-sm text-text m-0">{utm.desc}</p>
						<p class="text-xs text-muted m-0 mt-0.5">e.g. {utm.example}</p>
					</div>
				</div>
			{/each}
		</div>

		<div class="mt-4 flex items-start gap-2.5 text-sm text-muted">
			<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 mt-0.5" aria-hidden="true">
				<circle cx="12" cy="12" r="10" /><path d="M12 16v-4 M12 8h.01" />
			</svg>
			<span>UTM campaigns appear in the <a href={`/sites/${site.id}/analytics/campaigns`} class="text-primary hover:text-primary-hover font-medium">Campaigns</a> page with full breakdown by content, term, source, and medium.</span>
		</div>
	</div>

	<!-- What gets collected -->
	<div class="bg-surface shadow-card rounded-radius p-6">
		<div class="flex items-center gap-3 mb-4">
			<div class="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
				<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-sky-500" aria-hidden="true">
					<circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
				</svg>
			</div>
			<div>
				<h2 class="text-base font-semibold m-0">5. What gets collected</h2>
				<p class="text-sm text-muted m-0">All data is stored in your ClickHouse instance. No PII, no cookies.</p>
			</div>
		</div>

		<div class="grid grid-cols-2 md:grid-cols-3 gap-3">
			{#each [
				{ label: 'Page path', value: 'URL path' },
				{ label: 'Page title', value: 'document.title' },
				{ label: 'Referrer', value: 'Referer header' },
				{ label: 'Device type', value: 'Desktop / Mobile / Tablet' },
				{ label: 'Browser', value: 'Chrome / Firefox / Safari' },
				{ label: 'Operating system', value: 'Windows / macOS / Linux' },
				{ label: 'Country', value: 'From IP (server-side)' },
				{ label: 'City', value: 'From IP (server-side)' },
				{ label: 'Visit duration', value: 'Heartbeat-based' },
				{ label: 'New vs returning', value: 'Visitor ID hash' },
				{ label: 'UTM params', value: 'From URL query' },
				{ label: 'Custom events', value: 'Via analytics.track()' },
			] as item (item.label)}
				<div class="p-3 rounded-lg bg-bg/50">
					<p class="text-sm font-medium text-text m-0">{item.label}</p>
					<p class="text-xs text-muted m-0 mt-0.5">{item.value}</p>
				</div>
			{/each}
		</div>
	</div>
</Layout>
