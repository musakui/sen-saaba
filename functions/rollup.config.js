import { nodeResolve } from '@rollup/plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'

export default {
  output: {
    file: 'index.js',
    format: 'esm',
  },
  external: [
    'node-fetch',
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
