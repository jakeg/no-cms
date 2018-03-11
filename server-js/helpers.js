// 'helpers' are methods we make available in our .ejs layouts
module.exports = {
  readTime: (page) => Math.ceil(page.rawLength / 1300)
}
