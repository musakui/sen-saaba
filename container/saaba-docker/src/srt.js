import { scene, sendRaw } from './obs.js'
import { log, run } from './utils.js'

const parse = (obj, f = parseInt) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))

const srtParams = {
  mode: 'listener',
}

const scaleType = 'OBS_BOUNDS_SCALE_INNER'

const defaultSettings = {
  buffering_mb: 1,
  is_local_file: false,
  input_format: 'mpegts',
  reconnect_delay_sec: 1,
  restart_on_activate: true,
  clear_on_media_end: false,
}

const ports = new Map()
const udpPorts = new Set()
export const info = new Map()

const udpPortStart = 10000
const getPort = (p = udpPortStart) => {
  while (udpPorts.has(p)) { ++p }
  udpPorts.add(p)
  return p
}

let counter = 0

class SLT {
  constructor (opts) {
    const port = opts.port
    if (ports.has(port)) throw new Error(`port ${port} in use`)
    this._port = port
    this._name = opts.name || `srt-${++counter}`
    this._scene = opts.scene || 'main'
    this._sceneZ = opts.sceneZ ?? null
    this._refresh = opts.refresh || 2000
    this._params = Object.assign({}, srtParams, opts.params)
    this._srcUrl = `srt://:${this._port}/?${new URLSearchParams(this._params)}`

    this._udpPort = getPort()
    const udpQs = new URLSearchParams(opts.udp || {})
    const input = `udp://127.0.0.1:${this._udpPort}?${udpQs}`
    this._sourceSettings = Object.assign({ input }, defaultSettings, opts.source)
    this._dstUrl = input

    this._sceneProps = opts.sceneProperties || {}

    this._stats = {}
    this._proc = null
    this._itemId = null
    this._running = false

    this._readyPromise = this._init()
  }

  get ready () {
    return this._readyPromise
  }

  get stats () {
    return this._stats
  }

  get info () {
    return {
      itemId: this._itemId,
      name: this._name,
      port: this._port,
      params: this._params,
      refresh: this._refresh,
    }
  }

  _notify (data) {
    if (!this._res) return
    this._res(data)
    this._res = null
  }

  async _init () {
    const proc = await run('slt', [
      '-pf', 'json', '-s', this._refresh,
      this._srcUrl,
      this._dstUrl,
    ])

    const pid = proc.pid
    ports.set(this._port, pid)

    proc.on('exit', () => {
      this._running = false
      info.delete(pid)
      ports.delete(this._port)
      udpPorts.delete(this._udpPort)
      log('[SRT]', pid, 'exit')
    })

    proc.stderr.on('data', (d) => {
      const info = d.toString().trim()
      log('[SRT]', pid, info)
      // Accepted SRT source connection
      // SRT source disconnected
      this._notify({ pid, info })
    })

    proc.stdout.on('data', (d) => {
      const {
        sid, send, recv, link,
        time, timepoint, window,
      } = JSON.parse(d.toString().replace(/,\s+$/, ''))
      Object.assign(this._stats, {
        time: parseInt(time), timepoint,
        link: parse(link, parseFloat),
        send: parse(send),
        recv: parse(recv),
        window: parse(window),
      })
      this._notify({ pid, ...this._stats })
    })

    this._proc = proc
    this._running = true
    info.set(pid, this)

    const { itemId } = await sendRaw('CreateSource', {
      sourceKind: 'ffmpeg_source',
      sourceName: this._name,
      sceneName: this._scene,
      sourceSettings: this._sourceSettings,
    })
    this._itemId = itemId

    if (!this._sceneProps.bounds) {
      const { baseWidth, baseHeight } = await sendRaw('GetVideoInfo')
      this._sceneProps.bounds = {
        type: scaleType,
        x: baseWidth,
        y: baseHeight,
      }
    }

    await sendRaw('SetSceneItemProperties', {
      item: this._name,
      'scene-name': this._scene,
      ...this._sceneProps,
    })

    let sourceList = null
    const current = await scene()
    if (current.name !== this._scene) {
      await scene(this._scene)
      sourceList = (await scene()).sources
    } else {
      sourceList = current.sources
    }

    const items = sourceList.filter((s) => s.id !== itemId)
    items.splice(this._sceneZ ?? items.length, 0, { id: itemId })
    await sendRaw('ReorderSceneItems', { items })

    if (current.name !== this._scene) {
      await scene(current.name)
    }

    return true
  }

  async * events () {
    while (this._running) {
      yield await new Promise((resolve) => { this._res = resolve })
    }
  }

  kill () {
    this._proc?.kill()
  }
}

const srtRegex = /^\/srt\/(\w+)$/

export const create = async (opts) => {
  const s = new SLT(opts)
  await s.ready
  return s
}

export const remove = async (url) => {
  const pid = url.match(srtRegex)?.[1]
  const proc = info.get(parseInt(pid))
  if (!proc) throw new Error('no such id')
  proc.kill()
  return { message: 'killed' }
}
