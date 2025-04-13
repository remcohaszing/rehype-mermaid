import assert from 'node:assert/strict'
import { test } from 'node:test'

import { type Element, type Root } from 'hast'
import { rehype } from 'rehype'
import rehypeMermaid from 'rehype-mermaid'
import { testFixturesDirectory } from 'snapshot-fixtures'
import { removePosition } from 'unist-util-remove-position'
import { type VFile } from 'vfile'
import { VFileMessage } from 'vfile-message'

testFixturesDirectory({
  directory: new URL('../fixtures', import.meta.url),
  prettier: true,
  write: true,
  tests: {
    'img-png.html': {
      // PNG generation isn’t pixel perfect.
      ignore: true,
      generate(input) {
        const processor = rehype().use(rehypeMermaid, { strategy: 'img-png' })

        return processor.process(input)
      }
    },

    'img-png-dark.html': {
      // PNG generation isn’t pixel perfect.
      ignore: true,
      generate(input) {
        const processor = rehype().use(rehypeMermaid, { strategy: 'img-png', dark: true })

        return processor.process(input)
      }
    },

    'img-png-dark-custom.html': {
      // PNG generation isn’t pixel perfect.
      ignore: true,
      generate(input) {
        const processor = rehype().use(rehypeMermaid, {
          strategy: 'img-png',
          dark: { theme: 'forest' }
        })

        return processor.process(input)
      }
    },

    'img-svg.html'(input) {
      const processor = rehype().use(rehypeMermaid, { strategy: 'img-svg' })

      return processor.process(input)
    },

    'img-svg-dark.html'(input) {
      const processor = rehype().use(rehypeMermaid, { strategy: 'img-svg', dark: true })

      return processor.process(input)
    },

    'img-svg-dark-custom.html'(input) {
      const processor = rehype().use(rehypeMermaid, {
        strategy: 'img-svg',
        dark: { theme: 'forest' }
      })

      return processor.process(input)
    },

    'inline-svg.html'(input) {
      const processor = rehype().use(rehypeMermaid)

      return processor.process(input)
    },

    'pre-mermaid.html'(input) {
      const processor = rehype().use(rehypeMermaid, { strategy: 'pre-mermaid' })

      return processor.processSync(input)
    }
  }
})

test('invalid strategy', () => {
  const processor = rehype()
    // @ts-expect-error We deliberately pass an invalid strategy.
    .use(rehypeMermaid, { strategy: 'invalid' })

  assert.throws(
    () => processor.process(''),
    new Error(
      'Expected strategy to be one of img-png, img-svg, inline-svg, pre-mermaid, got: invalid'
    )
  )
})

test('invalid diagram unhandled', async () => {
  const processor = rehype().use(rehypeMermaid)

  await assert.rejects(
    () => processor.process('<pre class="mermaid">This is not a valid diagram</pre>'),
    (error) => {
      assert.ok(error instanceof VFileMessage)
      assert.equal(error.source, 'rehype-mermaid')
      assert.equal(error.ruleId, 'rehype-mermaid')
      assert.equal(
        error.reason,
        'No diagram type detected matching given configuration for text: This is not a valid diagram'
      )
      assert.deepEqual(error.place, {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 55, offset: 54 }
      })
      assert.equal(error.url, 'https://github.com/remcohaszing/rehype-mermaid')
      const root = error.ancestors![0] as Root
      const html = root.children[0] as Element
      const body = html.children[1] as Element
      const pre = body.children[0] as Element
      assert.equal(root.type, 'root')
      assert.deepEqual(error.ancestors, [root, html, body, pre])
      return true
    }
  )
})

test('invalid diagram error fallback returns replacement', async () => {
  let element: Element | undefined
  let diagram: string | undefined
  let file: undefined | VFile
  let error: unknown

  const processor = rehype().use(rehypeMermaid, {
    errorFallback(...args) {
      ;[element, diagram, error, file] = args
      return { type: 'text', value: 'This error is handled' }
    }
  })

  const result = await processor.process('<pre class="mermaid">This is not a valid diagram</pre>')

  assert.ok(element)
  removePosition(element, { force: true })
  assert.deepEqual(element, {
    type: 'element',
    tagName: 'pre',
    properties: { className: ['mermaid'] },
    children: [{ type: 'text', value: 'This is not a valid diagram' }]
  })
  assert.equal(diagram, 'This is not a valid diagram')
  assert.equal(file, result)
  assert.ok(error instanceof Error)
  assert.equal(String(result), '<html><head></head><body>This error is handled</body></html>')
})

test('invalid diagram error fallback returns undefined', async () => {
  let element: Element | undefined
  let diagram: string | undefined
  let file: undefined | VFile
  let error: unknown

  const processor = rehype().use(rehypeMermaid, {
    errorFallback(...args) {
      ;[element, diagram, error, file] = args
    }
  })

  const result = await processor.process('<pre class="mermaid">This is not a valid diagram</pre>')

  assert.ok(element)
  removePosition(element, { force: true })
  assert.deepEqual(element, {
    type: 'element',
    tagName: 'pre',
    properties: { className: ['mermaid'] },
    children: [{ type: 'text', value: 'This is not a valid diagram' }]
  })
  assert.equal(diagram, 'This is not a valid diagram')
  assert.equal(file, result)
  assert.ok(error instanceof Error)
  assert.equal(String(result), '<html><head></head><body></body></html>')
})

test('className as string', async () => {
  const processor = rehype().use(rehypeMermaid, { strategy: 'pre-mermaid' })
  const ast = await processor.run({
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: { className: 'language-mermaid' },
            children: [{ type: 'text', value: 'graph TD;' }]
          }
        ]
      }
    ]
  })

  assert.deepEqual(ast, {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'pre',
        properties: { className: ['mermaid'] },
        children: [{ type: 'text', value: 'graph TD;' }]
      }
    ]
  })
})
