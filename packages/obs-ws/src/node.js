import { createHash } from 'crypto'
import WS from 'ws'

import { create } from './common.js'

const parseMessage = (m) => JSON.parse(m)

const authHash = async (str) => {
  const h = createHash('sha256')
  h.update(str, 'utf-8')
  return h.digest('base64')
}

export const createOBS = create({
  WS,
  authHash,
  parseMessage,
})
