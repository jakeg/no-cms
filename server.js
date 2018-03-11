const path = require('path')
const fs = require('fs')
const compression = require('compression')
const express = require('express')
const yaml = require('js-yaml')

const app = express()
const host = process.env.HOST || '0.0.0.0'
const port = process.env.PORT || 3000
const redirects = yaml.safeLoad(fs.readFileSync('./data/redirects.yml', 'utf8'))

app.use(compression({ threshold: 0 })) // gzip

// serve up the generated static pages
app.use(express.static('dist/html', { extensions: ['html'], index: '_index.html' }))

// serve up static assets
app.use('/', express.static('assets'))

// example custom route
app.get('/special', (req, res) => {
  res.json({some: 'json stuff'})
})

// 301 redirects for eg SEO
app.use((req, res, next) => {
  const path = req.path
  if (redirects[path]) {
    console.log(`301 redirect: ${path} -> ${redirects[path]}`)
    res.redirect(301, redirects[path])
  } else {
    next()
  }
})

// 404s
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '/dist/html/404.html'))
})

app.listen(port, host)
console.log(`Server listening on ${host}:${port}`)
