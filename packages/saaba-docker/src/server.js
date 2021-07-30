import * as obs from './obs.js'
import * as srt from './srt.js'
import * as vnc from './vnc.js'
import * as twitch from './twitch.js'

import { log } from './utils.js'

const version = process.env.npm_package_version || 'debug'

const sockets = new Map()

const updateStats = async (proc) => {
  for (const send of sockets.values()) send('SrtInit', proc.info)
  for await (const evt of proc.events()) {
    // TODO: low bitrate / disconnect handling

    const name = evt.info ? 'SrtInfo' : 'SrtStat'
    for (const send of sockets.values()) send(name, evt)
  }
}

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
    }
    throw new BadRequestError('?')
  } else if (url === '/twitch') {
    if (isGET) return twitch.state
    try {
      const { login } = await twitch.use(await body())
      return { message: 'twitch enabled', user: login }
    } catch (err) {
      throw new BadRequestError(err.message)
    }
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
      const info = []
      for (const s of srt.info.values()) info.push(s.info)
      return { info }
    }
    try {
      if (method === 'DELETE') return await srt.remove(url)
      if (method === 'POST') {
        const proc = await srt.create(await body())
        updateStats(proc)
        return proc.info
      }
    } catch (err) {
      throw new BadRequestError(err.message)
    }
  }
  log('[S] unknown', [method, url])
  throw new NotFoundError(`${url} does not exist`)
}

export const wsHandler = async (ws, req) => {
  const remote = req.headers['x-forwarded-for']
  const send = (messageType, msg) => {
    try {
      ws.send(JSON.stringify({ messageType, ...msg }))
    } catch (er) {
      log('[WS] error', er)
    }
  }
  let authed = false
  ws.on('message', async (m) => {
    const msg = JSON.parse(m)
    if (msg.messageType === 'Identify' && msg.token === process.env.AUTH_TOKEN) {
      authed = true
      send('Identified')
      sockets.set(remote, send)
      log('[WS] connected', remote)
      return
    }
    if (!authed) return
    log('[WS]', remote, msg)
  })
  ws.on('close', () => sockets.delete(remote))
  send('Hello', {
    version,
  })
}

export const onShutdown = async () => {
  for (const send of sockets.values()) send('Shutdown')
  log('\n[APP] shutting down...')
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
