import { writeFile } from 'fs/promises'
import { createOBS } from 'obs-ws'

import { log, run, millis, readFile } from './utils.js'

const configDir = '.config/obs-studio'
const sceneColleFile = `${configDir}/basic/scenes/default.json`

let defaultSceneColle = '{}'
readFile(sceneColleFile).then((txt) => {
  defaultSceneColle = txt
})

let proc = null
let delay = 2000

let ws = null
const password = process.env.AUTH_TOKEN

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
  return ws.request(name, params)
}

export const scene = (name) => name
  ? sendRaw('SetCurrentScene', { 'scene-name': name })
  : sendRaw('GetCurrentScene')

export const setStreamKey = (key) => sendRaw('SetStreamSettings', {
  type: 'rtmp_common',
  settings: { server: 'auto', key },
})

export const setItemZ = async (id, z, name) => {
  const current = await scene()
  const swap = name && (current.name !== name)
  const { sources } = swap
    ? (await scene(name).then(() => scene()))
    : current

  const items = sources.filter((s) => s.id !== id)
  items.splice(z ?? items.length, 0, { id })
  await sendRaw('ReorderSceneItems', { items })

  if (swap) await scene(current.name)
}

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
    ws = await createOBS('ws://localhost:4444', { password })
  } catch (er) {
    ws = null
    return
  }
  log('[OBS] ws connected')
}

export const launch = () => setTimeout(init, delay)

init()
