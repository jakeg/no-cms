const noCMS = require('./index.js')

if (process.argv.length < 3) {
  console.log(`
    Usage:
      no-cms generate       [build all, eg for production]
      no-cms generate -w    [build all and watch files for changes, eg in dev]
  `)
  process.exit()
}

const generate = (process.argv[2] === 'generate')
const watch = (process.argv[3] === '-w')

noCMS.init()
if (generate) noCMS.renderAll()
if (watch) noCMS.watch()
