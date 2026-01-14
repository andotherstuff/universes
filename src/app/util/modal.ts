import type {Component} from "svelte"
import {derived, writable, get} from "svelte/store"
import {randomId, always, assoc, Emitter} from "@welshman/lib"
import {goto} from "$app/navigation"
import {resolve} from "$app/paths"
import {page} from "$app/stores"
import {stripResolvedBase} from "@app/util/paths"

export type ModalOptions = {
  drawer?: boolean
  noEscape?: boolean
  fullscreen?: boolean
  replaceState?: boolean
  path?: string
}

export type Modal = {
  id: string
  component: Component
  props: Record<string, any>
  options: ModalOptions
}

export const emitter = new Emitter()

export const modals = writable<Record<string, Modal>>({})

export const modal = derived([page, modals], ([$page, $modals]) => {
  return $modals[$page.url.hash.slice(1)]
})

export const pushModal = (
  component: Component<any>,
  props: Record<string, any> = {},
  options: ModalOptions = {},
) => {
  const id = randomId()
  const path = options.path || ""
  const currentUrl = get(page).url
  const currentPath = `${currentUrl.pathname}${currentUrl.search}`
  const targetPath = (path || currentPath).split("#")[0]

  modals.update(assoc(id, {id, component, props, options}))

  goto(resolve(stripResolvedBase(`${targetPath}#${id}`)), {replaceState: options.replaceState})

  return id
}

export const pushDrawer = (
  component: Component<any>,
  props: Record<string, any> = {},
  options: ModalOptions = {},
) => pushModal(component, props, {...options, drawer: true})

export const clearModals = () => {
  modals.update(always({}))
  emitter.emit("close")
}
