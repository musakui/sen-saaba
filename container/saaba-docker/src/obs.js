import { writeFile } from 'fs/promises'
import { createHash } from 'crypto'

import WS from 'ws'

import { log, run, millis, readFile } from './utils.js'

const camel = ([k, v]) => [k.replace(/-./g, (c) => c[1].toUpperCase()), v]

const hash = (str) => {
  const h = createHash('sha256')
  h.update(str, 'utf-8')
  return h.digest('base64')
}

const configDir = '.config/obs-studio'
const sceneColleFile = `${configDir}/basic/scenes/default.json`

let defaultSceneColle = '{}'
readFile(sceneColleFile).then((txt) => {
  defaultSceneColle = txt
})

let proc = null
let delay = 2000

let ws = null
let curID = 0
const messages = new Map()

export const kill = () => proc?.kill()

export const getSceneColle = async () => {
  const colle = JSON.parse(await readFile(sceneColleFile))
  // clean up ?
  return colle
}

export const setSceneColle = async (data = null) => {
  if (data === null) {
    await writeFile(sceneColleFile, defaultSceneColle)
    kill()
    return { message: 'scene collection reset' }
  }
  // validate ?
  data.name = 'default'
  await writeFile(sceneColleFile, JSON.stringify(data))
  kill()
  return { message: 'scene collection updated' }
}

const dockLine = 'ExtraBrowserDocks'

export const setDock = (url) => {
  if (!url) return
  const docks = JSON.stringify([{ title: 'dock', url }])
  kill()
  return run('sed', [
    '-i',
    `s|^${dockLine}.*|${dockLine}=${docks}|`,
    `${configDir}/global.ini`,
  ])
}

export const sendRaw = (name, params) => {
  if (!ws) return
  const msgID = `${++curID}`
  const prom = new Promise((resolve, reject) => messages.set(msgID, { resolve, reject }))
  ws.send(JSON.stringify({
  'request-type': name,
    'message-id': msgID,
    ...params,
  }))
  return prom
}

export const scene = (name) => name
  ? sendRaw('SetCurrentScene', { 'scene-name': name })
  : sendRaw('GetCurrentScene')

export const setStreamKey = (key) => sendRaw('SetStreamSettings', {
  type: 'rtmp_common',
  settings: { server: 'auto', key },
})

export const handlePOST = async (body) => {
  const {
    sceneCollection: colle,
    dock,
    restart,
  } = body
  if (colle || (colle === null)) {
    return await setSceneColle(colle)
  } else if (dock) {
    await setDock(dock)
    return { message: 'updating dock' }
  } else if (restart) {
    kill()
    return { message: 'obs restarting' }
  }
  throw new Error('unknown request')
}

const init = async () => {
  proc = await run('obs')
  log('[OBS] started')
  proc.on('close', () => {
    log('[OBS] exited. relaunching...')
    launch()
  })
  await millis(3000)
  try {
    ws = await new Promise((resolve, reject) => {
      const w = new WS('ws://localhost:4444')
      w.on('open', () => resolve(w))
      w.on('error', (err) => reject(err))
    })
  } catch (er) {
    ws = null
    return
  }
  ws.on('message', (msg) => {
    const {
      'update-type': t,
      'message-id': msgID,
      status, error, ...d
    } = JSON.parse(msg)
    const info = error ?? Object.fromEntries(Object.entries(d).map(camel))
    if (msgID) {
      const { resolve, reject } = messages.get(msgID)
      messages.delete(msgID)
      if (error) { reject(error) } else { resolve(info) }
    } else {
      // log('[OBS] ws', t, info)
    }
  })
  const r = await sendRaw('GetAuthRequired')
  if (r?.authRequired) {
    const { challenge, salt } = r
    const auth = hash(hash(process.env.AUTH_TOKEN + salt) + challenge)
    await sendRaw('Authenticate', { auth })
  }
  log('[OBS] ws connected')
}

export const launch = () => setTimeout(init, delay)

init()
