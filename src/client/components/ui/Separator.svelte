<script lang="ts">
  import { cn } from '../../lib/cn'

  let {
    orientation = 'horizontal' as 'horizontal' | 'vertical',
    class: klass = '',
  }: { orientation?: 'horizontal' | 'vertical'; class?: string } = $props()
</script>

{#if orientation === 'horizontal'}
  <div class={cn('w-full border-t border-border', klass)} role="separator"></div>
{:else}
  <div class={cn('h-full border-l border-border', klass)} role="separator"></div>
{/if}
