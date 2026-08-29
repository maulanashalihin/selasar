<script lang="ts">
  import type { Snippet } from 'svelte'
  import { cn } from '../../lib/cn'

  let {
    class: klass = '',
    children,
  }: { class?: string; children: Snippet } = $props()
</script>

<div class={cn('bg-surface border border-border rounded-radius shadow-card p-6', klass)}>
  {@render children()}
</div>
