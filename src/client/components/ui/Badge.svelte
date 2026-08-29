<script lang="ts">
  import { cn } from '../../lib/cn'

  type Variant = 'default' | 'success' | 'danger' | 'primary' | 'muted'

  let {
    variant = 'default' as Variant,
    class: klass = '',
    children,
  }: {
    variant?: Variant
    class?: string
    children: import('svelte').Snippet
  } = $props()

  const variants: Record<Variant, string> = {
    default: 'bg-bg text-muted border-border',
    success: 'bg-success/10 text-success border-success/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
    primary: 'bg-primary-soft text-primary border-primary/20',
    muted: 'bg-bg text-muted border-transparent',
  }
</script>

<span
  class={cn(
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
    variants[variant],
    klass,
  )}
>
  {@render children()}
</span>
