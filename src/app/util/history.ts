import {page} from "$app/stores"
import {stripResolvedBase} from "@app/util/paths"

export const lastPageBySpaceUrl = new Map<string, string>()

export const setupHistory = () =>
  page.subscribe($page => {
    if ($page.params.relay) {
      lastPageBySpaceUrl.set($page.params.relay, stripResolvedBase($page.url.pathname))
    }
  })
