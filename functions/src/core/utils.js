import { randomBytes } from 'crypto'

import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

export const millis = (d) => new Promise((resolve) => setTimeout(resolve, t))

export const random = (len = 16) => randomBytes(len * 2)
  .toString('base64').replace(/[=\+\/]/g, '').slice(0, len)

const sec = new SecretManagerServiceClient()
export const getSecret = (name) => sec.accessSecretVersion({ name }).then(([v]) => v.payload.data.toString())

