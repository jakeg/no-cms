const marked = require('marked')
const MarkedRenderer = marked.Renderer

// see https://github.com/chjj/marked for usage

function Renderer () {
  MarkedRenderer.apply(this)
  this._headingId = {}
}

require('util').inherits(Renderer, MarkedRenderer)

module.exports = (str) => {
  // options usage https://github.com/chjj/marked#options-1
  return marked(str, {
    renderer: new Renderer(),
    langPrefix: '',
    gfm: true,
    pedantic: false,
    sanitize: false,
    tables: true,
    breaks: false,
    smartLists: true,
    smartypants: true,
    modifyAnchors: '',
    autolink: false
  })
}
