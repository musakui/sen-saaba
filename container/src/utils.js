import { request } from 'https'
import { spawn } from 'child_process'
import { readFile as read } from 'fs/promises'

export const log = (...args) => console.info(...args)

export const readFile = (fn) => read(fn, 'utf8').then((t) => t.trim())

export const millis = (m) => new Promise((resolve) => setTimeout(resolve, m))

export const run = (cmd, args = []) => new Promise((resolve, reject) => {
  const proc = spawn(cmd, args)
  proc.on('spawn', () => resolve(proc))
  proc.on('error', (err) => reject(err))
})

const twitchHeaders = {
  'Content-Type': 'application/json',
}

export const useTwitch = async ({ clientId, token }) => {
  if (!clientId || !token) return null
  Object.assign(twitchHeaders, {
    'Client-Id': clientId,
    'Authorization': `Bearer ${token}`,
  })
  const { data } = await twitch('users')
  return data?.[0]
}

export const twitch = (q, params) => new Promise((resolve, reject) => {
  const options = {
    headers: twitchHeaders,
  }
  let reqBody = ''
  if (params) {
    options.method = 'POST'
    reqBody = JSON.stringify(params)
  } else if (params === null) {
    options.method = 'DELETE'
  }
  let body = ''
  const req = request(
    `https://api.twitch.tv/helix/${q}`,
    options, (res) => {
      res.on('error', (er) => reject(er))
      res.on('data', (d) => { body += d })
      res.on('end', () => resolve(JSON.parse(body)))
    })
  req.on('error', (err) => reject(err))
  if (reqBody) req.write(reqBody)
  req.end()
})
