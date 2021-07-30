import { request } from 'https'

export const state = {}

const headers = {
  'Content-Type': 'application/json',
}

export const api = (q, params) => new Promise((resolve, reject) => {
  const options = { headers }
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

export const use = async (info) => {
  if (!info.clientId || !info.token) throw new Error('missing info')
  Object.assign(state, info)
  Object.assign(headers, {
    'Client-Id': info.clientId,
    'Authorization': `Bearer ${info.token}`,
  })
  const { data } = await api('users')
  if (!data) throw new Error('invalid info')
  state.user = data[0]
  Promise.all([
    import('./obs.js'),
    api(`streams/key?broadcaster_id=${state.user.id}`),
  ]).then(([o, r]) => o.setStreamKey(r.data[0].stream_key))
  return state.user
}
