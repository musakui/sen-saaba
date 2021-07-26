import { random } from '../core/utils.js'
import { sessions, getSession, createFunction } from '../core/index.js'
import { authUrl, getToken, revoke } from '../core/twitchAuth.js'

const appUrl = process.env.APP_URL
const redirect = (res, url, frag = '') => {
  res.redirect(302, `https://${url || appUrl}/#${frag}`)
}

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
  redirect(res, url)
}

const now = () => Date.now() / 1000

const tokens = async (code, refresh = false) => {
  const info = await getToken(code, refresh)
  return {
    token: info.access_token,
    expiry: Math.floor(now() + info.expires_in),
    refresh: info.refresh_token,
  }
}

export const auth = createFunction(async (req, res) => {
  if (req.query.logout) return await logout(res, req.query)
  try {
    const sess = await getSession(req)
    if ((sess.expiry - now()) > 7200) return { token: sess.token }
    const info = await tokens(sess.refresh, true)
    await sess.doc.update(info)
    return { token: info.token }
  } catch (er) {
  }
  if (!req.query.code) return await login(res, req.query.url)

  const end = (frag) => redirect(res, '', frag)

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
    const info = await tokens(req.query.code)
    const origin = await (await doc.get()).get('origin')
    await doc.set(info)
    return redirect(res, origin, `token=${doc.id}`)
  } catch (er) {
  }

  return end('error=service')
})
