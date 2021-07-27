import fetch from 'node-fetch'
import { twitchClientId as clientId } from './index.js'

const API_URL = 'https://api.twitch.tv/helix'

export const api = (token, q, params) => {
  const opts = {
    headers: {
      'Client-Id': clientId,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }
  if (params) {
    opts.method = 'POST'
    opts.body = JSON.stringify(params)
  }
  return fetch(`${API_URL}/${q || ''}`, opts).then((r) => r.json())
}
