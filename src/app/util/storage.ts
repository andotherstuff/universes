import {on, throttle, indexBy, fromPairs, batch} from "@welshman/lib"
import {throttled} from "@welshman/store"
import {
  ALERT_ANDROID,
  ALERT_EMAIL,
  ALERT_IOS,
  ALERT_STATUS,
  ALERT_WEB,
  APP_DATA,
  BLOSSOM_SERVERS,
  DIRECT_MESSAGE_FILE,
  DIRECT_MESSAGE,
  EVENT_TIME,
  FOLLOWS,
  MESSAGING_RELAYS,
  MESSAGE,
  MUTES,
  PROFILE,
  RELAY_ADD_MEMBER,
  RELAY_JOIN,
  RELAY_LEAVE,
  RELAY_MEMBERS,
  RELAY_REMOVE_MEMBER,
  RELAYS,
  ROOM_ADD_MEMBER,
  ROOM_CREATE_PERMISSION,
  ROOM_MEMBERS,
  ROOM_ADMINS,
  ROOM_META,
  ROOM_DELETE,
  ROOM_REMOVE_MEMBER,
  ROOMS,
  THREAD,
  ZAP_GOAL,
  verifiedSymbol,
} from "@welshman/util"
import type {Zapper, TrustedEvent, RelayProfile} from "@welshman/util"
import type {RepositoryUpdate, WrapItem} from "@welshman/net"
import type {Handle, RelayStats} from "@welshman/app"
import {
  tracker,
<<<<<<< HEAD
  plaintext,
  repository,
  relaysByUrl,
  relayStatsByUrl,
  onRelayStats,
=======
  relays,
  relaysByUrl,
  relayStatsByUrl,
  repository,
>>>>>>> ac46870 (Add Turborepo build graph and tooling, switch `@welshman` deps to `workspace:*`, refactor application to match the latest `@welshman` APIs)
  handlesByNip05,
  zappersByLnurl,
  onZapper,
  onHandle,
  wrapManager,
  onRelay,
} from "@welshman/app"
import {isMobile} from "@lib/html"
import type {IDBTable} from "@lib/indexeddb"

const kinds = {
  meta: [PROFILE, FOLLOWS, MUTES, RELAYS, BLOSSOM_SERVERS, MESSAGING_RELAYS, APP_DATA, ROOMS],
  alert: [ALERT_STATUS, ALERT_EMAIL, ALERT_WEB, ALERT_IOS, ALERT_ANDROID],
  space: [RELAY_ADD_MEMBER, RELAY_REMOVE_MEMBER, RELAY_MEMBERS, RELAY_JOIN, RELAY_LEAVE],
  room: [
    ROOM_META,
    ROOM_DELETE,
    ROOM_ADMINS,
    ROOM_MEMBERS,
    ROOM_ADD_MEMBER,
    ROOM_REMOVE_MEMBER,
    ROOM_CREATE_PERMISSION,
  ],
  content: [EVENT_TIME, THREAD, MESSAGE, ZAP_GOAL, DIRECT_MESSAGE, DIRECT_MESSAGE_FILE],
}

const rankEvent = (event: TrustedEvent) => {
  if (kinds.meta.includes(event.kind)) return 9
  if (kinds.alert.includes(event.kind)) return 8
  if (kinds.space.includes(event.kind)) return 7
  if (kinds.room.includes(event.kind)) return 6
  if (!isMobile && kinds.content.includes(event.kind)) return 5
  return 0
}

const eventsAdapter = {
  name: "events",
  keyPath: "id",
  init: async (table: IDBTable<TrustedEvent>) => {
    const initialEvents = await table.getAll()

    // Mark events verified to avoid re-verification of signatures
    for (const event of initialEvents) {
      event[verifiedSymbol] = true
    }

    repository.load(initialEvents)

    return on(
      repository,
      "update",
      batch(3000, async (updates: RepositoryUpdate[]) => {
        const add: TrustedEvent[] = []
        const remove = new Set<string>()

        for (const update of updates) {
          for (const event of update.added) {
            if (rankEvent(event) > 0) {
              add.push(event)
              remove.delete(event.id)
            }
          }

          for (const id of update.removed) {
            remove.add(id)
          }
        }

        if (add.length > 0) {
          await table.bulkPut(add)
        }

        if (remove.size > 0) {
          await table.bulkDelete(remove)
        }
      }),
    )
  },
}

type TrackerItem = {id: string; relays: string[]}

const trackerAdapter = {
  name: "tracker",
  keyPath: "id",
  init: async (table: IDBTable<TrackerItem>) => {
    const relaysById = new Map<string, Set<string>>()

    for (const {id, relays} of await table.getAll()) {
      relaysById.set(id, new Set(relays))
    }

    tracker.load(relaysById)

    const _onAdd = async (ids: Iterable<string>) => {
      const items: TrackerItem[] = []

      for (const id of ids) {
        const event = repository.getEvent(id)

        if (!event || rankEvent(event) === 0) continue

        const relays = Array.from(tracker.getRelays(id))

        if (relays.length === 0) continue

        items.push({id, relays})
      }

      await table.bulkPut(items)
    }

    const _onRemove = async (ids: Iterable<string>) => {
      await table.bulkDelete(Array.from(ids))
    }

    const onAdd = batch(3000, _onAdd)

    const onRemove = batch(3000, _onRemove)

    const onLoad = () => _onAdd(tracker.relaysById.keys())

    const onClear = () => _onRemove(tracker.relaysById.keys())

    tracker.on("add", onAdd)
    tracker.on("remove", onRemove)
    tracker.on("load", onLoad)
    tracker.on("clear", onClear)

    return () => {
      tracker.off("add", onAdd)
      tracker.off("remove", onRemove)
      tracker.off("load", onLoad)
      tracker.off("clear", onClear)
    }
  },
}

const relaysAdapter = {
  name: "relays",
  keyPath: "url",
  init: async (table: IDBTable<RelayProfile>) => {
    relaysByUrl.set(indexBy(r => r.url, await table.getAll()))

    return onRelay(batch(1000, table.bulkPut))
  },
}

const relayStatsAdapter = {
  name: "relayStats",
  keyPath: "url",
  init: async (table: IDBTable<RelayStats>) => {
    relayStatsByUrl.set(indexBy(r => r.url, await table.getAll()))

<<<<<<< HEAD
    return onRelayStats(batch(1000, table.bulkPut))
  },
=======
  relaysByUrl.set(new Map((await collection.get()).map(relay => [relay.url, relay])))

  return throttled(3000, relays).subscribe(collection.set)
>>>>>>> ac46870 (Add Turborepo build graph and tooling, switch `@welshman` deps to `workspace:*`, refactor application to match the latest `@welshman` APIs)
}

const handlesAdapter = {
  name: "handles",
  keyPath: "nip05",
  init: async (table: IDBTable<Handle>) => {
    handlesByNip05.set(indexBy(r => r.nip05, await table.getAll()))

<<<<<<< HEAD
    return onHandle(batch(1000, table.bulkPut))
  },
=======
  relayStatsByUrl.set(new Map((await collection.get()).map(stats => [stats.url, stats])))

  return throttled(3000, relayStatsByUrl).subscribe($relayStatsByUrl =>
    collection.set(Array.from($relayStatsByUrl.values())),
  )
>>>>>>> ac46870 (Add Turborepo build graph and tooling, switch `@welshman` deps to `workspace:*`, refactor application to match the latest `@welshman` APIs)
}

const zappersAdapter = {
  name: "zappers",
  keyPath: "lnurl",
  init: async (table: IDBTable<Zapper>) => {
    zappersByLnurl.set(indexBy(z => z.lnurl, await table.getAll()))

<<<<<<< HEAD
    return onZapper(batch(3000, table.bulkPut))
  },
=======
  handlesByNip05.set(new Map((await collection.get()).map(handle => [handle.nip05, handle])))

  return onHandle(batch(3000, collection.add))
>>>>>>> ac46870 (Add Turborepo build graph and tooling, switch `@welshman` deps to `workspace:*`, refactor application to match the latest `@welshman` APIs)
}

type PlaintextItem = {key: string; value: string}

<<<<<<< HEAD
const plaintextAdapter = {
  name: "plaintext",
  keyPath: "key",
  init: async (table: IDBTable<PlaintextItem>) => {
    const initialRecords = await table.getAll()
=======
  zappersByLnurl.set(new Map((await collection.get()).map(zapper => [zapper.lnurl, zapper])))
>>>>>>> ac46870 (Add Turborepo build graph and tooling, switch `@welshman` deps to `workspace:*`, refactor application to match the latest `@welshman` APIs)

    plaintext.set(fromPairs(initialRecords.map(({key, value}) => [key, value])))

    return throttled(3000, plaintext).subscribe($plaintext => {
      table.bulkPut(Object.entries($plaintext).map(([key, value]) => ({key, value})))
    })
  },
}

const wrapManagerAdapter = {
  name: "wrapManager",
  keyPath: "id",
  init: async (table: IDBTable<WrapItem>) => {
    wrapManager.load(await table.getAll())

    const addOne = batch(3000, table.bulkPut)

    const removeOne = throttle(3000, table.bulkDelete)

    wrapManager.on("add", addOne)
    wrapManager.on("remove", removeOne)

    return () => {
      wrapManager.off("add", addOne)
      wrapManager.off("remove", removeOne)
    }
  },
}

export const adapters = [
  eventsAdapter,
  trackerAdapter,
  relaysAdapter,
  relayStatsAdapter,
  handlesAdapter,
  zappersAdapter,
  plaintextAdapter,
  wrapManagerAdapter,
]
