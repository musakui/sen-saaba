import { writeFile } from 'fs/promises'
import { createHash } from 'crypto'

import WS from 'ws'

import { run, millis, password, readFile } from './utils.js'

const camel = ([k, v]) => [k.replace(/-./g, (c) => c[1].toUpperCase()), v]

const sceneColleFile = '.config/obs-studio/basic/scenes/default.json'

let defaultSceneColle = '{}'
readFile(sceneColleFile).then((txt) => {
  defaultSceneColle = txt
})

export class OBS {
  constructor (opts = {}) {
    this._ws = null
    this._msgID = 0
    this._messages = new Map()

    this._delay = opts.delay || 2000
    this._proc = null
    this._launch()
  }

  kill () {
    this._proc?.kill()
  }

  async getSceneColle () {
    const colle = JSON.parse(await readFile(sceneColleFile))
    // clean up ?
    return colle
  }

  async setSceneColle (data = null) {
    if (data === null) {
      await writeFile(sceneColleFile, defaultSceneColle)
      this.kill()
      return
    }
    // validate ?
    data.name = 'default'
    await writeFile(sceneColleFile, JSON.stringify(data))
    this.kill()
  }

  async _init () {
    const proc = await run('obs')
    console.info('[OBS] started')
    proc.on('close', () => {
      console.info('[OBS] exited. relaunching...')
      this._launch()
    })
    this._proc = proc
    await millis(3000)
    try {
      this._ws = await new Promise((resolve, reject) => {
        const ws = new WS('ws://localhost:4444')
        ws.on('open', () => resolve(ws))
        ws.on('error', (err) => reject(err))
      })
    } catch (er) {
      return
    }
    this._ws.on('message', (msg) => {
      const {
        'update-type': t,
        'message-id': msgID,
        status, error, ...d
      } = JSON.parse(msg)
      const info = error ?? Object.fromEntries(Object.entries(d).map(camel))
      if (msgID) {
        const { resolve, reject } = this._messages.get(msgID)
        this._messages.delete(msgID)
        if (error) { reject(error) } else { resolve(info) }
      } else {
        // console.info('[OBS WS]', t, info)
      }
    })
    const r = await this._raw('GetAuthRequired')
    if (r?.authRequired) {
      const { challenge, salt } = r
      const ori = createHash('sha256')
      ori.update(password + salt, 'utf-8')
      const fin = createHash('sha256')
      fin.update(ori.digest('base64') + challenge, 'utf-8')
      await this._raw('Authenticate', { auth: fin.digest('base64') })
    }
    console.info('[OBS-WS] Connected')
  }

  _launch () {
    setTimeout(() => this._init(), this._delay)
  }

  _raw (name, params) {
    if (!this._ws) return
    const prom = {}
    const msgID = '' + (++this._msgID)
    this._messages.set(msgID, prom)
    this._ws.send(JSON.stringify({
      'request-type': name,
      'message-id': msgID,
      ...params,
    }))
    return new Promise((resolve, reject) => Object.assign(prom, { resolve, reject }))
  }

  scene (name) {
    return name
      ? this._raw('SetCurrentScene', { 'scene-name': name })
      : this._raw('GetCurrentScene')
  }
}
