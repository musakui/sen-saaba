let curId = 0
const requests = new Map()

const camel = ([k, v]) => [k.replace(/-./g, (c) => c[1].toUpperCase()), v]
const toCamel = (d) => Object.fromEntries(Object.entries(d).map(camel))

class ObsError extends Error {
}

export const handleMessage = (msg) => {
  const {
    status,
    error,
    'update-type': t,
    'message-id': reqId,
    ...d
  } = msg
  if (reqId) {
    const [resolve, reject] = requests.get(reqId)
    requests.delete(reqId)
    return error
      ? reject(new ObsError(error))
      : resolve(toCamel(d))
  }
  // event
  return { eventType: t, ...toCamel(d) }
}

export const createRequest = (requestType, requestData = {}) => {
  const requestId = `${++curId}`
  const request = JSON.stringify({
    'request-type': requestType,
    'message-id': requestId,
    ...requestData
  })
  return [
    request,
    new Promise((resolve, reject) => {
      requests.set(requestId, [resolve, reject])
    })
  ]
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
    #conn = null
    #delay = null
    #running = false
    #password = null
    #api = new Proxy({}, {
      get: (t, p) => t[p] || (t[p] = (q) => this.request(p, q))
    })

    constructor (url, opts) {
      super(url)
      this.#delay = opts.delay || 2000
      this.#password = opts.password
      this.#running = true
      this.#conn = this._init(this)
    }

    async _init (conn) {
      while (true) {
        if (!conn) {
          conn = new WS(this.url)
        }
        try {
          await new Promise((resolve, reject) => {
            conn.once('open', resolve)
            conn.once('error', reject)
          })
          break
        } catch (err) {
          if (conn === this) return (this.#conn = null)
          await new Promise((resolve) => setTimeout(resolve, this.#delay))
          conn = null
        }
      }

      conn.once('close', (c) => {
        this.#conn = null
      })

      conn.on('message', (m) => {
        const evt = handle(m)
        if (!evt) return
      })

      // authenticate
      const [authReq, authResp] = createRequest('GetAuthRequired')
      conn.send(authReq)
      const r = await authResp
      if (r?.authRequired) {
        const auth = await getAuth(this.#password, r)
        const [req, res] = createRequest('Authenticate', { auth })
        conn.send(req)
        await res
      }

      this.emit('ready')
      return conn
    }

    get $ () {
      return this.#api
    }

    request (name, params) {
      const [request, response] = createRequest(name, params)
      if (!this.#conn) {
        this.#conn = this._init()
      }
      Promise.resolve(this.#conn).then((c) => c.send(request))
      return response
    }

    close () {
      this.#conn.close()
    }
  }

  return (url, opts = {}) => new OBS(url, opts)
}
