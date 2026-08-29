<script lang="ts">
  import type { Snippet } from 'svelte'
  import { cn } from '../../lib/cn'

  export type TabItem = { value: string; label: string }

  let {
    tabs,
    value = $bindable(),
    class: klass = '',
    children,
  }: {
    tabs: TabItem[]
    value: string
    class?: string
    children?: Snippet
  } = $props()
</script>

<div class={cn('flex items-center gap-1 border-b border-border', klass)}>
  {#each tabs as tab (tab.value)}
    <button
      type="button"
      onclick={() => (value = tab.value)}
      class={cn(
        'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
        value === tab.value
          ? 'border-primary text-text'
          : 'border-transparent text-muted hover:text-text',
      )}
      aria-selected={value === tab.value}
      role="tab"
    >
      {tab.label}
    </button>
  {/each}
</div>
{#if children}
  <div class="mt-4">{@render children()}</div>
{/if}
