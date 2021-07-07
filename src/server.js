import { OBS } from './obs.js'
import { SRT } from './srt.js'
import { VNC } from './vnc.js'

import { password } from './utils.js'

const obs = new OBS()
const srt = new SRT()
const vnc = new VNC()

const version = process.env.VERSION || 'debug'

export const handler = async (req) => {
  const { method, body, url } = req
  switch (url) {
    case '/':
      return { status: 'ok', version }
    case '/info':
      return { password }
    case '/obs':
      if (method === 'POST') {
        const { sceneCollection: colle, restart } = await body()
        if (colle) {
          await obs.setSceneColle(colle)
        } else if (restart) {
          obs.kill()
        } else {
          throw new BadRequestError('unknown request')
        }
      } else if (method === 'GET') {
        return {
          sceneCollection: await obs.getSceneColle(),
        }
      }
      break
    case '/srt':
      if (method === 'POST') {
        const { src, dst } = await body()
        if (!src || !dst) {
          throw new BadRequestError('src & dst required')
        }
        await srt.start(src, dst)
      }
      return { stats: srt.stats }
    case '/vnc':
      if (method === 'POST') {
        try {
          await vnc.start(await body())
        } catch (er) {
          return { error: 'could not start vnc' }
        }
      }
      return { running: vnc.running }
      break
    default:
      console.info('[S] unknown', [method, url])
  }
  throw new NotFoundError(`${url} does not exist`)
}

export const wsHandler = async (ws) => {
  console.info('[WS] client connected')
  ws.on('message', async (msg) => {
    console.info('[WS] client:', msg)
  })
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
