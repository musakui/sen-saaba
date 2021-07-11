import { log, run } from './utils.js'

const parse = (obj, f = parseInt) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))

const ports = new Map()
const procs = new Map()
export const info = new Map()

export const create = async (src, dst, refresh = 1000) => {
  if (!src || !dst) throw new Error('src & dst required')
  const srcUrl = new URL(src)
  const dstUrl = new URL(dst)
  if (ports.has(srcUrl.port)) throw new Error('src port in use')
  if (ports.has(dstUrl.port)) throw new Error('dst port in use')

  const proc = await run('slt', ['-pf', 'json', '-s', refresh, src, dst])

  let running = true
  ports.set(srcUrl.port, proc.pid)
  ports.set(dstUrl.port, proc.pid)

  proc.on('exit', () => {
    running = false
    ports.delete(srcUrl.port)
    ports.delete(dstUrl.port)
    procs.delete(proc.pid)
    info.delete(proc.pid)
  })

  let res = null
  const stats = {}
  info.set(proc.pid, { src, dst, stats })

  async function * listen () {
    while (running) {
      yield await new Promise((resolve) => { res = resolve })
    }
  }

  proc.stderr.on('data', (d) => {
    for (const line of d.toString().split('\n')) {
      if (line) log('[SRT]', line)
    }
  })

  proc.stdout.on('data', (d) => {
    const {
        sid, send, recv, link,
        time, timepoint, window,
    } = JSON.parse(d.toString().replace(/,\s+$/, ''))
    Object.assign(stats, {
        time: parseInt(time), timepoint,
        link: parse(link, parseFloat),
        send: parse(send),
        recv: parse(recv),
        window: parse(window),
    })
    if (res) {
      res(stats)
      res = null
    }
  })

  procs.set(proc.pid, {
    proc,
    listen,
  })

  return proc
}
