import Compute from '@google-cloud/compute'

import { getSecret } from './utils.js'

let certStr = ''
const certUrl = process.env.CERT_URL
getSecret(process.env.CERT_SEC).then((s) => { certStr = s })

const serverTags = (process.env.SERVER_TAGS || '').split(',')
const sourceImage = process.env.GCP_SRC_IMG || 'projects/cos-cloud/global/images/family/cos-stable'
const defaultRegion = process.env.GCP_REGION || 'asia-southeast1' // singapore

const getContainerDeclaration = (token) => ({
  key: 'gce-container-declaration',
  value: `spec:
  containers:
    - name: saaba
      image: 'musakui/saaba:latest'
      securityContext:
        privileged: true
      env:
        - name: AUTH_TOKEN
          value: ${token}
        - name: CERT_URL
          value: ${certUrl}
        - name: CERT_STR
          value: ${certStr}
      tty: false
      stdin: false
      restartPolicy: Never`
})

const compute = new Compute()
const machineTypes = new Map()

const getZone = async (region) => {
  const [ zones ] = await compute.getZones({ filter: `name eq ^${region}.*` })
  return zones[Math.floor(Math.random() * zones.length)]
}

const getMachine = async (zone, type) => {
  if (machineTypes.get(zone.name)?.has(type)) return type
  const [ machines ] = await zone.getMachineTypes()
  const available = new Set(machines.map((m) => m.id))
  machineTypes.set(zone.name, available)
  if (available.has(type)) return type
  throw new Error(`machine type '${type}' unavailable`)
}

export const get = async (prefix) => {
  const [ vms ] = await compute.getVMs({
    filter: `name eq ^${prefix}.*`,
  })
  if (!vms.length) return null
  const {
    metadata: {
      status: state,
      name,
      zone: z,
      machineType,
      networkInterfaces: [net],
    },
  } = vms[0]
  return {
    state,
    name,
    ip: net.accessConfigs[0].natIP,
    zone: z.split('/').slice(-1)[0],
    machine: machineType.split('/').slice(-1)[0],
  }
}

export const stop = ({ zone, name }) => compute.zone(zone).vm(name).delete()

export const create = async (prefix, token, opts) => {
  const preemptible = !opts.tier
  const name = `${prefix}-${opts.tier || 0}`
  const zone = await getZone(opts.region || defaultRegion)
  const machineType = await getMachine(zone, opts.machine || 'n2d-highcpu-2')

  const accessConfigs = [{
    name: 'eNAT',
    type: 'ONE_TO_ONE_NAT',
    networkTier: opts.tier ? 'PREMIUM' : 'STANDARD',
  }]

  const config = {
    machineType,
    tags: serverTags,
    scheduling: { preemptible },
    networkInterfaces: [{ accessConfigs }],
    disks: [{
      boot: true, autoDelete: true,
      initializeParams: { sourceImage, diskSizeGb: 10 }
    }],
    metadata: {
      items: [
        getContainerDeclaration(token),
        // { key: 'google-logging-enabled', value: true },
      ]
    },
  }

  const [vm, op] = await zone.createVM(name, config)

  return {
    op,
    machine: {
      state: 'CREATING',
      name,
      ip: null,
      zone: zone.name,
      machine: machineType,
    },
  }
}
