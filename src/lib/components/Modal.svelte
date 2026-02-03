<script lang="ts">
  import cx from "classnames"
  import type {Snippet} from "svelte"

  interface Props {
    tag?: string
    class?: string
    children?: Snippet
    [key: string]: any
  }

  const {children, tag = "div", ...props}: Props = $props()
</script>

<svelte:element this={tag} {...props} class={cx("flex flex-col overflow-hidden", props.class)}>
  {@render children?.()}
</svelte:element>
