import * as compute from '../core/compute.js'
import { store, getSession, createFunction } from '../core/index.js'

const prefixCache = new Map()

const updateCache = async (uid) => {
  const doc = store.doc(uid)
  const { prefix } = await (await doc.get()).get('app')
  prefixCache.set(uid, prefix)
  return prefix
}

export const vm = createFunction(async (req, res) => {
  const { sid, uid } = await getSession(req)
  const tasks = []
  const prefix = prefixCache.get(uid) || (await updateCache(uid))
  let machine = await compute.get(prefix)
  if (req.method === 'POST' && !machine) {
    const info = await compute.create(prefix, sid, req.body)
    tasks.push(info.op.promise())
    machine = info.machine
  } else if (req.method === 'DELETE' && machine) {
    tasks.push(compute.stop(machine))
    machine.state = 'STOPPING'
  }
  Promise.all(tasks).then((t) => console.log('done tasks:', t.length))
  return { status: 'ok', machine }
})
