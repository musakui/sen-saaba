import express from 'express'

const routes = [
  'auth',
  'info',
  'vm',
]

const app = express()
app.use(express.json())
await Promise.all(routes.map(async (name) => {
  const { [name]: handler } = await import(`./${name}.js`)
  app.all(`/${name}`, handler)
}))

const port = process.env.PORT || 8080
app.listen(port, () => console.log(`listening on port ${port}`))
