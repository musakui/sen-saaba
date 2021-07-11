import { log, run } from './utils.js'

const defaultArgs = ['-noxdamage']

let proc = null

export const start = async (opts = {}) => {
  if (proc) return
  const args = opts.args || defaultArgs
  proc = await run('vnc', ['-rfbauth', '.vncpass', ...args])
  log('[VNC] Started')
  proc.on('exit', () => {
    log('[VNC] Stopped')
    proc = null
  })
}

export const stop = () => proc?.kill()

export const info = {
  get running () {
    return !!proc
  },
}
