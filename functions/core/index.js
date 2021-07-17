import { Firestore } from '@google-cloud/firestore'

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
    if (req.headers.cookie) {
      req.cookies = new Map(req.headers.cookie.split('; ').map((c) => c.split('=')))
    }
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