<script lang="ts">
	import { Link, router, usePage } from '@inertiajs/svelte'
	import Layout from '../../components/Layout.svelte'
	import type { Paginated, Role, Site, User } from '../../../shared/types'

	let { users, siteCounts }: { users: Paginated<User>; siteCounts: Record<number, number> } = $props()

	const page = usePage()
	const currentUser = $derived(page.props.auth.user)

	const { currentPage, lastPage } = $derived(users.meta)

	let showForm = $state(false)
	let name = $state('')
	let email = $state('')
	let password = $state('')
	let role = $state<Role>('user')
	let allSites: Site[] = $state([])
	let userSiteIds: Record<number, number[]> = $state({})
	let expandedUserId: number | null = $state(null)
	let siteError = $state<string | null>(null)
	let sitesLoading = $state(false)
	let siteToast = $state<string | null>(null)
	let submitting = $state(false)
	let error = $state<string | null>(null)
	let nameError = $state<string | null>(null)
	let emailError = $state<string | null>(null)
	let passwordError = $state<string | null>(null)

	const inputClass =
		'w-full px-3 py-2.5 border border-border rounded-lg bg-bg text-text text-[0.95rem] focus:outline-2 focus:outline-primary focus:-outline-offset-1 focus:border-primary'

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		})
	}

	function pageUrl(p: number): string {
		return `/admin/users?page=${p}`
	}

	function openForm() {
		showForm = true
	}

	function closeForm() {
		showForm = false
		resetForm()
	}

	function resetForm() {
		name = ''
		email = ''
		password = ''
		role = 'user'
		error = null
		nameError = null
		emailError = null
		passwordError = null
	}

	function validate(): boolean {
		nameError = null
		emailError = null
		passwordError = null
		let ok = true
		if (name.trim().length < 2) {
			nameError = 'Name must be at least 2 characters.'
			ok = false
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			emailError = 'Enter a valid email address.'
			ok = false
		}
		if (password.length < 8) {
			passwordError = 'Password must be at least 8 characters.'
			ok = false
		}
		return ok
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault()
		error = null
		if (!validate()) return
		submitting = true
		try {
			const res = await fetch('/admin/api/users', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-inertia': 'true',
				},
				body: JSON.stringify({
					name: name.trim(),
					email: email.trim(),
					password,
					role,
				}),
			})
			if (!res.ok) {
				const body = await res.json().catch(() => null)
				error = body?.error ?? 'Failed to create user.'
				submitting = false
				return
			}
			closeForm()
			router.reload()
		} catch {
			error = 'Network error. Please try again.'
			submitting = false
		}
	}

	async function changeRole(u: User, newRole: Role) {
		if (newRole === u.role) return
		try {
			const res = await fetch(`/admin/api/users/${u.id}`, {
				method: 'PATCH',
				headers: {
					'content-type': 'application/json',
					'x-inertia': 'true',
				},
				body: JSON.stringify({ role: newRole }),
			})
			if (!res.ok) {
				const body = await res.json().catch(() => null)
				error = body?.error ?? 'Failed to update role.'
				return
			}
			router.reload()
		} catch {
			error = 'Network error. Please try again.'
		}
	}

	async function deleteUser(u: User) {
		if (currentUser && u.id === currentUser.id) return
		if (!confirm(`Delete user "${u.name}"? This cannot be undone.`)) return
		try {
			const res = await fetch(`/admin/api/users/${u.id}`, {
				method: 'DELETE',
				headers: { 'x-inertia': 'true' },
			})
			if (!res.ok) {
				const body = await res.json().catch(() => null)
				error = body?.error ?? 'Failed to delete user.'
				return
			}
			router.reload()
		} catch {
			error = 'Network error. Please try again.'
		}
	}

	async function loadSites() {
		try {
			const res = await fetch('/admin/api/sites', {
				headers: { 'x-inertia': 'true' },
			})
			if (res.ok) {
				const body = await res.json()
				allSites = body.sites
			}
		} catch {
			/* ignore — sites panel just won't load */
		}
	}

	async function loadUserSites(userId: number) {
		try {
			const res = await fetch(`/admin/api/users/${userId}/sites`, {
				headers: { 'x-inertia': 'true' },
			})
			if (res.ok) {
				const body = await res.json()
				userSiteIds[userId] = body.siteIds
			}
		} catch {
			userSiteIds[userId] = []
		}
	}

	async function toggleSite(userId: number, siteId: number, checked: boolean) {
		siteError = null
		try {
			const res = await fetch(
				`/admin/api/users/${userId}/sites/${siteId}`,
				{
					method: checked ? 'POST' : 'DELETE',
					headers: { 'x-inertia': 'true' },
				},
			)
			if (!res.ok) {
				siteError = 'Failed to update site access.'
				return
			}
			const current = userSiteIds[userId] ?? []
			userSiteIds[userId] = checked
				? [...current, siteId]
				: current.filter((id) => id !== siteId)
			siteCounts[userId] = userSiteIds[userId].length
			siteToast = checked ? 'Site access granted' : 'Site access removed'
			setTimeout(() => (siteToast = null), 2000)
		} catch {
			siteError = 'Network error. Please try again.'
		}
	}

	async function toggleExpand(userId: number) {
		if (expandedUserId === userId) {
			expandedUserId = null
			return
		}
		expandedUserId = userId
		if (!(userId in userSiteIds)) {
			sitesLoading = true
			await loadUserSites(userId)
			sitesLoading = false
		}
	}

	// Load all sites on mount for the assignment panel.
	$effect(() => {
		void loadSites()
	})
</script>

<svelte:head><title>User Management</title></svelte:head>

<Layout>
	<div class="flex items-center justify-between gap-4 mb-6">
		<div>
			<h1 class="text-[1.6rem] m-0 tracking-tight">User Management</h1>
			<p class="text-muted text-sm mt-0.5">
				{users.meta.total} user{users.meta.total === 1 ? '' : 's'} total
			</p>
		</div>
		{#if !showForm}
			<button class="btn btn-primary" onclick={openForm}>Create User</button>
		{/if}
	</div>

	{#if error}
		<div class="bg-danger/10 border border-danger/20 text-danger text-sm rounded-lg px-4 py-3 mb-4">
			{error}
		</div>
	{/if}

	{#if siteToast}
		<div class="bg-primary-soft border border-primary/20 text-primary text-sm rounded-lg px-4 py-3 mb-4 animate-[fade-in_0.2s_ease]">
			{siteToast}
		</div>
	{/if}

	{#if showForm}
		<form
			onsubmit={submit}
			novalidate
			class="bg-surface border border-border rounded-radius p-5 mb-6 shadow-card"
		>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-base font-semibold m-0">New User</h2>
				<button type="button" class="text-muted hover:text-text text-sm cursor-pointer" onclick={closeForm}>Cancel</button>
			</div>

			<div class="grid gap-4 mb-4">
				<div>
					<label for="name" class="block text-sm font-medium mb-1.5">Name</label>
					<input id="name" class={inputClass} bind:value={name} placeholder="Jane Doe" />
					{#if nameError}<p class="text-danger text-xs mt-1">{nameError}</p>{/if}
				</div>
				<div>
					<label for="email" class="block text-sm font-medium mb-1.5">Email</label>
					<input id="email" type="email" class={inputClass} bind:value={email} placeholder="jane@example.com" />
					{#if emailError}<p class="text-danger text-xs mt-1">{emailError}</p>{/if}
				</div>
				<div>
					<label for="password" class="block text-sm font-medium mb-1.5">Password</label>
					<input id="password" type="password" class={inputClass} bind:value={password} placeholder="Min. 8 characters" />
					{#if passwordError}<p class="text-danger text-xs mt-1">{passwordError}</p>{/if}
				</div>
				<div>
					<label for="role" class="block text-sm font-medium mb-1.5">Role</label>
					<select id="role" class={inputClass} bind:value={role}>
						<option value="user">User — access assigned sites only</option>
						<option value="admin">Admin — access all sites</option>
					</select>
				</div>
			</div>

			<button class="btn btn-primary" type="submit" disabled={submitting}>
				{submitting ? 'Creating…' : 'Create User'}
			</button>
		</form>
	{/if}

	<!-- Desktop: table (≥640px) -->
	<section class="hidden sm:block bg-surface border border-border rounded-radius shadow-card overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class="border-b border-border">
						<th class="text-left px-4 py-3 text-muted text-xs uppercase tracking-wider font-medium">Name</th>
						<th class="text-left px-4 py-3 text-muted text-xs uppercase tracking-wider font-medium">Role</th>
						<th class="text-left px-4 py-3 text-muted text-xs uppercase tracking-wider font-medium">Sites</th>
						<th class="text-left px-4 py-3 text-muted text-xs uppercase tracking-wider font-medium">Joined</th>
						<th class="text-right px-4 py-3 text-muted text-xs uppercase tracking-wider font-medium">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each users.data as u, i (u.id)}
						<tr
							class="border-b border-border transition-colors hover:bg-primary-soft/50 {i === users.data.length - 1 && expandedUserId !== u.id ? 'border-b-0' : ''}"
						>
							<td class="px-4 py-3">
								<div class="flex items-center gap-3">
									<div class="w-9 h-9 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-semibold shrink-0">
										{u.name.slice(0, 2).toUpperCase()}
									</div>
									<div class="min-w-0">
										<div class="font-medium truncate">{u.name}</div>
										<div class="text-muted text-xs truncate">{u.email}</div>
									</div>
								</div>
							</td>
							<td class="px-4 py-3">
								<select
									class="px-2.5 py-1.5 border border-border rounded-lg bg-bg text-text text-sm capitalize cursor-pointer focus:outline-2 focus:outline-primary focus:-outline-offset-1"
									value={u.role}
									onchange={(e) => changeRole(u, (e.target as HTMLSelectElement).value as Role)}
									aria-label="Role for {u.name}"
								>
									<option value="user">user</option>
									<option value="admin">admin</option>
								</select>
							</td>
							<td class="px-4 py-3">
								{#if u.role === 'admin'}
									<span class="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary-soft px-2.5 py-1 rounded-full">
										<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
											<path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
										</svg>
										All sites
									</span>
								{:else}
									<button
										class="inline-flex items-center gap-1.5 text-sm cursor-pointer text-text hover:text-primary transition-colors"
										onclick={() => toggleExpand(u.id)}
										aria-expanded={expandedUserId === u.id}
									>
										<span class="font-medium">{siteCounts[u.id] ?? 0}</span>
										<span class="text-muted">site{(siteCounts[u.id] ?? 0) === 1 ? '' : 's'}</span>
										<svg
											viewBox="0 0 24 24"
											width="14"
											height="14"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="transition-transform duration-200 {expandedUserId === u.id ? 'rotate-90' : ''}"
											aria-hidden="true"
										>
											<polyline points="9 18 15 12 9 6" />
										</svg>
									</button>
								{/if}
							</td>
							<td class="px-4 py-3 text-muted whitespace-nowrap">{formatDate(u.createdAt)}</td>
							<td class="px-4 py-3 text-right">
								<button
									class="text-danger hover:underline cursor-pointer text-sm disabled:text-muted disabled:cursor-not-allowed disabled:no-underline"
									onclick={() => deleteUser(u)}
									disabled={currentUser != null && u.id === currentUser.id}
									title={currentUser != null && u.id === currentUser.id ? 'Cannot delete your own account' : 'Delete user'}
								>Delete</button>
							</td>
						</tr>
						{#if expandedUserId === u.id && u.role !== 'admin'}
							<tr class="border-b border-border {i === users.data.length - 1 ? 'border-b-0' : ''}">
								<td colspan={5} class="px-4 py-0">
									<div class="bg-bg rounded-lg my-3 p-4 border border-border">
										<div class="flex items-center justify-between mb-3">
											<span class="text-xs font-semibold uppercase tracking-wider text-muted">Site Access</span>
											{#if siteError}
												<span class="text-danger text-xs">{siteError}</span>
											{/if}
										</div>
										{#if sitesLoading}
											<div class="flex items-center gap-2 text-muted text-sm py-2">
												<svg class="animate-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
													<path d="M21 12a9 9 0 1 1-6.219-8.56" />
												</svg>
												Loading sites…
											</div>
										{:else if allSites.length === 0}
											<p class="text-muted text-sm py-2">No sites created yet.</p>
										{:else}
											<div class="grid grid-cols-2 lg:grid-cols-3 gap-2">
												{#each allSites as site (site.id)}
													<label
														class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors {(userSiteIds[u.id] ?? []).includes(site.id) ? 'border-primary/30 bg-primary-soft/50' : 'border-border hover:bg-surface'}"
													>
														<input
															type="checkbox"
															class="accent-primary w-4 h-4 cursor-pointer shrink-0"
															checked={(userSiteIds[u.id] ?? []).includes(site.id)}
															onchange={(e) => toggleSite(u.id, site.id, (e.target as HTMLInputElement).checked)}
														/>
														<div class="min-w-0">
															<div class="text-sm font-medium truncate">{site.name}</div>
															{#if site.primaryDomain}
																<div class="text-muted text-xs truncate">{site.primaryDomain}</div>
															{/if}
														</div>
													</label>
												{/each}
											</div>
										{/if}
									</div>
								</td>
							</tr>
						{/if}
					{/each}
					{#if users.data.length === 0}
						<tr>
							<td colspan={5} class="text-center text-muted py-12">No users yet.</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</section>

	<!-- Mobile: card list (<640px) -->
	<div class="sm:hidden flex flex-col gap-3">
		{#each users.data as u (u.id)}
			<div class="bg-surface border border-border rounded-radius shadow-card p-4">
				<div class="flex items-start gap-3 mb-3">
					<div class="w-10 h-10 rounded-full bg-primary-soft text-primary flex items-center justify-center text-sm font-semibold shrink-0">
						{u.name.slice(0, 2).toUpperCase()}
					</div>
					<div class="min-w-0 flex-1">
						<div class="font-medium truncate">{u.name}</div>
						<div class="text-muted text-xs truncate">{u.email}</div>
					</div>
					<button
						class="text-danger text-sm cursor-pointer disabled:text-muted disabled:cursor-not-allowed shrink-0"
						onclick={() => deleteUser(u)}
						disabled={currentUser != null && u.id === currentUser.id}
					>Delete</button>
				</div>
				<div class="flex items-center justify-between gap-3 pt-3 border-t border-border">
					<div class="flex items-center gap-2">
						<select
							class="px-2.5 py-1.5 border border-border rounded-lg bg-bg text-text text-sm capitalize cursor-pointer focus:outline-2 focus:outline-primary focus:-outline-offset-1"
							value={u.role}
							onchange={(e) => changeRole(u, (e.target as HTMLSelectElement).value as Role)}
							aria-label="Role for {u.name}"
						>
							<option value="user">user</option>
							<option value="admin">admin</option>
						</select>
						<span class="text-muted text-xs">{formatDate(u.createdAt)}</span>
					</div>
					{#if u.role === 'admin'}
						<span class="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary-soft px-2.5 py-1 rounded-full">
							<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
							</svg>
							All sites
						</span>
					{:else}
						<button
							class="inline-flex items-center gap-1 text-sm cursor-pointer text-text shrink-0"
							onclick={() => toggleExpand(u.id)}
							aria-expanded={expandedUserId === u.id}
						>
							<span class="font-medium">{siteCounts[u.id] ?? 0}</span>
							<span class="text-muted">site{(siteCounts[u.id] ?? 0) === 1 ? '' : 's'}</span>
							<svg
								viewBox="0 0 24 24"
								width="14"
								height="14"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="transition-transform duration-200 {expandedUserId === u.id ? 'rotate-90' : ''}"
								aria-hidden="true"
							>
								<polyline points="9 18 15 12 9 6" />
							</svg>
						</button>
					{/if}
				</div>
				{#if expandedUserId === u.id && u.role !== 'admin'}
					<div class="mt-3 pt-3 border-t border-border">
						<div class="flex items-center justify-between mb-2.5">
							<span class="text-xs font-semibold uppercase tracking-wider text-muted">Site Access</span>
							{#if siteError}
								<span class="text-danger text-xs">{siteError}</span>
							{/if}
						</div>
						{#if sitesLoading}
							<div class="flex items-center gap-2 text-muted text-sm py-2">
								<svg class="animate-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
									<path d="M21 12a9 9 0 1 1-6.219-8.56" />
								</svg>
								Loading sites…
							</div>
						{:else if allSites.length === 0}
							<p class="text-muted text-sm py-2">No sites created yet.</p>
						{:else}
							<div class="grid grid-cols-1 gap-2">
								{#each allSites as site (site.id)}
									<label
										class="flex items-center gap-3 px-3 py-3 rounded-lg border cursor-pointer transition-colors {(userSiteIds[u.id] ?? []).includes(site.id) ? 'border-primary/30 bg-primary-soft/50' : 'border-border'}"
									>
										<input
											type="checkbox"
											class="accent-primary w-5 h-5 cursor-pointer shrink-0"
											checked={(userSiteIds[u.id] ?? []).includes(site.id)}
											onchange={(e) => toggleSite(u.id, site.id, (e.target as HTMLInputElement).checked)}
										/>
										<div class="min-w-0">
											<div class="text-sm font-medium truncate">{site.name}</div>
											{#if site.primaryDomain}
												<div class="text-muted text-xs truncate">{site.primaryDomain}</div>
											{/if}
										</div>
									</label>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
		{#if users.data.length === 0}
			<div class="text-center text-muted py-12">No users yet.</div>
		{/if}
	</div>

	<nav class="flex items-center justify-between gap-4 mt-4" aria-label="Pagination">
		{#if currentPage > 1}
			<Link href={pageUrl(currentPage - 1)} class="btn btn-ghost">Previous</Link>
		{:else}
			<span class="btn btn-ghost opacity-35 cursor-not-allowed" aria-disabled="true">Previous</span>
		{/if}
		<span class="text-muted text-sm">Page {currentPage} of {lastPage}</span>
		{#if currentPage < lastPage}
			<Link href={pageUrl(currentPage + 1)} class="btn btn-ghost">Next</Link>
		{:else}
			<span class="btn btn-ghost opacity-35 cursor-not-allowed" aria-disabled="true">Next</span>
		{/if}
	</nav>
</Layout>
