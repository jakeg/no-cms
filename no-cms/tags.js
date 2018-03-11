// {% %} tags for our Hexo replacement

const tags = {
  selfClosing: {},
  separateClosing: {}
}

function tagRegister (name, method, options) {
  const tagType = (options && options.ends) ? 'separateClosing' : 'selfClosing'
  tags[tagType][name] = method
}

module.exports = { tagRegister, tags }
