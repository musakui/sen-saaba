import { run } from './utils.js'

const parse = (obj, f = parseInt) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))

export class SRT {
  constructor (opts = {}) {
    this._proc = null
    this._stats = {}
    this._refresh = opts.refresh || 1000
  }

  async start (src, dst) {
    if (this._proc) return
    const proc = await run('slt', [
      '-pf', 'json', '-s', this._refresh, src, dst,
    ])
    proc.stderr.on('data', (d) => {
      for (const line of d.toString().split('\n')) {
        if (!line) continue
        console.info('[SRT]', line)
      }
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
    })
    this._proc = proc
  }

  get running () {
    return !!this._proc
  }

  get stats () {
    return this._stats
  }

  kill () {
    this._proc.kill()
  }
}
