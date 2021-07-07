import http from 'https'
import { spawn } from 'child_process'
import { readFile as read } from 'fs/promises'

export const readFile = (fn) => read(fn, 'utf8').then((t) => t.trim())

export const millis = (m) => new Promise((resolve) => setTimeout(resolve, m))

export const run = (cmd, args = []) => new Promise((resolve, reject) => {
  const proc = spawn(cmd, args)
  proc.on('spawn', () => resolve(proc))
  proc.on('error', (err) => reject(err))
})

export let password = ''
readFile('.password').then((p) => { password = p })

export const API = async (opts) => {
  const {
    login: username,
    user_id: userId,
    client_id: clientId,
  } = JSON.parse(await readFile('.valid.json'))

  const headers = {
    'Client-Id': clientId,
    'Authorization': `Bearer ${process.env.AUTH_TOKEN}`,
  }

  return (q, params) => new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.twitch.tv',
      path: `/helix/${q}`,
      headers,
    }
    let body = ''
    const req = http.request(options, (res) => {
      res.setEncoding('utf8')
      res.on('error', (er) => reject(er))
      res.on('data', (d) => { body += d })
      res.on('end', () => resolve(JSON.parse(body)))
    })
    req.on('error', (err) => reject(err))
    req.end()
  })
}
