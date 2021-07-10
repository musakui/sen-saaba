import { createServer } from 'http'

import WS from 'ws'

import { log } from './utils.js'
import { handler, wsHandler } from './server.js'

const srvErr = { error: 'Error', message: 'something went wrong' }

const server = createServer((req, res) => {
  if (req.method === 'POST') {
    const j = req.headers['content-type'] === 'application/json'
    req.body = (jp = j) => new Promise((resolve, reject) => {
      let data = ''
      req.on('error', (er) => reject(er))
      req.on('data', (d) => { data += d })
      req.on('end', () => resolve(jp ? JSON.parse(data) : data))
    })
  }

  let code = 500
  let response = { error: '?' }

  handler(req)
    .then((resp) => {
      code = 200
      response = resp
    })
    .catch((err) => {
      const { httpStatus, ...info } = err
      code = httpStatus || 500
      response = httpStatus ? info : srvErr
    })
    .finally(() => {
      const body = JSON.stringify(response)
      res.writeHead(code, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }).end(body, 'utf-8')
    })
})

const wsServer = new WS.Server({ server })
wsServer.on('connection', wsHandler)

process.on('SIGINT', () => {
  log('\n[S] shutting down...')
  process.exit(0)
})

const port = parseInt(process.env.PORT) || 3000
server.listen(port, () => log('[S] ready'))
