<script lang="ts">
	import { Link, router, usePage } from '@inertiajs/svelte'
	import type { Snippet } from 'svelte'
	import type { Role, SharedPageProps } from '../../shared/types'
	import Brand from './Brand.svelte'
	import SiteSwitcher from './SiteSwitcher.svelte'

	let { children }: { children: Snippet } = $props()

	const page = usePage<SharedPageProps>()
	const user = $derived(page.props.auth.user)
	const flash = $derived(page.flash)
	const url = $derived(page.url)
	const sites = $derived(page.props.sites ?? [])

	type Theme = 'light' | 'dark'

	function getInitialTheme(): Theme {
		if (typeof document !== 'undefined') {
			const attr = document.documentElement.getAttribute('data-theme')
			if (attr === 'light' || attr === 'dark') return attr
		}
		if (
			typeof matchMedia !== 'undefined' &&
			matchMedia('(prefers-color-scheme: dark)').matches
		) {
			return 'dark'
		}
		return 'light'
	}

	function initials(name: string): string {
		return (
			name
				.split(/\s+/)
				.filter(Boolean)
				.slice(0, 2)
				.map((s) => s[0]?.toUpperCase() ?? '')
				.join('') || '?'
		)
	}

	let theme = $state<Theme>('light')
	let sidebarOpen = $state(false)
	let skipApply = $state(true)

	// Sync state from <html data-theme> before paint.
	$effect(() => {
		theme = getInitialTheme()
	})

	// Persist + apply theme whenever the toggle changes it. Skipped on
	// initial mount (DOM already correct from inline head script).
	$effect(() => {
		if (skipApply) {
			skipApply = false
			return
		}
		const el = document.documentElement
		el.setAttribute('data-theme', theme)
		el.style.backgroundColor = theme === 'dark' ? '#0f1117' : '#f6f7fb'
		try {
			localStorage.setItem('theme', theme)
		} catch {
			/* ignore (private mode / SSR) */
		}
	})

	// Close mobile sidebar on route change.
	$effect(() => {
		url // track url
		sidebarOpen = false
	})

	const currentPath = $derived(url?.split('?')[0] ?? '')
	const siteId = $derived(() => {
		const match = currentPath.match(/^\/sites\/(\d+)/)
		return match ? match[1] : null
	})
	const showAnalyticsNav = $derived(/^\/sites\/\d+/.test(currentPath))

	type NavItem = {
		href: string
		label: string
		icon: 'overview' | 'realtime' | 'pages' | 'sources' | 'devices' | 'geography' | 'conversions' | 'sites' | 'keys' | 'profile' | 'users'
		match: (path: string) => boolean
		roles?: Role[]
	}

	const analyticsItems = $derived<NavItem[]>(
		siteId()
			? [
					{ href: `/sites/${siteId()}/analytics`, label: 'Overview', icon: 'overview', match: (p) => /^\/sites\/\d+\/analytics$/.test(p) },
					{ href: `/sites/${siteId()}/analytics/realtime`, label: 'Realtime', icon: 'realtime', match: (p) => p.startsWith('/sites/') && p.includes('/analytics/realtime') },
					{ href: `/sites/${siteId()}/analytics/pages`, label: 'Pages', icon: 'pages', match: (p) => p.startsWith('/sites/') && p.includes('/analytics/pages') },
					{ href: `/sites/${siteId()}/analytics/sources`, label: 'Sources', icon: 'sources', match: (p) => p.startsWith('/sites/') && p.includes('/analytics/sources') },
					{ href: `/sites/${siteId()}/analytics/devices`, label: 'Devices', icon: 'devices', match: (p) => p.startsWith('/sites/') && p.includes('/analytics/devices') },
					{ href: `/sites/${siteId()}/analytics/geography`, label: 'Geography', icon: 'geography', match: (p) => p.startsWith('/sites/') && p.includes('/analytics/geography') },
				{ href: `/sites/${siteId()}/analytics/conversions`, label: 'Conversions', icon: 'conversions', match: (p) => p.startsWith('/sites/') && p.includes('/analytics/conversions') },
				{ href: `/sites/${siteId()}`, label: 'Settings', icon: 'settings', match: (p) => /^\/sites\/\d+$/.test(p) },
			]
			: [],
	)

	const managementItems: NavItem[] = [
		{ href: '/sites', label: 'Sites', icon: 'sites', match: (p) => p === '/sites' || (/^\/sites\/\d+/.test(p) && !p.includes('/analytics')) },
		{ href: '/settings/keys', label: 'API Keys', icon: 'keys', match: (p) => p.startsWith('/settings/keys') },
		{ href: '/settings/profile', label: 'Profile', icon: 'profile', match: (p) => p.startsWith('/settings/profile') },
	]

	const adminItems: NavItem[] = [
		{ href: '/admin/users', label: 'Users', icon: 'users', roles: ['admin'], match: (p) => p.startsWith('/admin/users') },
	]

	const visibleManagement = $derived(managementItems)
	const visibleAdmin = $derived(
		adminItems.filter((i) => !i.roles || (user && i.roles.includes(user.role))),
	)

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark'
	}

	function handleLogout() {
		router.post('/logout')
	}
</script>

<div class="grid grid-cols-[260px_1fr] min-h-screen bg-bg max-md:grid-cols-1">
	<!-- Mobile backdrop -->
	{#if sidebarOpen}
		<div
			class="fixed inset-0 bg-black/50 z-[25] animate-[fade-in_120ms_ease]"
			aria-hidden="true"
			onclick={() => (sidebarOpen = false)}
		></div>
	{/if}

	<!-- Sidebar -->
	<aside
		class={`sticky top-0 self-start h-screen flex flex-col bg-surface border-r border-border z-30 max-md:fixed max-md:top-0 max-md:left-0 max-md:w-[280px] max-md:max-w-[85vw] max-md:-translate-x-full max-md:transition-transform max-md:shadow-card${sidebarOpen ? ' max-md:translate-x-0' : ''}`}
		aria-label="Primary"
	>
		<!-- Brand -->
		<div
			class="flex items-center justify-between gap-2 px-5 border-b border-border h-16 shrink-0"
		>
			<Brand href={user ? '/sites' : '/login'} />
			<button
				type="button"
				class="hidden items-center justify-center w-9 h-9 border border-border rounded-lg bg-transparent text-text cursor-pointer max-md:flex"
				aria-label="Close navigation"
				onclick={() => (sidebarOpen = false)}
			>
				<svg
					viewBox="0 0 24 24"
					width="20"
					height="20"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Site Switcher -->
		{#if sites.length > 0}
			<div class="px-3 py-3 border-b border-border">
				<SiteSwitcher />
			</div>
		{/if}

		<nav class="flex-1 overflow-y-auto px-3 py-4">
			<!-- Analytics section -->
			{#if showAnalyticsNav}
				<p
					class="mx-3 my-2 text-xs font-bold uppercase tracking-wider text-muted"
				>
					Analytics
				</p>
				<ul class="list-none m-0 p-0 flex flex-col gap-0.5 mb-4">
					{#each analyticsItems as item (item.href)}
						{@const active = item.match(currentPath)}
						<li>
							<Link
								href={item.href}
								class={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-text text-sm font-medium transition-colors hover:bg-primary-soft hover:no-underline${active ? ' bg-primary-soft text-primary font-semibold' : ''}`}
								aria-current={active ? 'page' : undefined}
							>
								<span
									class={`inline-flex shrink-0 ${active ? 'text-primary' : 'text-muted'}`}
								>
									{#if item.icon === 'overview'}
										<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
											<path d="M3 3v18h18" />
											<rect x="7" y="10" width="3" height="8" rx="0.5" />
											<rect x="12" y="6" width="3" height="12" rx="0.5" />
											<rect x="17" y="13" width="3" height="5" rx="0.5" />
										</svg>
									{:else if item.icon === 'realtime'}
										<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
											<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
										</svg>
									{:else if item.icon === 'pages'}
										<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
											<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
											<path d="M14 2v6h6" />
										</svg>
									{:else if item.icon === 'sources'}
										<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
											<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
											<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
										</svg>
									{:else if item.icon === 'devices'}
										<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
											<rect x="5" y="2" width="14" height="20" rx="2" />
											<path d="M12 18h.01" />
										</svg>
									{:else if item.icon === 'geography'}
										<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
											<circle cx="12" cy="12" r="10" />
											<path d="M2 12h20" />
											<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
										</svg>
									{:else if item.icon === 'conversions'}
										<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
											<circle cx="12" cy="12" r="10" />
											<circle cx="12" cy="12" r="6" />
											<circle cx="12" cy="12" r="2" />
										</svg>
								{:else if item.icon === 'settings'}
									<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<circle cx="12" cy="12" r="3" />
										<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
									</svg>
									{/if}
								</span>
								<span>{item.label}</span>
							</Link>
						</li>
					{/each}
				</ul>
			{/if}


		{#if !showAnalyticsNav}
		<!-- Management section -->
		<p
			class="mx-3 my-2 text-xs font-bold uppercase tracking-wider text-muted"
		>
			Management
		</p>
			<ul class="list-none m-0 p-0 flex flex-col gap-0.5 mb-4">
				{#each visibleManagement as item (item.href)}
					{@const active = item.match(currentPath)}
					<li>
						<Link
							href={item.href}
							class={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-text text-sm font-medium transition-colors hover:bg-primary-soft hover:no-underline${active ? ' bg-primary-soft text-primary font-semibold' : ''}`}
							aria-current={active ? 'page' : undefined}
						>
							<span
								class={`inline-flex shrink-0 ${active ? 'text-primary' : 'text-muted'}`}
							>
								{#if item.icon === 'sites'}
									<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<rect x="3" y="3" width="7" height="7" rx="1" />
										<rect x="14" y="3" width="7" height="7" rx="1" />
										<rect x="3" y="14" width="7" height="7" rx="1" />
										<rect x="14" y="14" width="7" height="7" rx="1" />
									</svg>
								{:else if item.icon === 'keys'}
									<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<circle cx="7.5" cy="15.5" r="5.5" />
										<path d="m21 2-9.6 9.6" />
										<path d="m15.5 7.5 3 3L22 7l-3-3" />
									</svg>
								{:else if item.icon === 'profile'}
									<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
										<circle cx="12" cy="7" r="4" />
									</svg>
								{/if}
							</span>
							<span>{item.label}</span>
						</Link>
					</li>
				{/each}
			</ul>
		{/if}

			<!-- Admin section -->
			{#if visibleAdmin.length > 0}
				<p
					class="mx-3 my-2 text-xs font-bold uppercase tracking-wider text-muted"
				>
					Admin
				</p>
				<ul class="list-none m-0 p-0 flex flex-col gap-0.5">
					{#each visibleAdmin as item (item.href)}
						{@const active = item.match(currentPath)}
						<li>
							<Link
								href={item.href}
								class={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-text text-sm font-medium transition-colors hover:bg-primary-soft hover:no-underline${active ? ' bg-primary-soft text-primary font-semibold' : ''}`}
								aria-current={active ? 'page' : undefined}
							>
								<span
									class={`inline-flex shrink-0 ${active ? 'text-primary' : 'text-muted'}`}
								>
									{#if item.icon === 'users'}
										<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
											<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
											<circle cx="9" cy="7" r="4" />
											<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
											<path d="M16 3.13a4 4 0 0 1 0 7.75" />
										</svg>
									{/if}
								</span>
								<span>{item.label}</span>
							</Link>
						</li>
					{/each}
				</ul>
			{/if}
		</nav>

		<!-- User info at bottom -->
		<div class="p-3 border-t border-border">
			{#if user}
				<div class="flex items-center gap-2.5 px-1 py-1.5">
					{#if user.avatarUrl}
						<img
							class="w-8 h-8 rounded-full object-cover shrink-0"
							src={user.avatarUrl}
							alt=""
						/>
					{:else}
						<span
							class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-xs font-bold shrink-0"
							aria-hidden="true"
						>
							{initials(user.name)}
						</span>
					{/if}
					<div class="flex flex-col min-w-0 flex-1">
						<span class="text-sm font-semibold truncate">{user.name}</span>
						<span class="text-xs text-muted truncate">{user.email}</span>
					</div>
					<button
						type="button"
						class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted cursor-pointer transition-colors hover:bg-primary-soft hover:text-danger shrink-0"
						aria-label="Log out"
						onclick={handleLogout}
					>
						<svg
							viewBox="0 0 24 24"
							width="16"
							height="16"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
							<path d="m16 17 5-5-5-5M21 12H9" />
						</svg>
					</button>
				</div>
			{:else}
				<div class="flex items-center gap-2">
					<Link
						href="/login"
						class="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-border rounded-lg bg-transparent text-text font-semibold text-sm cursor-pointer transition-colors hover:bg-primary-soft hover:no-underline"
					>
						Log in
					</Link>
					<Link
						href="/register"
						class="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-primary rounded-lg bg-primary text-white font-semibold text-sm cursor-pointer transition-colors hover:bg-primary-hover hover:border-primary-hover hover:no-underline"
					>
						Register
					</Link>
				</div>
			{/if}
		</div>
	</aside>

	<!-- Main column -->
	<div class="flex flex-col min-w-0">
		<header
			class="sticky top-0 z-20 flex items-center justify-between gap-4 px-5 py-2.5 bg-surface/88 backdrop-saturate-[1.8] backdrop-blur border-b border-border h-16 max-md:px-4"
		>
			<div class="flex items-center gap-3 flex-1 min-w-0">
				<button
					type="button"
					class="hidden items-center justify-center w-10 h-10 border border-border rounded-lg bg-surface text-text cursor-pointer shrink-0 max-md:flex"
					aria-label="Open navigation"
					aria-expanded={sidebarOpen}
					onclick={() => (sidebarOpen = !sidebarOpen)}
				>
					<svg
						viewBox="0 0 24 24"
						width="20"
						height="20"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M3 6h18M3 12h18M3 18h18" />
					</svg>
				</button>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<button
					type="button"
					class="inline-flex items-center justify-center w-10 h-10 border border-border rounded-lg bg-surface text-text cursor-pointer shrink-0 transition-colors hover:bg-primary-soft hover:no-underline"
					aria-label="Toggle theme"
					onclick={toggleTheme}
				>
					{#if theme === 'dark'}
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="4" />
							<path
								d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
							/>
						</svg>
					{:else}
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
						</svg>
					{/if}
				</button>
			</div>
		</header>

		{#if flash?.success}
			<div
				class="w-full max-w-[1200px] mx-auto mt-4 px-4 py-3 text-sm font-medium rounded-lg border border-green-200 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
			>
				{String(flash.success)}
			</div>
		{/if}
		{#if flash?.error}
			<div
				class="w-full max-w-[1200px] mx-auto mt-4 px-4 py-3 text-sm font-medium rounded-lg border border-red-200 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
			>
				{String(flash.error)}
			</div>
		{/if}

		<main
			class="flex-1 w-full max-w-[1200px] mx-auto px-5 py-6 max-md:px-4 max-md:py-5"
		>
			{@render children()}
		</main>

		<footer
			class="mt-auto px-5 py-3.5 flex items-center justify-center gap-3 text-muted text-xs border-t border-border max-md:px-4 max-md:py-3"
		>
			<span>Analytics</span>
		</footer>
	</div>
</div>
