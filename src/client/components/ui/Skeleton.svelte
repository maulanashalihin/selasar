<script lang="ts">
  import { cn } from '../../lib/cn'

  let {
    class: klass = '',
  }: { class?: string } = $props()
</script>

<div
  class={cn('animate-pulse rounded-radius bg-bg', klass)}
  aria-hidden="true"
></div>
