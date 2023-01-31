import { type Content, type Element, type Root } from 'hast'
import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic'
import { toText } from 'hast-util-to-text'
import {
  createMermaidRenderer,
  type CreateMermaidRendererOptions,
  type RenderOptions
} from 'mermaid-isomorphic'
import svgToDataURI from 'mini-svg-data-uri'
import { parse } from 'space-separated-tokens'
import { type Plugin } from 'unified'
import { visitParents } from 'unist-util-visit-parents'
import { type VFile } from 'vfile'

interface CodeInstance {
  /**
   * The mermaid diagram.
   */
  diagram: string

  /**
   * The hast node that should be replaced.
   */
  node: Element

  /**
   * The parent of the node that should be replaced.
   */
  parent: Element | Root
}

/**
 * A regular expression to test for non-whitespace characters.
 */
const nonWhitespacePattern = /\w/

/**
 * Allowed output strategies.
 */
type Strategy = 'img-png' | 'img-svg' | 'inline-svg' | 'pre-mermaid'

const strategies: Strategy[] = ['img-png', 'img-svg', 'inline-svg', 'pre-mermaid']

/**
 * Validate the strategy option is valid.
 *
 * @param strategy The user provided strategy.
 * @returns The strategy if valid.
 */
function validateStrategy(strategy: Strategy | undefined = 'inline-svg'): Strategy {
  if (strategies.includes(strategy)) {
    return strategy
  }
  throw new Error(`Expected strategy to be one of ${strategies.join(', ')}, got: ${strategy}`)
}

/**
 * Check if a hast element has the `lang-mermaid` class name.
 *
 * @param element The hast element to check.
 * @param strategy The mermaid strategy to use.
 * @returns Whether or not the element has the `lang-mermaid` class name.
 */
function isMermaidElement(element: Element, strategy: Strategy): boolean {
  let mermaidClassName: string

  if (element.tagName === 'pre') {
    if (strategy === 'pre-mermaid') {
      return false
    }
    mermaidClassName = 'mermaid'
  } else if (element.tagName === 'code') {
    mermaidClassName = 'lang-mermaid'
  } else {
    return false
  }

  let className = element.properties?.className
  if (typeof className === 'string') {
    className = parse(className)
  }

  if (!Array.isArray(className)) {
    return false
  }

  return className.includes(mermaidClassName)
}

export interface RehypeMermaidOptions
  extends CreateMermaidRendererOptions,
    Omit<RenderOptions, 'format'> {
  /**
   * Create a fallback node if processing of a mermaid diagram fails.
   *
   * @param element The hast element that could not be rendered.
   * @param diagram The Mermaid diagram that could not be rendered.
   * @param error The error that was thrown.
   * @param file The file on which the error occurred.
   * @returns A fallback node to render instead of the invalid diagram. If nothing is returned, the
   *   code block is removed
   */
  errorFallback?: (
    element: Element,
    diagram: string,
    error: unknown,
    file: VFile
  ) => Content | null | undefined | void

  /**
   * How to insert the rendered diagram into the document.
   *
   * - `'img-png'`: An `<img>` tag with the diagram as a base64 PNG data URL.
   * - `'img-svg'`: An `<img>` tag with the diagram as an SVG data URL.
   * - `'inline-svg'`: The SVG image as an inline `<svg>` element.
   * - `'pre-mermaid'`: The raw mermaid diagram as a child of a `<pre class="mermaid">` element.
   *
   * @default 'inline-svg'
   */
  strategy?: Strategy
}

/**
 * A [rehype](https://rehype.js.org) plugin to render [mermaid](https://mermaid-js.github.io)
 * diagrams.
 *
 * @param options Options that may be used to tweak the output.
 */
const rehypeMermaid: Plugin<[RehypeMermaidOptions?], Root> = (options) => {
  const strategy = validateStrategy(options?.strategy)
  const renderDiagrams = createMermaidRenderer(options)

  return async (ast, file) => {
    const instances: CodeInstance[] = []

    visitParents(ast, 'element', (node: Element, ancestors: (Element | Root)[]) => {
      if (!isMermaidElement(node, strategy)) {
        return
      }

      let codeElement = node
      let parent = ancestors[ancestors.length - 1]

      // This is <code> wrapped in a <pre> element.
      if (parent.type === 'element' && parent.tagName === 'pre') {
        for (const child of parent.children) {
          // We allow whitespace text siblings, but any other siblings mean we don’t process the
          // diagram.
          if (child.type === 'text') {
            if (nonWhitespacePattern.test(child.value)) {
              return
            }
          } else if (child !== node) {
            return
          }
        }

        // We want to replace the parent (<pre>), not the child (<code>).
        codeElement = parent
        // The grantparent becomes the parent.
        parent = ancestors[ancestors.length - 2]
      }

      instances.push({
        node: codeElement,
        diagram: toText(node, { whitespace: 'pre' }),
        parent
      })
    })

    // Nothing to do. No need to start a browser in this case.
    if (!instances.length) {
      return
    }

    if (strategy === 'pre-mermaid') {
      for (const { diagram, node, parent } of instances) {
        parent.children[parent.children.indexOf(node)] = {
          type: 'element',
          tagName: 'pre',
          properties: {
            className: ['mermaid']
          },
          children: [{ type: 'text', value: diagram }]
        }
      }
      return
    }

    const results = await renderDiagrams(
      instances.map((instance) => instance.diagram),
      { ...options, screenshot: strategy === 'img-png' }
    )

    for (const [index, { diagram, node, parent }] of instances.entries()) {
      let replacement: Content | null | undefined | void
      const result = results[index]

      if (result.status === 'fulfilled') {
        const { description, height, id, screenshot, svg, title, width } = result.value

        if (screenshot) {
          replacement = {
            type: 'element',
            tagName: 'img',
            properties: {
              alt: description || '',
              height,
              id,
              src: `data:image/png;base64,${screenshot.toString('base64')}`,
              title,
              width
            },
            children: []
          }
        } else if (strategy === 'inline-svg') {
          replacement = fromHtmlIsomorphic(svg, { fragment: true }).children[0]
        } else if (strategy === 'img-svg') {
          replacement = {
            type: 'element',
            tagName: 'img',
            properties: {
              alt: description || '',
              height,
              id,
              src: svgToDataURI(svg),
              title,
              width
            },
            children: []
          }
        }
      } else if (options?.errorFallback) {
        replacement = options.errorFallback(node, diagram, result.reason, file)
      } else {
        file.fail(result.reason, node, 'rehype-mermaid:rehype-mermaid')
      }

      const nodeIndex = parent.children.indexOf(node)
      if (replacement) {
        parent.children[nodeIndex] = replacement
      } else {
        parent.children.splice(nodeIndex, 1)
      }
    }
  }
}

export default rehypeMermaid
