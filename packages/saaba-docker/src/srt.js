import { EventEmitter } from 'events'

import { sendRaw, setItemZ } from './obs.js'
import { log, run } from './utils.js'

const parse = (obj, f = parseInt) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))

const minPort = 1900
const maxPort = 1999

const srtParams = {
  mode: 'listener',
}

const setItemProps = async (item, sceneName, props) => {
  if (!props.bounds) {
    const { baseWidth: x, baseHeight: y } = await sendRaw('GetVideoInfo')
    props.bounds = { type: 'OBS_BOUNDS_SCALE_INNER', x, y }
  }

  await sendRaw('SetSceneItemProperties', {
    'scene-name': sceneName,
    item,
    ...props,
  })
}

const defaultSettings = {
  buffering_mb: 1,
  is_local_file: false,
  input_format: 'mpegts',
  reconnect_delay_sec: 1,
  restart_on_activate: true,
  clear_on_media_end: false,
}

export const ports = new Map()
const udpPorts = new Set()
export const info = new Map()

const udpPortStart = 10000
const getPort = (p = udpPortStart) => {
  while (udpPorts.has(p)) { ++p }
  udpPorts.add(p)
  return p
}

let counter = 0

class SLT extends EventEmitter {
  constructor (opts) {
    const port = parseInt(opts.port)
    if (isNaN(port)) throw new Error('invalid port')
    if (ports.has(port)) throw new Error(`port ${port} in use`)
    if (port < minPort || port > maxPort) throw new Error(`port out of range (${minPort} - ${maxPort})`)
    super()
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

  get running () {
    return this._running
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
      sendRaw('DeleteSceneItem', {
        scene: this._scene,
        item: { id: this._itemId },
      })
      this.emit('info', { type: 'close' })
      info.delete(pid)
      ports.delete(this._port)
      udpPorts.delete(this._udpPort)
      log('[SRT]', pid, 'exit')
    })

    proc.stderr.on('data', (d) => {
      const message = d.toString().trim()
      let type = null
      switch (message) {
        case 'Accepted SRT source connection':
          type = 'connect'
          break
        case 'SRT source disconnected':
          type = 'disconnect'
          break
        default:
          break
      }
      this.emit('info', { type, message })
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
      this.emit('stat', this._stats)
    })

    this._proc = proc
    this._running = true
    this._stats.time = 0
    info.set(pid, this)

    const { itemId } = await sendRaw('CreateSource', {
      sourceKind: 'ffmpeg_source',
      sourceName: this._name,
      sceneName: this._scene,
      sourceSettings: this._sourceSettings,
    })
    this._itemId = itemId

    await setItemProps(this._name, this._scene, this._sceneProps)
    await setItemZ(itemId, this._sceneZ, this._scene)

    log('[SRT]', pid, 'port:', this._port)
    return true
  }

  kill () {
    this._proc?.kill()
  }
}

const srtRegex = /^\/srt\/(\w+)$/

const getProc = (url) => {
  const port = url.match(srtRegex)?.[1]
  const pid = ports.get(parseInt(port))
  if (!pid) throw new Error('port not in use')
  const proc = info.get(pid)
  if (!proc) throw new Error('no such id')
  return proc
}

export const create = async (opts) => {
  const s = new SLT(opts)
  await s.ready
  return s
}

export const listen = async (url, res) => {
  const proc = getProc(url)
  const queue = []
  const notify = () => {
    if (!res) return
    res()
    res = null
  }
  let ping = 0
  proc.on('stat', (stat) => (queue.push(stat), notify()))
  proc.on('info', (info) => (queue.push(info), notify()))
  setInterval(() => (++ping, queue.push({ ping }), notify()), 2e4)
  return async function * () {
    yield proc.stats
    while (proc.running) {
      await new Promise((resolve) => { res = resolve })
      while (queue.length) yield queue.shift()
    }
  }
}

export const remove = async (url) => {
  try {
    getProc(url).kill()
    return { message: 'killed' }
  } catch (er) {
    return { message: er.message }
  }
}
