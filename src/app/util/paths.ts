import {resolve} from "$app/paths"
import type {Pathname} from "$app/types"

const resolvedRoot = resolve("/")
const basePrefix = resolvedRoot === "/" ? "" : resolvedRoot.replace(/\/$/, "")

export const stripResolvedBase = (path: string): Pathname => {
  if (!path) return "/"

  const stripped = basePrefix && path.startsWith(basePrefix) ? path.slice(basePrefix.length) : path

  if (!stripped) return "/"

  return (stripped.startsWith("/") ? stripped : `/${stripped}`) as Pathname
}
