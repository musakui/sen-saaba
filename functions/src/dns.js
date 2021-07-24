import DNS from '@google-cloud/dns'
import { store, getSession, createFunction } from '../core/index.js'
import { BadRequest, Forbidden } from '../core/errors.js'

const manager = new DNS.DNS()
const zone = manager.zone('saaba')

export const dns = createFunction(async (req, res) => {
  const { uid } = await getSession(req)
  if (req.method === 'POST') {
    const { address: data, tier = 0, ttl = 600 } = req.body
    if (!data) throw new BadRequest('missing address')
    const doc = store.doc(uid)
    const { prefix, tier: maxT } = await (await doc.get()).get('app')
    if (tier > maxT) throw new Forbidden('tier too high')
    const name = `${prefix}-${tier}.saaba.live.`
    const rec = zone.record('a', { name, data, ttl })
    try {
      await zone.addRecords(rec)
    } catch (er) {
      await zone.replaceRecords('a', rec)
    }
  }
  return { status: 'ok' }
})
