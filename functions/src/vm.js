import DNS from '@google-cloud/dns'
import { random } from './core/utils.js'
import * as compute from './core/compute.js'
import { store, getSession, createFunction } from './core/index.js'

const manager = new DNS.DNS()
const zone = manager.zone('saaba')

const updateDNS = async (machine, ttl = 300) => {
  const name = `${machine.name}.saaba.live.`
  const add = zone.record('a', { name, data: machine.ip, ttl })
  try {
    await zone.addRecords(add)
  } catch (er) {
    const [old] = await zone.getRecords({ type: 'A', name })
    await zone.createChange({ delete: old[0], add })
  }
}

const prefixCache = new Map()

const updateCache = async (uid) => {
  const doc = store.doc(uid)
  const prefix = await (await doc.get()).get('app.prefix')
  prefixCache.set(uid, prefix)
  return prefix
}

export const vm = createFunction(async (req, res) => {
  const { sid, uid } = await getSession(req)
  const tasks = []
  const prefix = prefixCache.get(uid) || (await updateCache(uid))
  let machine = await compute.get(prefix)
  let token = await (await store.doc(uid).get()).get('token')
  let updateToken = false
  if (req.method === 'POST' && !machine) {
    token = random(24)
    updateToken = true
    const info = await compute.create(prefix, token, req.body)
    tasks.push(info.op.promise())
    machine = info.machine
    while (!machine.ip) {
      await new Promise((resolve) => setTimeout(resolve, 2e3))
      machine = await compute.get(prefix)
    }
    tasks.push(updateDNS(machine))
  } else if (req.method === 'DELETE' && machine) {
    tasks.push(compute.stop(machine))
    machine.state = 'STOPPING'
    token = null
    updateToken = true
  }
  if (updateToken) {
    tasks.push(store.doc(uid).update({ token }))
  }
  if (machine && token) {
    machine.token = token
  }
  Promise.all(tasks).then((t) => console.log('done tasks:', t.length))
  return { status: 'ok', machine }
})
