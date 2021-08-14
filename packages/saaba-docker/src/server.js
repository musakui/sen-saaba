import * as obs from './obs.js'
import * as srt from './srt.js'
import * as vnc from './vnc.js'
import * as twitch from './twitch.js'

const version = process.env.npm_package_version || 'debug'

const updateStats = async (proc) => {
  proc.on('stats', (s) => {
    // TODO: low bitrate / disconnect handling

  })
  proc.on('info', (i) => {
  })
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
      return {
        info,
        ports: [...srt.ports.keys()],
      }
    }
    try {
      if (isGET) return await srt.listen(url)
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
  throw new NotFoundError(`${url} does not exist`)
}

class BadRequestError extends Error {
  static code = 400

  constructor (message) {
    super(message)
    this.httpStatus = this.constructor.code
  }
}

class ForbiddenError extends BadRequestError {
  static code = 403
}

class NotFoundError extends BadRequestError {
  static code = 404
}
