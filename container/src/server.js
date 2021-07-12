import * as obs from './obs.js'
import * as srt from './srt.js'
import * as vnc from './vnc.js'

import { log, useTwitch } from './utils.js'

const version = process.env.npm_package_version || 'debug'

export const handler = async (req) => {
  const { method, body, url } = req
  const isGET = method === 'GET'
  if (url === '/') {
    if (isGET) return { status: 'ok', version }
    const b = await body()
    if (b.vnc) {
      try {
        await vnc.start(b.vnc)
        return { message: 'vnc started' }
      } catch (er) {
        return { message: 'vnc failed' }
      }
    } else if (b.twitch) {
      const user = await useTwitch(b.twitch)
      return { message: `twitch ${user ? 'enabled' : 'failed'}` }
    }
    throw new BadRequestError('?')
  } else if (url === '/obs') {
    if (isGET) {
      return {
        sceneCollection: await obs.getSceneColle(),
      }
    }
    try {
      return await obs.handlePOST(await body())
    } catch (err) {
      throw new BadRequestError(err.message)
    }
  } else if (url.startsWith('/srt')) {
    if (url === '/srt' && isGET) {
      return Object.fromEntries([...srt.info.entries()].map(([k, v]) => [k, v.info]))
    }
    try {
      return await srt.handleRequest(url, (method === 'POST') ? (await body()) : null)
    } catch (err) {
      throw new BadRequestError(err.message)
    }
  }
  log('[S] unknown', [method, url])
  throw new NotFoundError(`${url} does not exist`)
}

export const wsHandler = async (ws) => {
  log('[WS] client connected')
  ws.on('message', async (msg) => {
    log('[WS] client:', msg)
  })
}

export const onShutdown = async () => {
  log('\n[S] shutting down...')
  process.exit(0)
}

class BadRequestError {
  static code = 400
  static errorName = 'Bad Request'
  constructor (message) {
    const { code, errorName } = this.constructor
    this.httpStatus = code
    this.error = errorName
    this.message = message
  }
}

class ForbiddenError extends BadRequestError {
  static code = 403
  static errorName = 'Forbidden'
}

class NotFoundError extends BadRequestError {
  static code = 404
  static errorName = 'Not Found'
}
