import EventEmitter from 'events'
import { createServer } from 'http'

import { log } from './utils.js'
import { handler } from './server.js'

const app = new EventEmitter()
const serverError = { error: 'Error', message: 'something went wrong' }

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

  const stream = async (gen) => {
    res.writeHead(200, {
      'content-type': 'application/octet-stream',
    })
    app.on('stop', () => res.end())
    for await (const evt of gen()) {
      res.write(JSON.stringify(evt))
    }
    res.end()
  }

  handler(req)
    .then((resp) => {
      if (resp.constructor.name === 'AsyncGeneratorFunction') {
        stream(resp)
      } else {
        respond(200, resp)
      }
    })
    .catch((err) => {
      const { httpStatus, ...info } = err
      respond(httpStatus || 500, httpStatus ? info : serverError)
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
