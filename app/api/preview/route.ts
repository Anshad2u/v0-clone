import { NextRequest, NextResponse } from 'next/server'

const CDN: Record<string, string> = {
  'react': 'https://esm.sh/react@19',
  'react-dom/client': 'https://esm.sh/react-dom@19/client',
  'react/jsx-runtime': 'https://esm.sh/react@19/jsx-runtime',
  'react/jsx-dev-runtime': 'https://esm.sh/react@19/jsx-runtime',
  'lucide-react': 'https://esm.sh/lucide-react@0.542.0',
  'recharts': 'https://esm.sh/recharts@3.8.1',
}

// Only track HTML elements (lowercase) — AI commonly mismatches these.
// TypeScript generics like <Props>, Record<K,V> are uppercase-starting and
// are SKIPPED to avoid mangling valid type syntax.
const HTML_TAG_RE = /^[a-z][\w]*$/
const VOID_ELEMENTS = new Set([
  'br', 'hr', 'img', 'input', 'link', 'meta', 'base',
  'col', 'embed', 'param', 'source', 'track', 'wbr',
])

/**
 * Lightly fix unbalanced HTML closing tags that AI commonly generates.
 * Skips tags that look like TypeScript generics (uppercase single name
 * with no attributes) to avoid mangling e.g. <Props>, Array<X>.
 */
function fixMismatchedClosingTags(code: string): string {
  const stack: string[] = []
  let result = ''
  let i = 0

  while (i < code.length) {
    const ch = code[i]

    // Skip string literals character by character
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      result += quote
      i++
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\' && i + 1 < code.length) {
          result += code[i] + code[i + 1]
          i += 2
        } else {
          result += code[i]
          i++
        }
      }
      if (i < code.length) result += code[i++]
      continue
    }

    if (ch === '<' && i + 1 < code.length) {
      const next = code[i + 1]

      // Closing tag: </tagname>
      if (next === '/') {
        let j = i + 2
        while (j < code.length && /[\w$]/.test(code[j])) j++
        const tagName = code.substring(i + 2, j)
        while (j < code.length && code[j] !== '>') j++
        const closeEnd = j + 1

        if (stack.length > 0 && stack[stack.length - 1] === tagName) {
          // Matching close — normal
          result += code.substring(i, closeEnd)
          stack.pop()
        } else if (stack.length > 0) {
          // Mismatched close — replace with expected tag
          result += '</' + stack.pop() + '>'
        }
        // else: extra closing tag, skip it
        i = closeEnd
        continue
      }

      // Opening tag or generic: <Name ...>
      if (/[A-Za-z]/.test(next)) {
        let j = i + 1
        while (j < code.length && /[\w$]/.test(code[j])) j++
        const tagName = code.substring(i + 1, j)

        // Only track HTML elements (all-lowercase). Skip uppercase- or
        // mixed-case names — those are React components or TS generics.
        if (!HTML_TAG_RE.test(tagName)) {
          result += ch
          i++
          continue
        }

        // Scan to end of tag (> or />), tracking brace depth for JSX
        // expressions like <div className={x ? 'a' : 'b'}>
        let depth = 0
        let k = j
        let isSelfClosing = false

        while (k < code.length) {
          const c = code[k]
          if (c === '{') { depth++; k++ }
          else if (c === '}') { depth--; k++ }
          else if (depth === 0 && c === '/' && k + 1 < code.length && code[k + 1] === '>') {
            isSelfClosing = true
            k += 2
            break
          }
          else if (depth === 0 && c === '>') {
            k++
            break
          }
          else k++
        }

        result += code.substring(i, k)

        if (!isSelfClosing && !VOID_ELEMENTS.has(tagName)) {
          stack.push(tagName)
        }

        i = k
        continue
      }
    }

    result += ch
    i++
  }

  // Close any unclosed tags at the end
  while (stack.length > 0) {
    result += '</' + stack.pop() + '>'
  }

  return result
}

/**
 * Fix missing closing brace before `from` in import statements.
 * AI often generates: import { X, Y\nfrom '...' instead of import { X, Y } from '...'
 */
function fixImportBraces(code: string): string {
  return code
    .replace(/import\s+(\{[^}]*?)(\s*\n\s*)(from\s+['"`])/g, 'import $1 }$2$3')
    .replace(/import\s+(\{[^}]*?)(\n)(from\s+)/g, 'import $1 }$2$3')
    .replace(/import\s+(\{[^}]*?)(\s+)(from\s+['"`])/g, 'import $1 }$2$3')
}

/**
 * Detect if the code looks incomplete (streaming truncated).
 */
function isCodeIncomplete(code: string): boolean {
  const trimmed = code.trim()
  if (!trimmed) return true

  const lines = trimmed.split('\n')
  const lastLine = lines[lines.length - 1].trim()

  // Incomplete import on last line
  if (/import\s*\{[^}]*$/.test(lastLine) && !lastLine.includes(' from ')) return true
  if (/import\s+(?:type\s+)?[a-zA-Z_$][\w$]*(?:\s*\{[^}]*$|$)/.test(lastLine)) return true

  // Unclosed brackets (handling strings and template literals properly)
  let depth = 0
  for (let i = 0; i < code.length; i++) {
    const c = code[i]

    // Skip string contents so braces inside don't count
    if (c === '"' || c === "'") {
      i++
      while (i < code.length && code[i] !== c) {
        if (code[i] === '\\') i++
        i++
      }
      if (i >= code.length) return true // unclosed string = incomplete
      continue
    }

    // Template literals — track inner brace depth separately
    if (c === '`') {
      i++
      while (i < code.length && code[i] !== '`') {
        if (code[i] === '\\') { i++; continue }
        if (code[i] === '$' && i + 1 < code.length && code[i + 1] === '{') {
          // Enter template expression — track inner braces
          let templDepth = 1
          i += 2
          while (i < code.length && templDepth > 0) {
            const tc = code[i]
            if (tc === '{') templDepth++
            else if (tc === '}') templDepth--
            else if (tc === '`') break // raw backtick inside expression, handled as part of content
            i++
          }
          if (templDepth > 0) return true // unclosed template expression
          // i now points at `}` or beyond; loop increment handles positioning
          continue
        }
        i++
      }
      if (i >= code.length) return true // unclosed template literal
      continue
    }

    if (c === '{' || c === '(' || c === '[') depth++
    if (c === '}' || c === ')' || c === ']') depth--
  }

  if (depth > 0) return true
  if (trimmed.endsWith(' from') || /export\s+(default\s+)?[a-zA-Z_$][\w$]*\s*$/.test(lastLine)) return true
  return false
}

/**
 * Extract the component name and strip `export default` from the code.
 * Handles three patterns:
 *   1. export default function Name() { ... }
 *   2. export default Name;   (re-export after declaration)
 *   3. const Name = ...; export default Name;
 *
 * Also detects and renames when the module already has a declaration
 * conflicting with the default-exported component name.
 */
function stripExports(code: string): { code: string; componentName: string } {
  let componentName = 'App'

  // Strip "use client"
  code = code.replace(/"use client"\s*;\s*/g, '')

  // --- Pattern 1: export default function Name ---
  const defaultFnMatch = code.match(/export\s+default\s+function\s+(\w+)/)
  if (defaultFnMatch) {
    componentName = defaultFnMatch[1]
    // Replace "export default function Name" with "function Name"
    code = code.replace(/export\s+default\s+function\s+\w+/, 'function ' + componentName)
  } else {
    // --- Pattern 2/3: standalone export default Name; or const Name = ...; export default Name; ---
    // Remove all `export default <Identifier>` lines entirely
    const exprMatch = code.match(/export\s+default\s+([A-Za-z_$][\w$]*)/)
    if (exprMatch) {
      componentName = exprMatch[1]
      // Remove every "export default Name" occurrence (including trailing semicolon/newline)
      code = code.replace(/export\s+default\s+\w+\s*;?\s*/g, '')
    }
  }

  // Strip remaining export keywords from declarations
  code = code.replace(/^export\s+(const|let|var|class|function|interface|type)\s/mg, '$1 ')
  code = code.replace(/^export\s*\{/mg, '')
  // If the component name is already declared as const/let/var AND we also
  // created a function declaration (from stripping export default function),
  // rename the function to avoid "Symbol has already been declared".
  if (componentName !== 'App') {
    const otherDeclRe = new RegExp('^(?:const|let|var|class)\\s+' + componentName + '\\b', 'm')
    const fnDeclRe = new RegExp('^function\\s+' + componentName + '\\b', 'm')
    if (otherDeclRe.test(code) && fnDeclRe.test(code)) {
      const newName = componentName + '_'
      code = code.replace(fnDeclRe, 'function ' + newName)
      componentName = newName
    }
  }

  return { code, componentName }
}

export async function POST(request: NextRequest) {
  const { code: rawCode } = await request.json()
  if (!rawCode || typeof rawCode !== 'string') {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  try {
    // Hide esbuild from Turbopack static analysis
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const esbuild = require('esb' + 'uild')

    let code = rawCode
    let componentName = 'App'

    // Strip exports and extract component name
    const stripped = stripExports(code)
    code = stripped.code
    componentName = stripped.componentName

    // Check for incomplete/streaming code
    if (isCodeIncomplete(code)) {
      return NextResponse.json({ error: 'Code is still streaming, try again when complete' }, { status: 200 })
    }

    // Fix missing closing brace in imports
    code = fixImportBraces(code)

    // Fix unbalanced HTML closing tags
    code = fixMismatchedClosingTags(code)

    // Build import map using only known CDN-backed packages.
    // Skip local imports (./, ../) and scoped project imports (@/) since
    // esm.sh can't serve them.
    const KNOWN_PACKAGES = new Set([
      'react', 'react-dom', 'react-dom/client', 'react-dom/server',
      'react/jsx-runtime', 'react/jsx-dev-runtime',
      'lucide-react', 'recharts',
    ])
    const imports = new Set<string>()
    const importRegex = /from\s+['"]([^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(code)) !== null) {
      const spec = match[1]
      // Skip relative imports and scoped project paths
      if (spec.startsWith('.') || spec.startsWith('@/')) continue
      imports.add(spec)
    }

    // Always include the runtime essentials
    const importMap: Record<string, string> = {
      'react': CDN['react'],
      'react-dom/client': CDN['react-dom/client'],
      'react/jsx-runtime': CDN['react/jsx-runtime'],
    }
    for (const spec of imports) {
      if (KNOWN_PACKAGES.has(spec)) {
        const cdnUrl = CDN[spec]
        if (cdnUrl) importMap[spec] = cdnUrl
      }
    }

    const result = await esbuild.transform(code, { loader: 'tsx', jsx: 'automatic' })

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <script type="importmap">${JSON.stringify({ imports: importMap }, null, 2)}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>*, *::before, *::after { box-sizing: border-box; } body { margin: 0; font-family: system-ui, -apple-system, sans-serif; } #root { min-height: 100vh; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
${result.code}
const root = createRoot(document.getElementById('root'));
root.render(React.createElement(${componentName}));
</script>
</body>
</html>`

    return NextResponse.json({ html })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown compilation error'
    console.error('Preview compilation error:', message, error)
    return NextResponse.json({ error: message }, { status: 422 })
  }
}