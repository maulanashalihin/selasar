<script lang="ts">
	import { Link, router, usePage } from '@inertiajs/svelte'
	import Layout from '../../components/Layout.svelte'
	import type { Paginated, Role, User } from '../../../shared/types'

	let { users }: { users: Paginated<User> } = $props()

	const page = usePage()
	const currentUser = $derived(page.props.auth.user)

	const { currentPage, lastPage } = $derived(users.meta)

	let showForm = $state(false)
	let name = $state('')
	let email = $state('')
	let password = $state('')
	let role = $state<Role>('user')
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
</script>

<svelte:head><title>User Management</title></svelte:head>

<Layout>
	<h1 class="text-[1.6rem] m-0 mb-1 tracking-tight">User Management</h1>
	<p class="text-muted mb-4">
		{users.meta.total} user{users.meta.total === 1 ? '' : 's'} total.
	</p>

	{#if error}
		<p class="text-danger text-sm mb-4">{error}</p>
	{/if}

	<div class="flex items-center justify-between gap-3 mb-4">
		<span></span>
		{#if !showForm}
			<button class="btn btn-primary" onclick={openForm}>Create User</button>
		{/if}
	</div>

	{#if showForm}
		<form
			onsubmit={submit}
			novalidate
			class="bg-surface border border-border rounded-radius p-5 mb-6 shadow-card"
		>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold m-0">Create a new user</h2>
				<button
					type="button"
					class="btn btn-ghost"
					onclick={closeForm}
					disabled={submitting}
				>Cancel</button>
			</div>

			<div class="grid gap-4 mb-4">
				<div>
					<label for="user-name" class="block text-sm font-medium mb-1.5">Name</label>
					<input
						id="user-name"
						type="text"
						class={inputClass}
						bind:value={name}
						placeholder="Jane Doe"
						disabled={submitting}
					/>
					{#if nameError}
						<p class="text-danger text-xs mt-1">{nameError}</p>
					{/if}
				</div>

				<div>
					<label for="user-email" class="block text-sm font-medium mb-1.5">Email</label>
					<input
						id="user-email"
						type="text"
						class={inputClass}
						bind:value={email}
						placeholder="jane@example.com"
						disabled={submitting}
					/>
					{#if emailError}
						<p class="text-danger text-xs mt-1">{emailError}</p>
					{/if}
				</div>

				<div>
					<label for="user-password" class="block text-sm font-medium mb-1.5">Password</label>
					<input
						id="user-password"
						type="text"
						class={inputClass}
						bind:value={password}
						placeholder="At least 8 characters"
						disabled={submitting}
					/>
					{#if passwordError}
						<p class="text-danger text-xs mt-1">{passwordError}</p>
					{/if}
				</div>

				<div>
					<label for="user-role" class="block text-sm font-medium mb-1.5">Role</label>
					<select id="user-role" class={inputClass} bind:value={role} disabled={submitting}>
						<option value="user">User</option>
						<option value="admin">Admin</option>
					</select>
				</div>
			</div>

			<button class="btn btn-primary" type="submit" disabled={submitting}>
				{submitting ? 'Creating…' : 'Create User'}
			</button>
		</form>
	{/if}

	<section class="bg-surface border border-border rounded-radius p-6">
		<div class="overflow-x-auto">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr>
						<th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Name</th>
						<th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Email</th>
						<th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Role</th>
						<th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Joined</th>
						<th class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap text-muted text-xs uppercase tracking-wider bg-bg">Actions</th>
					</tr>
				</thead>
				<tbody class="[&>tr:last-child>td]:border-b-0">
					{#each users.data as u (u.id)}
						<tr class="transition-colors hover:bg-primary-soft">
							<td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">{u.name}</td>
							<td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">{u.email}</td>
							<td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
								<select
									class="px-2 py-1 border border-border rounded-lg bg-bg text-text text-sm capitalize focus:outline-2 focus:outline-primary focus:-outline-offset-1"
									value={u.role}
									onchange={(e) => changeRole(u, (e.target as HTMLSelectElement).value as Role)}
									aria-label="Role for {u.name}"
								>
									<option value="user">user</option>
									<option value="admin">admin</option>
								</select>
							</td>
							<td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">{formatDate(u.createdAt)}</td>
							<td class="text-left px-3 py-2.5 border-b border-border whitespace-nowrap">
								<button
									class="text-danger hover:underline cursor-pointer text-sm disabled:text-muted disabled:cursor-not-allowed disabled:no-underline"
									onclick={() => deleteUser(u)}
									disabled={currentUser != null && u.id === currentUser.id}
									title={currentUser != null && u.id === currentUser.id ? 'Cannot delete your own account' : 'Delete user'}
								>Delete</button>
							</td>
						</tr>
					{/each}
					{#if users.data.length === 0}
						<tr>
							<td colspan={5} class="text-center text-muted p-6">No users yet.</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</section>

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
