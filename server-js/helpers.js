// 'helpers' are methods we make available in our .ejs layouts

const helpers = {}

// estimated read time based on raw length of the markdown
helpers.readTime = (page) => {
  return Math.ceil(page.rawLength / 1300)
}

module.exports = helpers
