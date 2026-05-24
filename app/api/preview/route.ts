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
  const openStack: string[] = []
  let result = ''
  let i = 0
  const voidTags = new Set(['area','br','col','hr','img','input','link','meta','path','line','rect','circle','ellipse','polyline','polygon','stop'])

  while (i < code.length) {
    // Skip strings
    if (code[i] === '"' || code[i] === "'") {
      const q = code[i++]; result += q
      while (i < code.length && code[i] !== q) {
        if (code[i] === '\\' && i + 1 < code.length) { result += code[i] + code[i + 1]; i += 2 }
        else { result += code[i]; i++ }
      }
      if (i < code.length) { result += code[i]; i++ }
      continue
    }
    // Skip template literals
    if (code[i] === '`') {
      result += code[i++]
      while (i < code.length && code[i] !== '`') {
        if (code[i] === '\\' && i + 1 < code.length) { result += code[i] + code[i + 1]; i += 2 }
        else { result += code[i]; i++ }
      }
      if (i < code.length) { result += code[i]; i++ }
      continue
    }
    // Skip JSX expressions
    if (code[i] === '{') {
      let depth = 1; result += code[i++]
      while (i < code.length && depth > 0) {
        if (code[i] === '{') depth++; else if (code[i] === '}') depth--
        if (depth > 0) { result += code[i]; i++ } else { i++; break }
      }
      continue
    }
    // Skip HTML comments
    if (code[i] === '<' && i + 1 < code.length && code[i + 1] === '!') {
      const end = code.indexOf('-->', i + 1)
      const seg = end >= 0 ? code.substring(i, end + 3) : code.substring(i)
      result += seg; i = end >= 0 ? end + 3 : code.length
      continue
    }

    // JSX tag
    if (code[i] === '<' && i + 1 < code.length && /[A-Za-z]/.test(code[i + 1])) {
      // Get tag name for opening tag detection (needed later)
      let j = i + 1
      while (j < code.length && /[\w$]/.test(code[j])) j++

      // Closing tag: extract from position i+2 (after '</')
      if (code[i + 1] === '/') {
        let k = i + 2
        while (k < code.length && /[\w$]/.test(code[k])) k++
        const closeName = code.substring(i + 2, k)
        // Find '>'
        while (k < code.length && code[k] !== '>') k++
        const closeEnd = k + 1

        if (openStack.length > 0 && openStack[openStack.length - 1] === closeName) {
          // Correct close tag
          for (let c = i; c < closeEnd; c++) result += code[c]
          openStack.pop()
        } else if (openStack.length > 0) {
          // Mismatched - fix to expected tag
          const expected = openStack[openStack.length - 1]!
          result += '</' + expected + '>'
          openStack.pop()
          i = closeEnd
        } else {
          // No match - skip
          i = closeEnd
        }
        continue
      }

      // Opening tag
      const tagName = code.substring(i + 1, j)

      // Find end of tag
      let depth = 0; let k = j; let selfClose = false
      while (k < code.length) {
        if (code[k] === '{') { depth++; k++ }
        else if (code[k] === '}') { depth--; k++ }
        else if (depth === 0 && code[k] === '/' && code[k + 1] === '>') { selfClose = true; k += 2; break }
        else if (depth === 0 && code[k] === '>') { k++; break }
        else k++
      }

      for (let c = i; c < k; c++) result += code[c]

      // Only push non-void, non-self-closing tags
      if (!selfClose && !voidTags.has(tagName.toLowerCase())) {
        openStack.push(tagName)
      }

      i = k
      continue
    }

    result += code[i++]
  }

  // Close any remaining open tags
  while (openStack.length > 0) {
    result += '</' + openStack.pop() + '>'
  }

  return result
}

export async function POST(request: NextRequest) {
  const { code: rawCode } = await request.json()
  if (!rawCode || typeof rawCode !== 'string') {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const esbuild = require('esb' + 'uild')

    let code = rawCode

    // Remove "use client"
    code = code.replace(/^["']use client["'];?$/gm, '')

    // Capture and replace export default
    let componentName = 'App'
    code = code.replace(/export default function (\w+)/, (_, name) => {
      componentName = name
      return `function ${name}`
    })
    code = code.replace(/export default (\w+)/g, (_, name) => {
      componentName = name
      return ''
    })

    // Strip remaining export keywords
    code = code.replace(/^export (const|let|var|class|function|interface|type) /gm, '$1 ')
    code = code.replace(/^export \{/gm, '')

    // Fix mismatched closing tags before esbuild sees them
    code = fixMismatchedClosingTags(code)

    // Collect import specifiers for importmap
    const importSpecs = new Set<string>()
    const importRe = /from\s+['"]([^'"]+)['"]/g
    let match
    while ((match = importRe.exec(code)) !== null) {
      const spec = match[1]
      if (!spec.startsWith('.')) importSpecs.add(spec)
    }

    // Build importmap
    const importMap: Record<string, string> = {
      'react': CDN['react'],
      'react-dom/client': CDN['react-dom/client'],
      'react/jsx-runtime': CDN['react/jsx-runtime'],
      'react/jsx-dev-runtime': CDN['react/jsx-dev-runtime'],
    }
    for (const spec of importSpecs) {
      const pkg = spec.split('/')[0]
      importMap[spec] = CDN[spec] || CDN[pkg] || `https://esm.sh/${pkg}@latest`
    }

    const result = await esbuild.transform(code, { loader: 'tsx', jsx: 'automatic' })
    const importMapJson = JSON.stringify(importMap, null, 2)

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="importmap">${importMapJson}</script>
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