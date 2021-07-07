import { run } from './utils.js'

const defaultArgs = ['-noxdamage']

export class VNC {
  constructor () {
    this._proc = null
  }

  async start (opts = {}) {
    if (this._proc) return
    const args = opts.args || defaultArgs
    const proc = await run('vnc', ['-rfbauth', '.vncpass', ...args])
    console.info('[VNC] Started')
    proc.on('exit', () => {
      console.info('[VNC] Stopped')
      this._proc = null
    })
    this._proc = proc
  }

  async stop () {
    if (!this._proc) return
    this._proc.kill()
  }

  get running () {
    return !!this._proc
  }
}
