import fetch from 'node-fetch'
import { getSecret } from './utils.js'
import { clientId as client_id } from './twitch.js'

const POST = { method: 'POST' }
const ID_URL = 'https://id.twitch.tv/oauth2'
const redirect_uri = process.env.SELF_URL

const scope = [
  'chat:read',
  'user:read:email',
  'channel:read:stream_key',
  'channel:read:redemptions',
].join(' ')

const authQs = new URLSearchParams({
  response_type: 'code',
  scope,
  client_id,
  redirect_uri,
})

export const authUrl = (s) => {
  authQs.set('state', s)
  return `${ID_URL}/authorize?${authQs}`
}

const tokenQs = new URLSearchParams({
  grant_type: 'authorization_code',
  client_id,
  redirect_uri,
})

getSecret(process.env.TWITCH_CLIENT_SECRET)
  .then((s) => tokenQs.set('client_secret', s))

export const getToken = (code) => {
  tokenQs.set('code', code)
  return fetch(`${ID_URL}/token?${tokenQs}`, POST).then((r) => r.json())
}

const endQs = new URLSearchParams({ client_id })

export const revoke = (t) => {
  endQs.set('token', t)
  return fetch(`${ID_URL}/revoke?${endQs}`, POST)
}
