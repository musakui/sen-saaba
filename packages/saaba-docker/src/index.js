import EventEmitter from 'events'
import { createServer } from 'http'

import { log } from './utils.js'
import { handler } from './server.js'

const app = new EventEmitter()
const serverError = 'something went wrong'

const server = createServer((req, res) => {
  if (req.method === 'POST') {
    const j = req.headers['content-type'] === 'application/json'
    req.body = (jp = j) => new Promise((resolve, reject) => {
      let data = ''
      req.on('error', (er) => reject(er))
      req.on('data', (d) => { data += d })
      req.on('end', () => resolve((jp && data) ? JSON.parse(data) : data))
    })
  }

  const respond = (code, data) => {
    const body = JSON.stringify(data)
    res.writeHead(code, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body),
    }).end(body, 'utf-8')
  }

  const end = () => res.end()

  const stream = async (gen, ping = 0) => {
    res.writeHead(200, {
      'content-type': 'application/octet-stream',
    })
    res.flushHeaders()
    const keepalive = setInterval(() => {
      if (res.socket.readyState === 'closed') {
        gen.close()
      } else {
        res.write(`{"ping":${++ping}}`)
      }
    }, 2e4)
    app.on('stop', end)
    for await (const evt of gen) {
      res.write(JSON.stringify(evt))
    }
    clearInterval(keepalive)
    app.off('stop', end)
    end()
  }

  handler(req)
    .then((resp) => {
      if (resp[Symbol.asyncIterator]) {
        stream(resp)
      } else {
        respond(200, resp)
      }
    })
    .catch((err) => {
      const { httpStatus, message } = err
      respond(httpStatus || 500, httpStatus ? message : serverError)
    })
})

export const onShutdown = (sig) => {
  log('\n[APP] signal:', sig)
  app.emit('stop')
  server.close()
  log('[APP] shutdown')
  process.exit(0)
}

process.on('SIGINT', onShutdown)
process.on('SIGTERM', onShutdown)

const port = parseInt(process.env.PORT) || 3000
server.listen(port, () => log('[APP] ready'))
