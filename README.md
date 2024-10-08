# rehype-mermaid

[![github actions](https://github.com/remcohaszing/rehype-mermaid/actions/workflows/ci.yaml/badge.svg)](https://github.com/remcohaszing/rehype-mermaid/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/remcohaszing/rehype-mermaid/branch/main/graph/badge.svg)](https://codecov.io/gh/remcohaszing/rehype-mermaid)
[![npm version](https://img.shields.io/npm/v/rehype-mermaid)](https://www.npmjs.com/package/rehype-mermaid)
[![npm downloads](https://img.shields.io/npm/dm/rehype-mermaid)](https://www.npmjs.com/package/rehype-mermaid)

A [rehype](https://rehype.js.org) plugin to render [mermaid](https://mermaid-js.github.io) diagrams.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
  - [`'img-png'`](#img-png)
  - [`'img-svg'`](#img-svg)
  - [`'inline-svg'`](#inline-svg)
  - [`'pre-mermaid'`](#pre-mermaid)
- [API](#api)
  - [`unified().use(rehypeMermaid, options?)`](#unifieduserehypemermaid-options)
- [Examples](#examples)
  - [remark](#remark)
  - [MDX](#mdx)
- [Compatibility](#compatibility)
- [Related Projects](#related-projects)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## Installation

```sh
npm install rehype-mermaid
```

Outside of browsers `rehype-mermaid` uses [Playwright](https://playwright.dev). If you use this
outside of a browser, you need to install Playwright and a Playwright browser.

```sh
npm install playwright
npx playwright install --with-deps chromium
```

See the Playwright [Browsers](https://playwright.dev/docs/browsers) documentation for more
information.

## Usage

This plugin takes all `<pre class="mermaid">` and `<code class="language-mermaid">` elements, and
replaces them with a rendered version of the diagram. If the `<code>` element is wrapped in a
`<pre>` element, the `<pre>` element is replaced as well. This is compatible with what Mermaid would
render client side, as well as the output of `mermaid` code blocks processed by
[`remark-rehype`](https://github.com/remarkjs/remark-rehype).

The plugin has several rendering strategies described below.

Given a file named `index.html`:

```html
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <pre><code class="language-mermaid">
      graph TD;
          A-->B;
          A-->C;
          B-->D;
          C-->D;
    </code></pre>
    <pre class="mermaid">
      graph TD;
          A-->B;
          A-->C;
          B-->D;
          C-->D;
    </pre>
  </body>
</html>
```

The following script:

```js
import { readFile } from 'node:fs/promises'

import { rehype } from 'rehype'
import rehypeMermaid from 'rehype-mermaid'

const { value } = await rehype()
  .use(rehypeMermaid, {
    // The default strategy is 'inline-svg'
    // strategy: 'img-png'
    // strategy: 'img-svg'
    // strategy: 'inline-svg'
    // strategy: 'pre-mermaid'
  })
  .process(await readFile('index.html'))

console.log(value)
```

Yields the following results, depending on the stragey used.

### `'img-png'`

This strategy renders a diagram as an `<img>` element with an inline base64 PNG image. Given the
example, this yields:

```html
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <img alt="" height="215" id="mermaid-0" src="data:image/png;base64,iVBORw0KGgoA…" width="118" />
    <img alt="" height="215" id="mermaid-1" src="data:image/png;base64,iVBORw0KGgoA…" width="118" />
  </body>
</html>
```

This strategy is asynchronous.

This strategy supports the [`dark`](#dark) option.

### `'img-svg'`

This strategy renders a diagram as an `<img>` element with an inline SVG image. Given the example,
this yields:

```html
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <img alt="" height="215" id="mermaid-0" src="data:image/xml+svg,%3csvg…" width="118" />
    <img alt="" height="215" id="mermaid-1" src="data:image/xml+svg,%3csvg…" width="118" />
  </body>
</html>
```

This strategy is asynchronous.

This strategy supports the [`dark`](#dark) option.

### `'inline-svg'`

This strategy renders a diagram as an inline `<svg>` element. Given the example, this yields:

```html
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <svg id="mermaid-0" …>…</svg>
    <svg id="mermaid-1" …>…</svg>
  </body>
</html>
```

This strategy is asynchronous.

This strategy does not support the [`dark`](#dark) option.

### `'pre-mermaid'`

This strategy replaces the element with a `<pre class="mermaid">` element with only the diagram as
its child. Given the example, this yields:

```html
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <pre class="mermaid">
      graph TD;
          A-->B;
          A-->C;
          B-->D;
          C-->D;
    </pre>
    <pre class="mermaid">
      graph TD;
          A-->B;
          A-->C;
          B-->D;
          C-->D;
    </pre>
  </body>
</html>
```

This allows Mermaid to render the diagram on the client side, for example using:

```js
import mermaid from 'mermaid'

mermaid.initialize({ startOnLoad: true })
```

This strategy is synchronous.

This strategy does not support the [`dark`](#dark) option.

## API

This package has a default export `rehypeMermaid`.

### `unified().use(rehypeMermaid, options?)`

#### `options`

##### `browser`

The Playwright browser to use. (`object`, default: chromium)

##### `colorScheme`

The default color scheme.

If not specified, `rehype-mermaid` will determine the color scheme based on the `color-scheme` meta
tag. If this doesn’t exist, the default color scheme is `light`. (`string`)

##### `css`

A URL that points to a custom CSS file to load. Use this to load custom fonts. This option is
ignored in the browser. You need to include the CSS in your build manually. (`string` | `URL`)

##### `dark`

If specified, add responsive dark mode using a `<picture>` element.

This option is only supported by the [`img-png`](#img-png) and [`img-svg`](#img-svg) strategies.

##### `errorFallback`

Create a fallback node if processing of a mermaid diagram fails. If nothing is returned, the code
block is removed. The function receives the following arguments:

- `element` The hast element that could not be rendered.
- `diagram` The Mermaid diagram that could not be rendered as a string.
- `error`: The error that was thrown.
- `file`: The file on which the error occurred.

##### `launchOptions`

The options used to launch the browser. (`object`)

##### `mermaidConfig`

A custom Mermaid configuration. By default `fontFamily` is set to `arial,sans-serif`. This option is
ignored in the browser. You need to call `mermaid.initialize()` manually. (`object`)

##### `prefix`

A custom prefix to use for Mermaid IDs. (`string`, default: `mermaid`)

##### `strategy`

The render strategy to use. One of [`'img-png'`](#img-png), [`'img-svg'`](#img-svg),
[`'inline-svg'`](#inline-svg), or [`'pre-mermaid'`](#pre-mermaid). (default:
[`'inline-svg'`](#inline-svg))

## Examples

### remark

This package works with Mermaid codeblocks in markdown using
[`remark-parse`](https://github.com/remarkjs/remark/tree/main/packages/remark-parse),
[`remark-rehype`](https://github.com/remarkjs/remark-rehype), and
[`rehype-stringify`](https://github.com/rehypejs/rehype/tree/main/packages/rehype-stringify).

```js
import rehypeMermaid from 'rehype-mermaid'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

const processor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeMermaid)
  .use(rehypeStringify)

const markdown = `
# Mermaid Diagram

\`\`\`mermaid
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
\`\`\`
`

const { value } = await processor.process(markdown)

console.log(value)
```

### MDX

This package works with Mermaid codeblocks in MDX.

```js
import { compile } from '@mdx-js/mdx'
import rehypeMermaid from 'rehype-mermaid'

const mdx = `
# Mermaid Diagram

\`\`\`mermaid
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
\`\`\`
`

const { value } = await compile(mdx, {
  rehypePlugins: [rehypeMermaid]
})

console.log(value)
```

## Compatibility

This project is compatible with Node.js 18 or greater. It’s compatible with `mermaid` code blocks
processed by [`remark-rehype`](https://github.com/remarkjs/remark-rehype). This means it’s also
compatible with [MDX](https://mdxjs.com).

## Related Projects

- [`mermaid`](https://mermaid.js.org) is the library that’s used to render the diagrams.
- [`mermaid-isomorphic`](https://github.com/remcohaszing/mermaid-isomorphic) allows this package to
  render Mermaid diagrams in both Node.js and the browser.
- [`rehype`](https://github.com/rehypejs/rehype) provides HTML processing using a
  [unified](https://unifiedjs.com) pipeline.

## Contributing

Test fixtures are generated and verified using Linux. Rendering on other platforms may yield
slightly different results. Don’t worry about adding new fixtures, but don’t update existing ones
that cause CI to fail. Furthermore see my global
[contributing guidelines](https://github.com/remcohaszing/.github/blob/main/CONTRIBUTING.md).

## Acknowledgements

Thanks to [@bitekong](https://github.com/bitekong) for giving me the npm package name.

## License

[MIT](LICENSE.md) © [Remco Haszing](https://github.com/remcohaszing)
