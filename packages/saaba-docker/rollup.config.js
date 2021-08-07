import replace from '@rollup/plugin-replace'
import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'

import { version, main, bin } from './package.json'

export default {
  input: main,
  output: {
    file: bin,
    format: 'cjs',
    compact: true,
  },
  external: [
  ],
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        'process.env.npm_package_version': `"${version}"`,
        'process.env.CONFIG_DIR': '""',
      }
    }),
    nodeResolve({
      dedupe: ['ws'],
      exportConditions: ['node', 'module', 'import', 'default'],
    }),
    commonjs({
      ignore: [
        'bufferutil',
        'utf-8-validate',
      ],
    }),
    terser({
      ecma: 2015,
      compress: {
        toplevel: true,
        unsafe_math: true,
      },
      format: {
        comments: false,
      },
    }),
  ],
}
