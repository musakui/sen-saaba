import { create } from './common.js'

class WS extends WebSocket {
  on (name, handler) { this.addEventListener(name, handler) }
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
