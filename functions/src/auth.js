import { random } from '../core/utils.js'
import { sessions, createFunction } from '../core/index.js'
import { authUrl, getToken, revoke } from '../core/twitch.js'

const appUrl = process.env.APP_URL

const login = async (res, origin = '') => {
  const state = random()
  const doc = sessions.doc()
  await doc.set({ state, origin })
  res.cookie('sess', doc.id, { maxAge: 600000, secure: true, httpOnly: true })
  res.redirect(302, authUrl(state))
}

const logout = async (res, { logout, url }) => {
  const doc = sessions.doc(logout)
  const t = await (await doc.get()).get('token')
  await Promise.all([revoke(t), doc.delete()])
  res.redirect(302, `https://${url || appUrl}/`)
}

export const auth = createFunction(async (req, res) => {
  if (req.query.logout) return await logout(res, req.query)
  if (!req.query.code) return await login(res, req.query.url)

  const end = (frag, url) => (res.redirect(302, `https://${url || appUrl}/#${frag}`), null)

  if (!req.headers.cookie) return end('error=sess')
  req.cookies = new Map(req.headers.cookie.split('; ').map((c) => c.split('=')))

  const doc = sessions.doc(req.cookies.get('sess'))
  try {
    const docRef = await doc.get()
    if (req.query.state !== (await docRef.get('state'))) {
      return end('error=csrf')
    }
  } catch (er) {
    return end('error=sess')
  }

  try {
    const {
      access_token: token,
      refresh_token, expires_in,
    } = await getToken(req.query.code)
    const origin = await (await doc.get()).get('origin')
    const expiry = Math.floor((Date.now() / 1000) + expires_in)
    await doc.set({ token, refresh_token, expiry })
    return end(`token=${doc.id}`, origin)
  } catch (er) {
  }

  return end('error=service')
})
