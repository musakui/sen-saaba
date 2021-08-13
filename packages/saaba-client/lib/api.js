const typeHeader = 'content-type'
const applicationJSON = 'application/json'

class ControllerError extends Error {
  constructor (message, statusText) {
    super(message)
    this.statusText = statusText
  }
}

export const createControllerApi = (url, token) => {
  const headers = {
    [typeHeader]: applicationJSON,
    authorization: `Bearer ${token}`,
  }

  return async (path, data) => {
    const opts = { method: 'GET', headers }
    if (data) {
      Object.assign(opts, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    } else if (data === null) {
      opts.method = 'DELETE'
    }
    const r = await fetch(`${url}api/${path}`, opts)
    if (!r.ok && r.status > 399) {
      throw new ControllerError(await r.json(), r.statusText)
    }
    const ctype = r.headers.get(typeHeader)
    if (ctype === applicationJSON) return await r.json()
    if (ctype.startsWith('text/')) return await r.text()
    return r.body
  }
}

export const getSrtStream = (api) => ((port) => ({
  port,
  close: () => api(`srt/${port}`, null),
  async * [Symbol.asyncIterator] () {
    const body = await api(`srt/${port}`)
    const r = body.pipeThrough(new TextDecoderStream()).getReader()
    while (true) {
      const { value, done } = await r.read()
      if (done) break
      try {
        const evt = JSON.parse(value)
        if (evt.ping) continue
        yield evt
      } catch (er) {
        yield { raw: value }
      }
    }
    r.releaseLock()
  },
}))
