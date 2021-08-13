export { createControllerApi, getSrtStream } from './api.js'

export const getObsUrl = (url) => {
  const u = new URL(url)
  u.pathname = '/obs'
  u.protocol = u.protocol.replace('http', 'ws')
  return u
}

export const getSrtUrl = (url, port) => {
  const u = new URL(url)
  u.port = port
  u.protocol = 'srt'
  return u.toString()
}
