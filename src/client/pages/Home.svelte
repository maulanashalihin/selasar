<script lang="ts">
  import { Link } from '@inertiajs/svelte'
  import Brand from '../components/Brand.svelte'
  import { session } from '../session'

  const { user, loading } = $derived($session)

  // Mock data for the dashboard preview — shows what the real dashboard looks like.
  const mockMetrics = [
    { label: 'Visitors', value: '248,931', delta: '+12.4%', up: true },
    { label: 'Pageviews', value: '892,104', delta: '+8.1%', up: true },
    { label: 'Bounce Rate', value: '42.3%', delta: '-3.2%', up: true },
    { label: 'Avg. Duration', value: '1m 47s', delta: '+15s', up: true },
  ]

  const mockTraffic = [
    40, 55, 48, 62, 70, 58, 75, 82, 68, 90, 85, 95, 78, 88,
  ]

  const mockSources = [
    { name: 'google', visitors: '142,801', width: 'w-[57%]' },
    { name: '(direct)', visitors: '52,310', width: 'w-[21%]' },
    { name: 'twitter.com', visitors: '28,104', width: 'w-[11%]' },
    { name: 'linkedin.com', visitors: '15,892', width: 'w-[6%]' },
    { name: 'reddit.com', visitors: '9,824', width: 'w-[4%]' },
  ]

  const mockPages = [
    { path: '/', views: '198,402' },
    { path: '/pricing', views: '142,801' },
    { path: '/blog/getting-started', views: '89,204' },
    { path: '/docs', views: '67,103' },
    { path: '/about', views: '34,501' },
  ]

  const mockDevices = [
    { label: 'Desktop', pct: 58, width: 'w-[58%]', bar: 'bg-primary' },
    { label: 'Mobile', pct: 35, width: 'w-[35%]', bar: 'bg-primary/70' },
    { label: 'Tablet', pct: 7, width: 'w-[7%]', bar: 'bg-primary/40' },
  ]

  // Build the traffic sparkline path.
  const maxTraffic = Math.max(...mockTraffic)
  const trafficPath = mockTraffic
    .map((v, i) => {
      const x = (i / (mockTraffic.length - 1)) * 100
      const y = 30 - (v / maxTraffic) * 28
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  const features = [
    {
      title: 'ClickHouse engine',
      desc: 'Queries on millions of events return in milliseconds. MergeTree + materialized views pre-aggregate on insert.',
      icon: 'database',
    },
    {
      title: 'No cookies, no consent banner',
      desc: 'Anonymous visitor IDs hashed from IP + UA. No PII, no GDPR consent popup needed.',
      icon: 'shield',
    },
    {
      title: 'Multi-domain per site',
      desc: 'Track unlimited sites, each with multiple domains. Traffic aggregated under one entity.',
      icon: 'globe',
    },
    {
      title: 'Real-time visitors',
      desc: 'See who is on your site right now. Auto-refreshing live count with page, source, country, device breakdowns.',
      icon: 'bolt',
    },
    {
      title: '12 date ranges',
      desc: 'Today, yesterday, 24h, 7d, 28d, 91d, 12mo, MTD, last month, YTD, all time, realtime.',
      icon: 'calendar',
    },
    {
      title: 'API keys',
      desc: 'Programmatic access for integrations. SHA-256 hashed, plaintext shown once, revocable.',
      icon: 'key',
    },
  ]

  const techStack = [
    { name: 'Bun', role: 'Runtime + bundler' },
    { name: 'Hono', role: 'HTTP server' },
    { name: 'Svelte 5', role: 'Frontend (runes)' },
    { name: 'Inertia v3', role: 'SSR integration' },
    { name: 'ClickHouse', role: 'Analytics engine' },
    { name: 'Tailwind v4', role: 'Styling' },
  ]
</script>

<svelte:head><title>Selasar — Self-hosted web analytics with ClickHouse</title></svelte:head>

<!-- Hero -->
<section class="relative overflow-hidden border-b border-border">
  <!-- Background grid pattern -->
  <div
    class="absolute inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none bg-grid"
    aria-hidden="true"
  ></div>

  <div class="relative max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
    <Brand href="/" class="justify-center mb-6 text-lg" />

    <h1 class="text-[2rem] md:text-[3.5rem] font-bold m-0 mb-4 tracking-tight leading-[1.15]">
      The corridor between data and insight.
    </h1>

    <p class="text-lg md:text-xl text-muted max-w-2xl mx-auto m-0 mb-8 leading-relaxed">
      Self-hosted, open-source web analytics with ClickHouse.
      No cookies. No consent banner. Just fast, honest numbers.
    </p>

    <div class="flex gap-3 justify-center flex-wrap">
      {#if loading}
        <!-- wait for session -->
      {:else if user}
        <Link href="/sites" class="btn btn-primary text-base px-6 py-3">
          Go to Dashboard
        </Link>
      {:else}
        <Link href="/login" class="btn btn-primary text-base px-6 py-3">
          Sign in
        </Link>
      {/if}
      <a
        href="https://github.com/maulanashalihin/selasar"
        class="btn btn-ghost text-base px-6 py-3"
        rel="noopener"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.8c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85 0 1.34-.01 2.42-.01 2.75 0 .27.18.58.69.48A10.02 10.02 0 0 0 22 12c0-5.52-4.48-10-10-10z" />
        </svg>
        View on GitHub
      </a>
    </div>
  </div>
</section>

<!-- Dashboard preview — the "demo" section -->
<section class="border-b border-border bg-bg">
  <div class="max-w-5xl mx-auto px-6 py-16">
    <div class="text-center mb-10">
      <p class="text-primary text-sm font-semibold uppercase tracking-wider m-0 mb-2">
        The dashboard
      </p>
      <h2 class="text-2xl md:text-3xl font-bold m-0">
        Every number you need, nothing you don't.
      </h2>
    </div>

    <!-- Mock dashboard card -->
    <div class="bg-surface border border-border rounded-radius shadow-card overflow-hidden">
      <!-- Top bar -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-border gap-2">
        <div class="flex items-center gap-2 shrink-0">
          <span class="w-2.5 h-2.5 rounded-full bg-red-400"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-green-400"></span>
        </div>
        <span class="text-muted text-xs truncate hidden sm:inline">selasar / demo-site / analytics</span>
        <span class="text-muted text-xs shrink-0">Last 28 days</span>
      </div>

      <!-- Metric cards row -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
        {#each mockMetrics as m}
          <div class="bg-surface p-4 flex flex-col gap-1">
            <span class="text-muted text-xs">{m.label}</span>
            <span class="text-xl font-bold">{m.value}</span>
            <span class="text-xs font-medium {m.up ? 'text-success' : 'text-danger'}">
              {m.up ? '↑' : '↓'} {m.delta}
            </span>
          </div>
        {/each}
      </div>

      <!-- Traffic chart + sources -->
      <div class="grid md:grid-cols-3 gap-px bg-border">
        <!-- Chart -->
        <div class="bg-surface p-5 md:col-span-2">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-sm font-semibold m-0">Visitors over time</h3>
            <div class="flex gap-2 text-xs">
              <span class="inline-flex items-center gap-1.5 text-muted">
                <span class="w-2 h-2 rounded-full bg-primary"></span>
                Visitors
              </span>
            </div>
          </div>
          <svg viewBox="0 0 100 30" class="w-full h-24" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.2" />
                <stop offset="100%" stop-color="var(--primary)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path d={`${trafficPath} L 100 30 L 0 30 Z`} fill="url(#traffic-fill)" />
            <path d={trafficPath} fill="none" stroke="var(--primary)" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>

        <!-- Sources -->
        <div class="bg-surface p-5">
          <h3 class="text-sm font-semibold m-0 mb-4">Top sources</h3>
          <div class="flex flex-col gap-2.5">
            {#each mockSources as s}
              <div class="flex items-center justify-between text-xs">
                <span class="text-text font-medium truncate">{s.name}</span>
                <span class="text-muted shrink-0 ml-2">{s.visitors}</span>
              </div>
              <div class="h-1.5 rounded-full bg-border overflow-hidden">
                <div class={`h-full rounded-full bg-primary ${s.width}`}></div>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <!-- Pages + devices -->
      <div class="grid md:grid-cols-2 gap-px bg-border">
        <div class="bg-surface p-5">
          <h3 class="text-sm font-semibold m-0 mb-4">Top pages</h3>
          <div class="flex flex-col gap-2">
            {#each mockPages as p}
              <div class="flex items-center justify-between text-xs py-1">
                <span class="text-text font-medium truncate">{p.path}</span>
                <span class="text-muted shrink-0 ml-3">{p.views}</span>
              </div>
            {/each}
          </div>
        </div>

        <div class="bg-surface p-5">
          <h3 class="text-sm font-semibold m-0 mb-4">Devices</h3>
          <div class="flex flex-col gap-3">
            {#each mockDevices as d}
              <div>
                <div class="flex items-center justify-between text-xs mb-1">
                  <span class="text-text font-medium">{d.label}</span>
                  <span class="text-muted">{d.pct}%</span>
                </div>
                <div class="h-2 rounded-full bg-border overflow-hidden">
                  <div
                    class={`h-full rounded-full ${d.bar} ${d.width}`}
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <p class="text-center text-muted text-sm mt-6 m-0">
      This is a static preview. <Link href="/login" class="text-primary hover:underline">Sign in</Link> to explore the live dashboard with demo data.
    </p>
  </div>
</section>

<!-- Features — varied layout, not 3 equal cards -->
<section class="border-b border-border">
  <div class="max-w-5xl mx-auto px-6 py-16">
    <div class="mb-12">
      <p class="text-primary text-sm font-semibold uppercase tracking-wider m-0 mb-2">
        Features
      </p>
      <h2 class="text-2xl md:text-3xl font-bold m-0">
        Built for speed, privacy, and scale.
      </h2>
    </div>

    <div class="grid md:grid-cols-3 gap-6">
      {#each features as f, i}
        <div
          class="bg-surface border border-border rounded-radius p-6 flex flex-col gap-3
                 {i === 0 ? 'md:col-span-3 md:flex-row md:items-center md:gap-8' : ''}"
        >
          <div
            class="shrink-0 w-10 h-10 rounded-radius bg-primary-soft text-primary flex items-center justify-center
                   {i === 0 ? 'md:w-14 md:h-14' : ''}"
          >
            {#if f.icon === 'database'}
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
              </svg>
            {:else if f.icon === 'shield'}
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            {:else if f.icon === 'globe'}
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
              </svg>
            {:else if f.icon === 'bolt'}
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            {:else if f.icon === 'calendar'}
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            {:else if f.icon === 'key'}
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="7.5" cy="15.5" r="5.5" />
                <path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" />
              </svg>
            {/if}
          </div>
          <div class="flex flex-col gap-1.5">
            <h3 class="text-base font-semibold m-0">{f.title}</h3>
            <p class="text-muted text-sm m-0 leading-relaxed">{f.desc}</p>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- Tech stack -->
<section class="border-b border-border bg-bg">
  <div class="max-w-5xl mx-auto px-6 py-16">
    <div class="grid md:grid-cols-2 gap-12 items-center">
      <div>
        <p class="text-primary text-sm font-semibold uppercase tracking-wider m-0 mb-2">
          Tech stack
        </p>
        <h2 class="text-2xl md:text-3xl font-bold m-0 mb-4">
          Boring tech, done right.
        </h2>
        <p class="text-muted m-0 leading-relaxed">
          No framework churn. Every piece is stable, well-documented, and chosen
          for a reason. Bun for speed, Hono for simplicity, ClickHouse for scale,
          Svelte 5 for reactivity. Zero ORM, zero client-side state library.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        {#each techStack as t}
          <div class="bg-surface border border-border rounded-radius p-4 flex flex-col gap-1">
            <span class="font-semibold text-sm">{t.name}</span>
            <span class="text-muted text-xs">{t.role}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>

<!-- Quick start -->
<section class="border-b border-border">
  <div class="max-w-3xl mx-auto px-6 py-16">
    <div class="text-center mb-10">
      <p class="text-primary text-sm font-semibold uppercase tracking-wider m-0 mb-2">
        Quick start
      </p>
      <h2 class="text-2xl md:text-3xl font-bold m-0">
        Running in 60 seconds.
      </h2>
    </div>

    <div class="bg-surface border border-border rounded-radius overflow-hidden">
      <div class="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <span class="w-2.5 h-2.5 rounded-full bg-red-400"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-green-400"></span>
        <span class="text-muted text-xs ml-2">bash</span>
      </div>
      <pre class="p-4 text-sm overflow-x-auto m-0 leading-relaxed"><code><span class="text-muted"># Clone</span>
git clone https://github.com/maulanashalihin/selasar.git
cd selasar

<span class="text-muted"># Install + start ClickHouse</span>
bun install
clickhouse server --daemon

<span class="text-muted"># Configure + initialize</span>
cp .env.example .env
bun run ch:init
bun run db:seed
bun run ch:seed

<span class="text-muted"># Run</span>
bun run dev</code></pre>
    </div>

    <p class="text-center text-muted text-sm mt-6 m-0 px-2 break-words">
      Open <span class="font-mono text-text break-all">http://localhost:4000</span> and login with
      <span class="font-mono text-text break-all">demo@example.com</span> / <span class="font-mono text-text break-all">password123</span>
    </p>
  </div>
</section>

<!-- Final CTA -->
<section class="bg-bg">
  <div class="max-w-3xl mx-auto px-6 py-20 text-center">
    <Brand href="/" class="justify-center mb-6 text-base" />
    <h2 class="text-2xl md:text-3xl font-bold m-0 mb-3">
      Own your analytics.
    </h2>
    <p class="text-muted m-0 mb-8 max-w-xl mx-auto leading-relaxed">
      Self-host in minutes. No cookies, no consent banner, no monthly bill.
      Just your data, your server, your insight.
    </p>
    <div class="flex gap-3 justify-center flex-wrap">
      {#if loading}
        <!-- wait -->
      {:else if user}
        <Link href="/sites" class="btn btn-primary text-base px-6 py-3">
          Go to Dashboard
        </Link>
      {:else}
        <Link href="/login" class="btn btn-primary text-base px-6 py-3">
          Sign in
        </Link>
      {/if}
      <a
        href="https://github.com/maulanashalihin/selasar"
        class="btn btn-ghost text-base px-6 py-3"
        rel="noopener"
      >
        Star on GitHub
      </a>
    </div>
  </div>
</section>

<!-- Footer -->
<footer class="border-t border-border">
  <div class="max-w-5xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
    <div class="flex items-center gap-2 text-muted text-sm">
      <Brand href="/" class="text-sm" />
      <span class="text-muted">·</span>
      <span>MIT License</span>
    </div>
    <div class="flex items-center gap-4 sm:gap-5 text-sm flex-wrap justify-center">
      <a href="https://github.com/maulanashalihin/selasar" class="text-muted hover:text-text" rel="noopener">GitHub</a>
      <Link href="/login" class="text-muted hover:text-text">Sign in</Link>
      <a href="https://github.com/maulanashalihin/selasar/blob/main/CHANGELOG.md" class="text-muted hover:text-text" rel="noopener">Changelog</a>
    </div>
  </div>
</footer>
