# no-cms

Escape your CMS and be free: JS pre-rendering, GitHub and Heroku.

```bash
# Install
npm install

# For local development with static pages rebuilding on changes
npm run dev

# For deployments
npm run build && npm start

# To clean up all built files
npm run clean
```

## Things it uses

- [EJS](http://ejs.co/) for layouts
- [Marked](https://github.com/markedjs/marked) for Markdown to HTML conversion for pages
- [ExpressJS](http://expressjs.com/) for a very simple server
- [JS-YAML](https://github.com/nodeca/js-yaml) to parse YAML into JS

## How does it work

### Pages (`/pages`)

Create a folder `/pages` and put `.md` markdown files in it, each one can have YAML front-matter at the top, like this:

```yml
---
layout: blog
title: This is the page title
some-variable: Have whatever variables you want
---
```

... then below your YAML front-matter, put the markdown for the page, like this:

```markdown
## This will become an H2 element

This will be **be bold** and _italic_.

We can have [a link](/path/to).
```

You can use any depth of sub-folders, and if you have a folder called `blah` rather than making `blah.md` put a file called `_index.md` in the folder `blah` instead.

### Layouts (`/layouts`)

Create a folder `/layouts` and put `.ejs` files in it. Pages will always use `_master.ejs` and `[layout].ejs`, where `layout` is from the `layout: blah` YAML front-matter variable in the page `.md` file. Common components can be included like this: `<%- include('partial/header') %>`.

The layout can access variables set in the page's YAML, such as `page.title`.

### Data (`/data`)

Files in `/data` should contain YAML and will be added to `site.data[file-name]`. So:

```yaml
# config.yml
default-title: Default page title
some-variable: Yes please
```

... will result in `site.data.config` being `{ 'default-title': 'Default page title', 'some-variable': 'Yes please' }`. You can access these variables within `.ejs` layouts or `.md` page files.

## Extending

### Helpers

These are accessible within your layout `.ejs` files. Create a file `/server-js/helpers.js` with something like this:

```javascript
module.exports = {
  readTime: (page) => Math.ceil(page.rawLength / 1300)
}
```
... now access within your layout `.ejs` file like this: `Read time: <%- helpers.readTime(page) %> minutes`.

### Tags

These are for use in your page `.md` files. Create a file `/server-js/tags.js` with something like this:

```javascript
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
```

... you can then use these like this:

```markdown

To insert a Youtube video:

{% youtube josdf793934 %}

To add some content within a `div.prominent`:

{% prominent %}
  Markdown **allowed here**.
{% endprominent %}
```

... this saves you from having to have HTML in your `.md` page files (but you still can if you want).

## Ideas for improvements and how to customise

- Can't imagine it being too hard to change from eg using EJS to using server-side Vue/React (even isomorphic rendering) or other alternatives instead.

- Just hack away at the files - there's less than 500 lines of JS in total.

- Make `npm run dev` cleverer in terms of when to rebuild watched files.
