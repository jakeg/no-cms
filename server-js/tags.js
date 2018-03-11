// 'tags' are available in our .md files, e.g. {% youtube sdfi34343 %}

const { tagRegister } = require('../no-cms/tags.js')

tagRegister('youtube', (args) => {
  const youtubeId = args[0] || ''
  return `
    <iframe class="youtube-video" width="560" height="315" src="https://www.youtube.com/embed/${youtubeId}?rel=0" frameborder="0" allowfullscreen=""></iframe>
  `
})

tagRegister('prominent', (args, content) => {
  return `
    <div class="prominent">
      ${content}
    </div>
  `
}, { ends: true })
