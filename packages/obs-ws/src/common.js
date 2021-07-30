let curId = 0
const requests = new Map()

const camel = ([k, v]) => [k.replace(/-./g, (c) => c[1].toUpperCase()), v]
const toCamel = (d) => Object.fromEntries(Object.entries(d).map(camel))

export const handleMessage = (msg) => {
  const {
    status,
    error,
    'update-type': t,
    'message-id': reqId,
    ...d
  } = msg
  if (reqId) {
    const { resolve, reject } = requests.get(reqId)
    requests.delete(reqId)
    return error ? reject(error) : resolve(toCamel(d))
  }
  // event
  const evt = { status, messageType: t, error, ...toCamel(d) }
}

export const createRequest = (requestType, requestData = {}) => {
  const requestId = `${++curId}`
  const request = JSON.stringify({
    'request-type': requestType,
    'message-id': requestId,
    ...requestData
  })
  const response = new Promise((resolve, reject) => {
    requests.set(requestId, { resolve, reject })
  })
  return { request, response }
}

export const create = (env) => {
  const {
    WS,
    authHash,
    parseMessage,
  } = env

  const handle = (m) => handleMessage(parseMessage(m))

  const getAuth = async (password, info) => {
    const { challenge, salt } = info
    return await authHash(await authHash(password + salt) + challenge)
  }

  class OBS extends WS {
    request (name, params) {
      const { request, response } = createRequest(name, params)
      this.send(request)
      return response
    }
  }

  return async (url, opts = {}) => {
    const obs = new OBS(url)
    obs.on('message', (m) => handle(m))
    obs.on('open', () => {
      obs.request('GetAuthRequired').then(async (r) => {
        if (!(r?.authRequired)) return
        const auth = await getAuth(opts.password, r)
        obs.request('Authenticate', { auth })
      })
    })
    return obs
  }
}
