import express from 'express'
import { auth } from './auth.js'
import { info } from './info.js'
import { vm } from './vm.js'

const app = express()
app.use(express.json())
app.all('/auth', auth)
app.all('/info', info)
app.all('/vm', vm)

const port = process.env.PORT || 8080
app.listen(port, () => console.log(`listening on port ${port}`))
