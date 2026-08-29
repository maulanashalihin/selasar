<script lang="ts">
	import { Link } from '@inertiajs/svelte'

	let { href, class: className = '' }: { href: string; class?: string } = $props()
</script>

<Link
	href={href}
	class={`inline-flex items-center gap-2 font-bold text-text tracking-tight hover:no-underline ${className}`}
>
	<svg
		class="text-primary shrink-0"
		viewBox="0 0 32 32"
		width="28"
		height="28"
		fill="none"
		aria-hidden="true"
	>
		<rect x="4" y="20" width="3.5" height="6" rx="1" fill="currentColor" opacity="0.4" />
		<rect x="9" y="14" width="3.5" height="12" rx="1" fill="currentColor" opacity="0.65" />
		<rect x="14" y="8" width="3.5" height="18" rx="1" fill="currentColor" />
		<rect x="19" y="14" width="3.5" height="12" rx="1" fill="currentColor" opacity="0.65" />
		<rect x="24" y="20" width="3.5" height="6" rx="1" fill="currentColor" opacity="0.4" />
	</svg>
	<span>Selasar</span>
</Link>
