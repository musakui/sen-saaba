import { api } from './core/twitch.js'
import { store, getSession, createFunction } from './core/index.js'

const getUser = (token) => api(token, 'users').then(({ data }) => {
  if (!data) return { id: 'expired', token }
  const u = data[0]
  const { id, login, display_name, profile_image_url, email } = u
  return {
    id,
    email,
    info: {
      login,
      name: display_name,
      avatar: profile_image_url,
    },
  }
})

export const info = createFunction(async (req, res) => {
  const { token, ...sess } = await getSession(req)
  const data = {}
  const tasks = []
  if (!sess.uid) {
    const { id, ...user } = await getUser(token)
    sess.uid = id
    const prefix = `s-${user.info.login.replace(/_/g, '-')}`
    user.app = { tier: 0, prefix }
    Object.assign(data, user, { email: undefined })
    tasks.push(sess.doc.update({ uid: id }), store.doc(id).set(user))
  } else {
    const doc = store.doc(sess.uid)
    const { email, ...dt } = await (await doc.get()).data()
    Object.assign(data, dt)
    tasks.push(getUser(token).then(({ id, ...u }) => store.doc(id).update(u)))
  }
  if (req.method === 'POST') {
    console.log('post', req.body)
  }
  Promise.all(tasks).then((t) => console.log('done tasks:', t.length))
  return { status: 'ok', ...data }
})
