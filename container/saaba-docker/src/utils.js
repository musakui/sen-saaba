import { spawn } from 'child_process'
import { readFile as read } from 'fs/promises'

export const log = (...args) => console.info(...args)

export const readFile = (fn) => read(fn, 'utf8').then((t) => t.trim())

export const millis = (m) => new Promise((resolve) => setTimeout(resolve, m))

export const run = (cmd, args = []) => new Promise((resolve, reject) => {
  const proc = spawn(cmd, args)
  proc.on('spawn', () => resolve(proc))
  proc.on('error', (err) => reject(err))
})
