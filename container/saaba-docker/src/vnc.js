import { log, run } from './utils.js'

const defaultArgs = [
]

let proc = null

export const start = async (opts = {}) => {
  if (proc) return
  const args = opts.args || defaultArgs
  proc = await run('vnc', ['-rfbauth', '.vncpass', ...args])
  log('[VNC] started')
  proc.on('exit', () => {
    log('[VNC] stopped')
    proc = null
  })
}

export const stop = () => proc?.kill()

export const info = {
  get running () {
    return !!proc
  },
}
