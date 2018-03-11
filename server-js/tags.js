const { tagRegister } = require('../no-cms/tags.js')

tagRegister('youtube', (args) => {
  const youtubeId = args[0] || ''
  const width = args[1] || '560'
  const height = args[2] || '315'
  return `
    <iframe class="youtube-video" width="${width}" height="${height}" src="https://www.youtube.com/embed/${youtubeId}?rel=0" frameborder="0" allowfullscreen=""></iframe>
  `
})

tagRegister('prominent', (args, content) => {
  return `
    <div class="prominent">
      ${content}
    </div>
  `
}, { ends: true })
