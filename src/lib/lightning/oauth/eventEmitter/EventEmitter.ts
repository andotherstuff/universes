import type {EventListener, EventName, Token} from "../types"

export class EventEmitter {
  private events: Record<string, EventListener[]> = {}

  on(event: EventName, listener: EventListener) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(listener)
  }

  off(event: EventName, listener: EventListener) {
    if (!this.events[event]) return
    this.events[event] = this.events[event].filter(registered => registered !== listener)
  }

  emit(event: EventName, payload: Token | Error) {
    if (!this.events[event]) return
    this.events[event].forEach(listener => listener(payload as Token & Error))
  }
}
