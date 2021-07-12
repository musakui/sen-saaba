import { log, run } from './utils.js'

const parse = (obj, f = parseInt) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))

const srtParams = {
  mode: 'listener',
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

class SLT {
  constructor (opts) {
    const port = opts.port
    if (ports.has(port)) throw new Error(`port ${port} in use`)
    this._port = port
    this._name = opts.name
    this._refresh = opts.refresh || 2000
    this._params = Object.assign({}, srtParams, opts.params)

    const udpQs = new URLSearchParams(opts.udpParams || {})
    this._udpPort = getPort()
    this._udpUrl = `udp://localhost:${this._udpPort}/?${udpQs}`,

    this._stats = {}
    this._proc = null
    this._running = false

    this._readyPromise = this._init()
  }

  get ready () {
    return this._readyPromise
  }

  get info () {
    return {
      stats: this._stats,
      name: this._name,
      port: this._port,
      params: this._params,
      refresh: this._refresh,
    }
  }

  async _init () {
    const srtQs = new URLSearchParams(this._params)
    const proc = await run('slt', [
      '-pf', 'json', '-s', this._refresh,
      `srt://:${this._port}/?${srtQs}`, this._udpUrl,
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
      log('[SRT]', pid, d.toString().trim())
      // Accepted SRT source connection
      // SRT source disconnected
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
      if (this._res) {
        this._res(stats)
        this._res = null
      }
    })

    this._proc = proc
    this._running = true
    info.set(pid, this)
    return true
  }

  async * liveStats () {
    while (this._running) {
      yield await new Promise((resolve) => { this._res = resolve })
    }
  }

  kill () {
    this._proc?.kill()
  }
}

const srtRegex = /^\/srt\/(\w+)$/

export const handleRequest = async (url, body) => {
  if (body) {
    const slt = new SLT(body)
    await slt.ready
    return slt.info
  }
  const pid = url.match(srtRegex)?.[1]
  const proc = info.get(parseInt(pid))
  if (!proc) throw new Error('no such id')
  proc.kill()
  return { message: 'killed successfully' }
}
