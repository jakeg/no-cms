// A ridiculously fast, custom replacement for a CMS :D
const fs = require('fs')
const crypto = require('crypto')
const chokidar = require('chokidar')
const path = require('path')
const mkdirp = require('mkdirp')
const ejs = require('ejs')
const yaml = require('js-yaml')
const glob = require('glob')
const moment = require('moment')
const markdownRender = require('./markdown-renderer.js')

// 'tags' are eg {% youtube sdfjosd7979 %} available in .md pages
require('../server-js/tags')
const { tags } = require('./tags.js')

// 'helpers' are methods we make available in our .ejs layouts
const helpers = require('../server-js/helpers')

const pagesDir = './pages'
const dataDir = './data'
const layoutsDir = './layouts'
const outputDir = './dist/html'
const dbFile = './no-cms-db.json'
const masterLayoutFile = './layouts/_master.ejs'
const masterLayoutTemplate = fs.readFileSync(masterLayoutFile, 'utf-8')

let config
let site
let db

// load all our global stuff
function init () {
  // prepare our site wide data
  site = {
    data: {},
    pages: [],
    layouts: []
  }

  // get YML from /data loaded
  fs.readdirSync(dataDir).forEach((file) => {
    const { dataKey, data } = extractData(file)
    site.data[dataKey] = data
  })

  // read all .md files, putting their yaml into site.pages
  const pageFiles = glob.sync(`${pagesDir}/**/*.md`)
  let page
  for (let file of pageFiles) {
    page = file.replace(pagesDir, '').slice(1)
    let { variables, content } = extractPage(page)
    variables.content = content
    variables.toJSON = function () {
      const cloned = { ...this } // so we don't modify original object
      delete cloned.content
      return cloned
    }
    site.pages.push(variables)
  }

  console.log(`${pageFiles.length} .md pages processed`)

  // read all layouts and layout partials, saving their hashes
  const layoutFiles = glob.sync(`${layoutsDir}/**/*.ejs`)
  let layout
  for (let file of layoutFiles) {
    layout = file.replace(layoutsDir, '').slice(1)
    let { variables, content } = extractLayout(layout)
    variables.content = content
    variables.toJSON = function () {
      const cloned = { ...this } // so we don't modify original object
      delete cloned.content
      return cloned
    }
    site.layouts.push(variables)
  }

  console.log(`${layoutFiles.length} .ejs layouts processed`)

  // read in the persistent db
  if (!fs.existsSync(dbFile)) {
    resetDb() // start with a fresh db
  } else {
    db = JSON.parse(fs.readFileSync(dbFile, 'utf8'))
  }
}

function renderAll () {
  const start = Date.now()
  console.log(`Rendering ${site.pages.length} pages...`)

  // if any layout has changed, force a naive re-render of all pages
  let forceRender = false
  for (let layout of site.layouts) {
    let found = db.layouts.find(dbLayout => dbLayout.path === layout.path)
    if (!found || found.ejsHash !== layout.ejsHash) {
      console.log(`Re-rendering all pages due to layout ${layout.path} change(s)`)
      forceRender = true
      break
    }
  }

  // if any /data has changed, force a naive re-render of all pages
  if (!forceRender) {
    if (JSON.stringify(site.data) !== JSON.stringify(db.data)) {
      console.log('Re-rendering all pages due to data file change')
      forceRender = true
    }
  }

  let saved = 0
  for (let page of site.pages) {
    saved += render(page.file, false, forceRender)
  }
  console.log(`... all rendered (${saved} changed/saved) in ${Date.now() - start}ms`)
  saveDb()
}

// watch stuff for changes, re-rendering when we need to
function watch () {
  const watcherOptions = {
    awaitWriteFinish: {
      // else I find 2 change events (at least under WSL)
      stabilityThreshold: 30
    }
  }

  // rebuild an individual page when the .md file for it changes
  const pageWatcher = chokidar.watch(pagesDir, watcherOptions)
  pageWatcher.on('ready', () => {
    console.log('Watching pages folder')
    for (let eventType of ['change', 'add']) {
      pageWatcher.on(eventType, (filePath) => {
        const page = filePath.split(path.sep).slice(1).join(path.sep)
        const start = Date.now()
        console.log(eventType, `Rendering ${page}...`)
        if (render(page)) {
          console.log(`...rendered ${page} in ${Date.now() - start}ms`)
          saveDb()
        }
      })
    }
    pageWatcher.on('unlink', (filePath) => {
      const page = filePath.split(/[/\\]/g).slice(1).join('/')
      const start = Date.now()
      console.log(`Deleting ${page}...`)
      fs.unlinkSync(path.join(outputDir, page).replace('.md', '.html'))
      console.log(`...deleted ${page} in ${Math.round(Date.now() - start)}ms`)
    })
  })

  // naively rebuild all pages when any layout changes
  const layoutWatcher = chokidar.watch(layoutsDir, watcherOptions)
  layoutWatcher.on('ready', () => {
    console.log('Watching layouts folder')
    for (let eventType of ['change', 'add', 'unlink']) {
      layoutWatcher.on(eventType, (filePath) => {
        // save the changed layout to the site.layouts object which will get saved to the db
        const layout = ('./' + filePath).replace(layoutsDir, '').slice(1)
        console.log(eventType, `Naive re-render of all pages for ${layout} layout change`)
        let { variables } = extractLayout(layout)
        site.layouts = site.layouts.map((item) => {
          return item.path === variables.path ? variables : item
        })
        renderAll()
      })
    }
  })

  // naively rebuild all pages when any data files change
  const dataWatcher = chokidar.watch(dataDir, watcherOptions)
  dataWatcher.on('ready', () => {
    console.log('Watching data folder')
    for (let eventType of ['change', 'add', 'unlink']) {
      dataWatcher.on(eventType, (filePath) => {
        // save the changed data to the site.data object which will get saved to the db
        const dataFile = ('./' + filePath).replace(dataDir, '').slice(1)
        console.log(eventType, `Naive re-render of all pages for ${dataFile} data change`)
        const { dataKey, data } = extractData(dataFile)
        site.data[dataKey] = data
        renderAll()
      })
    }
  })
}

function render (page, singlePage = true, forceRender = false) {
  // get our content file and extract the yml variables to send to ejs
  let { variables, markdown } = extractPage(page)

  // save to disk only if changed (ie hash is different) or singlePage (when rendering just one page)
  let save = false

  if (singlePage || forceRender) {
    save = true
    // save the changed page to the site.pages object which will get saved to the db
    site.pages = site.pages.map((item) => {
      return item.path === variables.path ? variables : item
    })
  } else {
    // check against the db if it has changed
    let found = db.pages.find(dbPage => dbPage.path === variables.path)
    if (!found || found.mdHash !== variables.mdHash) {
      save = true
    }
  }

  if (save) {
    // deal with {% tag plugins %}

    // start with the markdown variable

    // get {% tag blocks %} into an array, replacing with placeholders
    let matches = { selfClosing: {}, separateClosing: {} }

    // match and replace with placeholders all self/separate-closing tags
    for (let tagType in tags) {
      for (let tag in tags[tagType]) {
        let regex = '{% +' + tag + '.*? %}'
        if (tagType === 'separateClosing') {
          regex += '(.|\n|\r)*?{% end' + tag + ' %}'
        }
        const re = new RegExp(regex, 'g')
        matches[tagType][tag] = markdown.match(re)
        markdown = markdown.replace(re, `{{{${tag}}}}`)
      }
    }

    // for each separateClosing tag block, md->html on its content (if any)
    // and for both separate and self-closing, run tagName() with the args
    for (let tagType in matches) {
      for (let tag in matches[tagType]) {
        let i = 0
        if (matches[tagType][tag]) {
          for (let block of matches[tagType][tag]) {
            let re
            re = new RegExp('{% +' + tag + '.*? %}')
            let argMatches = block.match(re)[0]
            argMatches = argMatches.replace('{% ' + tag, '').replace('%}', '').trim()
            // regex from https://stackoverflow.com/questions/366202/regex-for-splitting-a-string-using-space-when-not-surrounded-by-single-or-double
            // arguments e.g. 'first "second argument" "third one here" fourth', space separated with quotes if multiple words
            argMatches = argMatches.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g)
            if (argMatches) {
              argMatches = argMatches.map(a => a.replace(/"/g, ''))
            } else {
              argMatches = []
            }
            if (tagType === 'separateClosing') {
              re = new RegExp('{% +' + tag + '.*? %}((.|\n|\r)*?){% end' + tag + ' %}')
              block = block.replace(re, '$1').trim()
              block = markdownRender(block)
            }
            // now run tagName(args, convertedContent) on it
            block = tags[tagType][tag](argMatches, tagType === 'separateClosing' ? block : null)
            matches[tagType][tag][i] = block.trim()
            i++
          }
        }
      }
    }

    // replace the placeholders with converted content in the markdown variable
    for (let tagType in matches) {
      for (let tag in matches[tagType]) {
        if (matches[tagType][tag]) {
          for (let match of matches[tagType][tag]) {
            const re = new RegExp('{{{' + tag + '}}}')
            markdown = markdown.replace(re, match)
          }
        }
      }
    }

    // now do markdownRender(markdown) on our markdown variable
    variables.content = markdownRender(markdown)

    // layout our page's content in its layout file
    const pageLayoutFile = `./layouts/${variables.layout}.ejs`
    const pageLayout = fs.readFileSync(pageLayoutFile, 'utf-8')
    const body = ejs.render(pageLayout, {
      config,
      site: { ...site }, // cloned so we don't edit it in the layout
      helpers,
      page: { ...variables } // cloned so we don't edit it in the layout
    }, { filename: pageLayoutFile })

    // apply the master layout around the outside
    let html = ''
    if (!variables.bare) {
      html = ejs.render(masterLayoutTemplate, {
        body,
        config,
        site: { ...site }, // cloned so we don't edit it in the layout
        helpers,
        page: { ...variables } // cloned so we don't edit it in the layout
      }, { filename: masterLayoutFile })
    } else {
      html = body
    }

    // actually save it to disk
    mkdirp.sync(path.join(outputDir, page).split(/(\/|\\)/).slice(0, -1).join('/'))
    fs.writeFileSync(path.join(outputDir, page).replace('.md', '.html'), html)
    return 1 // gets counted by renderAll
  } else {
    return 0
  }
}

function extractPage (page) {
  let markdown = fs.readFileSync(path.join(pagesDir, page), 'utf8')
  const mdHash = md5(markdown) // we compare this before saving renders to disk
  if (!markdown) {
    console.log(`Trying to render ${page} but it does not exist or is empty`)
    return false
  }
  let [variables] = markdown.match(/---(.|\n|\r)*?---/)
  markdown = markdown.replace(/---(.|\n|\r)*?---/, '')
  variables = variables.replace(/---/g, '').trim()
  variables = yaml.safeLoad(variables)
  variables.file = page
  variables.path = page.replace('.md', '.html')
  variables.mdHash = mdHash
  variables.rawContent = markdown
  variables.rawLength = markdown.length

  // get date as a moment.js object
  variables.date = variables.date || fs.statSync(path.join(pagesDir, page)).mtime
  variables.date = moment(variables.date)

  // defaults
  variables.layout = variables.layout || 'page'

  return { variables, markdown }
}

// get a layout's hash plus any partials it uses, so we know what to rebuild when a layout changes
function extractLayout (layout) {
  let ejs = fs.readFileSync(path.join(layoutsDir, layout), 'utf8')
  const ejsHash = md5(ejs) // we compare this before saving renders to disk
  if (!ejs) {
    console.log(`Trying to render ${layout} but it does not exist or is empty`)
    return false
  }
  const variables = {
    content: ejs,
    path: layout,
    ejsHash: ejsHash
  }
  return { variables, ejs }
}

function extractData (dataFile) {
  return {
    dataKey: dataFile.replace('.yml', ''),
    data: yaml.safeLoad(fs.readFileSync(path.join(dataDir, dataFile), 'utf8'))
  }
}

function md5 (str) {
  return crypto.createHash('md5').update(str).digest('hex')
}

function saveDb () {
  const json = JSON.stringify({ pages: site.pages, layouts: site.layouts, data: site.data })
  fs.writeFileSync(dbFile, json)
  console.log(`Saved to ${dbFile}`)
}

function resetDb () {
  db = { pages: [], layouts: [], data: {} }
}

module.exports = { init, watch, render, renderAll }
