import { NextRequest, NextResponse } from 'next/server'

const CDN: Record<string, string> = {
  'react': 'https://esm.sh/react@19',
  'react-dom/client': 'https://esm.sh/react-dom@19/client',
  'react/jsx-runtime': 'https://esm.sh/react@19/jsx-runtime',
  'react/jsx-dev-runtime': 'https://esm.sh/react@19/jsx-runtime',
  'lucide-react': 'https://esm.sh/lucide-react@0.542.0',
  'recharts': 'https://esm.sh/recharts@3.8.1',
}

function fixMismatchedClosingTags(code: string): string {
  const stack: string[] = []
  let result = ''
  let i = 0

  while (i < code.length) {
    const ch = code[i]

    // Skip string literals
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

    // Skip JSX expressions { ... }
    if (ch === '{') {
      let depth = 1
      result += ch
      i++
      while (i < code.length && depth > 0) {
        if (code[i] === '{') depth++
        else if (code[i] === '}') depth--
        if (depth > 0) result += code[i++]
        else i++
      }
      continue
    }

    // Handle JSX tags
    if (ch === '<') {
      if (i + 1 < code.length) {
        const next = code[i + 1]

        // Closing tag </...>
        if (next === '/') {
          let j = i + 2
          while (j < code.length && /[\w$]/.test(code[j])) j++
          const tagName = code.substring(i + 2, j)
          while (j < code.length && code[j] !== '>') j++
          const closeEnd = j + 1

          if (stack.length > 0 && stack[stack.length - 1] === tagName) {
            // Correct match - emit and pop
            result += code.substring(i, closeEnd)
            stack.pop()
          } else if (stack.length > 0) {
            // Mismatched - emit correct closing tag for what's actually open
            const expected = stack.pop()!
            result += '</' + expected + '>'
          }
          // else: no open tag to close, skip the extra closing tag
          i = closeEnd
          continue
        }

        // Opening tag
        if (/[A-Za-z]/.test(next)) {
          let j = i + 1
          while (j < code.length && /[\w$]/.test(code[j])) j++
          const tagName = code.substring(i + 1, j)

          let depth = 0
          let k = j
          let selfClosing = false
          while (k < code.length) {
            if (code[k] === '{') { depth++; k++ }
            else if (code[k] === '}') { depth--; k++ }
            else if (depth === 0 && code[k] === '/' && code[k + 1] === '>') {
              selfClosing = true
              k += 2
              break
            }
            else if (depth === 0 && code[k] === '>') {
              k++
              break
            }
            else k++
          }

          result += code.substring(i, k)

          // NOT void elements in React - push them to stack
          const voidElements = ['br', 'hr', 'img', 'input', 'link', 'meta', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr']
          if (!selfClosing && !voidElements.includes(tagName.toLowerCase())) {
            stack.push(tagName)
          }
          i = k
          continue
        }
      }
    }

    result += ch
    i++
  }

  // Auto-close any remaining open tags
  while (stack.length > 0) {
    result += '</' + stack.pop() + '>'
  }

  return result
}

export async function POST(request: NextRequest) {
  const { code: rawCode } = await request.json()
  if (!rawCode || typeof rawCode !== 'string') {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  try {
    const esbuild = require('esb' + 'uild')

    let code = rawCode.replace(/"use client"\s*;\s*/g, '')
    let componentName = 'App'
    
    const exportDefaultFn = code.match(/export\s+default\s+function\s+(\w+)/)
    if (exportDefaultFn) {
      componentName = exportDefaultFn[1]
      code = code.replace(/export\s+default\s+function\s+\w+/, 'function ' + componentName)
    } else {
      const exportDefaultExpr = code.match(/export\s+default\s+(\w+)/)
      if (exportDefaultExpr) {
        componentName = exportDefaultExpr[1]
        code = code.replace(/export\s+default\s+\w+/, '')
      }
    }

    code = code.replace(/^export\s+(const|let|var|class|function|interface|type)\s/mg, '$1 ')
    code = code.replace(/^export\s*\{/mg, '')

    code = fixMismatchedClosingTags(code)

    const imports = new Set<string>()
    const importRegex = /from\s+['"]([^'"]+)['"]/g
    let match
    while ((match = importRegex.exec(code)) !== null) {
      const spec = match[1]
      if (!spec.startsWith('.')) imports.add(spec)
    }

    const importMap: Record<string, string> = {
      'react': CDN['react'],
      'react-dom/client': CDN['react-dom/client'],
      'react/jsx-runtime': CDN['react/jsx-runtime'],
    }
    for (const spec of imports) {
      const pkg = spec.split('/')[0]
      importMap[spec] = CDN[spec] || CDN[pkg] || `https://esm.sh/${pkg}@latest`
    }

    const result = await esbuild.transform(code, { loader: 'tsx', jsx: 'automatic' })

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="importmap">${JSON.stringify(importMap, null, 2)}</script>
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
    console.error('Preview compilation error:', message)
    return NextResponse.json({ error: message }, { status: 422 })
  }
}