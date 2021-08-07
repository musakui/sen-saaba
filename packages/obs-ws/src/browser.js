import { create } from './common.js'

const ONCE = { once: true }

class WS extends WebSocket {
  on (name, handler) {
    this.addEventListener(name, handler)
  }

  once (name, handler) {
    this.addEventListener(name, handler, ONCE)
  }

  off (name, handler) {
    this.removeEventListener(name, handler)
  }

  emit (name, detail) {
    return this.dispatchEvent(new CustomEvent(name, { detail }))
  }
}

const parseMessage = (m) => JSON.parse(m.data)

const encoder = new TextEncoder()
const authHash = async (str) => {
  const sh = await crypto.subtle.digest('SHA-256', encoder.encode(str))
  return btoa(String.fromCharCode(...new Uint8Array(sh)))
}

export const createOBS = create({
  WS,
  authHash,
  parseMessage,
})
