import { nodeResolve } from '@rollup/plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'

const common = new Set('index,errors,utils'.split(','))

export default {
  input: 'src/index.js',
  output: {
    dir: 'dist',
    format: 'esm',
    chunkFileNames: '[name].js',
    manualChunks (id) {
      const match = /(\/core\/)?([^\/]+).js$/.exec(id)
      if (!match[1]) return match[2]
      if (common.has(match[2])) return 'common'
    },
  },
  external: [
    'express',
    'node-fetch',
    '@google-cloud/dns',
    '@google-cloud/compute',
    '@google-cloud/firestore',
    '@google-cloud/secret-manager',
  ],
  plugins: [
    nodeResolve(),
    terser({
      ecma: 2015,
      compress: {
        toplevel: true,
      },
      format: {
        comments: false,
      },
    }),
  ],
}
