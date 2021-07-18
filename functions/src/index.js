import express from 'express'
import { auth } from './auth.js'
import { info } from './info.js'

const app = express()
app.all('/auth', auth)
app.all('/info', info)
const port = process.env.PORT || 8080
app.listen(port, () => console.log(`listening on port ${port}`))
