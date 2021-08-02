import { Firestore } from '@google-cloud/firestore'
import * as errors from './errors.js'

const {
  CORS = '*',
  USER_STORE,
  SESSION_STORE,
  GCLOUD_PROJECT: projectId,
  TWITCH_CLIENT_ID: twitchClientId,
} = process.env

const firestore = new Firestore({
  projectId,
})

export const store = firestore.collection(USER_STORE)
export const sessions = firestore.collection(SESSION_STORE)

const allowedOrigins = CORS.split(',')
const serverError = { error: '?', message: 'something went wrong' }

export const createFunction = (handler) => (req, res) => {
  res.set('Access-Control-Allow-Origin', allowedOrigins)
  res.set('Access-Control-Allow-Credentials', 'true')
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET,POST,DELETE')
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    res.set('Access-Control-Max-Age', '3600')
    res.status(204).send('')
  } else {
    handler(req, res)
      .then((resp) => resp && res.status(200).send(resp))
      .catch((err) => {
        if (err.httpStatus) {
          const { httpStatus, ...info } = err
          res.status(httpStatus).send(info)
        } else {
          console.error(err)
          res.status(500).send(serverError)
        }
      })
  }
}

export const getSession = async (req) => {
  const authHeader = req.header('Authorization')
  if (!authHeader) throw new errors.Unauthorized('token required')
  const sid = authHeader.split(' ')[1]
  const sess = sessions.doc(sid)
  const sessRef = await sess.get()
  if (!sessRef.exists) throw new errors.Unauthorized('invalid token')
  return {
    sid,
    doc: sess,
    ...(await sessRef.data()),
  }
}

export {
  errors,
  twitchClientId,
}
