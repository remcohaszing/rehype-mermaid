import assert from 'node:assert/strict'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { type Element, type Root } from 'hast'
import prettier from 'prettier'
import { rehype } from 'rehype'
import rehypeMermaid from 'rehype-mermaid'
import { removePosition } from 'unist-util-remove-position'
import { type VFile } from 'vfile'
import { VFileMessage } from 'vfile-message'

const fixturesPath = new URL('../fixtures/', import.meta.url)
const fixtureNames = (await readdir(fixturesPath)).sort()

interface FixtureTest {
  input: string
  validate: (actual: VFile, verify?: boolean) => Promise<void>
}

async function readFixture(name: string, expectedName: string): Promise<FixtureTest> {
  const fixturePath = new URL(`${name}/`, fixturesPath)
  const inputPath = new URL('input.html', fixturePath)
  const expectedPath = new URL(expectedName, fixturePath)

  const input = await readFile(inputPath, 'utf8')
  let expected: string | undefined
  try {
    expected = await readFile(expectedPath, 'utf8')
  } catch {
    await writeFile(expectedPath, '')
  }

  return {
    input,
    async validate(actual, verify = true) {
      const config = await prettier.resolveConfig(fileURLToPath(expectedPath), {
        editorconfig: true
      })
      const normalized = await prettier.format(String(actual), { ...config, parser: 'html' })
      if (process.argv.includes('update') || !expected) {
        await writeFile(expectedPath, normalized)
      }
      if (verify) {
        assert.equal(normalized, expected)
      }
    }
  }
}

for (const name of fixtureNames) {
  describe(name, () => {
    test('img-png', async () => {
      const { input, validate } = await readFixture(name, 'img-png.html')
      const processor = rehype().use(rehypeMermaid, { strategy: 'img-png' })

      const result = await processor.process(input)

      await validate(result, false)
    })

    test('img-svg', async () => {
      const { input, validate } = await readFixture(name, 'img-svg.html')
      const processor = rehype().use(rehypeMermaid, { strategy: 'img-svg' })

      const result = await processor.process(input)

      await validate(result)
    })

    test('inline-svg', async () => {
      const { input, validate } = await readFixture(name, 'inline-svg.html')
      const processor = rehype().use(rehypeMermaid)

      const result = await processor.process(input)

      await validate(result)
    })

    test('pre-mermaid', async () => {
      const { input, validate } = await readFixture(name, 'pre-mermaid.html')
      const processor = rehype().use(rehypeMermaid, { strategy: 'pre-mermaid' })

      const result = processor.processSync(input)

      await validate(result)
    })
  })
}

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
      assert(error instanceof VFileMessage)
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
  let file: VFile | undefined
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
  assert(error instanceof Error)
  assert.equal(String(result), '<html><head></head><body>This error is handled</body></html>')
})

test('invalid diagram error fallback returns undefined', async () => {
  let element: Element | undefined
  let diagram: string | undefined
  let file: VFile | undefined
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
  assert(error instanceof Error)
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
