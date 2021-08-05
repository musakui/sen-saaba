import { readFile, writeFile } from 'fs/promises'
import { minify } from 'terser'

const read = (fn) => readFile(`./node_modules/pkg/${fn}`, 'utf8')

const bootstrapArgs = [
  'REQUIRE_COMMON',
  'VIRTUAL_FILESYSTEM',
  'DEFAULT_ENTRYPOINT',
  'SYMLINKS',
  'DICT',
  'DOCOMPRESS',
]

await Promise.all([
  read('prelude/bootstrap.js').then(async (text) => {
    const front = `const run=(${bootstrapArgs.join(',')})=>{`
    const result = await minify(`${front}${text}}`, {
      mangle: {
        reserved: [
          ...bootstrapArgs,
        ],
      },
    })
    await writeFile('./bootstrap.min.js', result.code.slice(front.length, -2))
  }),
  read('lib-es5/common.js').then(async (text) => {
    const { code } = await minify(text)
    await writeFile('./common.min.js', code)
  }),
])
