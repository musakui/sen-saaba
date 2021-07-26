import fetch from 'node-fetch'
import { getSecret } from './utils.js'
import { clientId as client_id } from './twitch.js'

const POST = { method: 'POST' }
const ID_URL = 'https://id.twitch.tv/oauth2'
const redirect_uri = process.env.SELF_URL
const client_secret = 'client_secret'
const refresh_token = 'refresh_token'

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

const codeQs = new URLSearchParams({
  grant_type: 'authorization_code',
  client_id,
  redirect_uri,
})

const refreshQs = new URLSearchParams({
  grant_type: refresh_token,
  client_id,
})

getSecret(process.env.TWITCH_CLIENT_SECRET).then((s) => {
  codeQs.set(client_secret, s)
  refreshQs.set(client_secret, s)
})

export const getToken = (code, refresh = false) => {
  const tokenQs = refresh
    ? (refreshQs.set(refresh_token, code), refreshQs)
    : (codeQs.set('code', code), codeQs)
  return fetch(`${ID_URL}/token?${tokenQs}`, POST).then((r) => r.json())
}

const endQs = new URLSearchParams({ client_id })

export const revoke = (t) => {
  endQs.set('token', t)
  return fetch(`${ID_URL}/revoke?${endQs}`, POST)
}
