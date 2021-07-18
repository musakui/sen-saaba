import { Firestore } from '@google-cloud/firestore'
import { Unauthorized } from './errors.js'

const firestore = new Firestore({
  projectId: process.env.GCLOUD_PROJECT,
})

export const store = firestore.collection('saaba-store')
export const sessions = firestore.collection('saaba-sessions')

const allowedOrigins = process.env.CORS?.split(',') ?? '*'
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
  if (!authHeader) throw new Unauthorized('token required')
  const sess = sessions.doc(authHeader.split(' ')[1])
  const sessRef = await sess.get()
  if (!sessRef.exists) throw new Unauthorized('invalid token')
  const { token, uid } = await sessRef.data()
  return {
    doc: sess,
    token, uid,
  }
}
