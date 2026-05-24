import { NextRequest, NextResponse } from 'next/server'

// CDN mappings for browser importmap
// esm.sh serves npm packages as ES modules — respects iframe sandbox
const CDN: Record<string, string> = {
  'react': 'https://esm.sh/react@19',
  'react-dom': 'https://esm.sh/react-dom@19',
  'react-dom/client': 'https://esm.sh/react-dom@19/client',
  'react/jsx-runtime': 'https://esm.sh/react@19/jsx-runtime',
  'react/jsx-dev-runtime': 'https://esm.sh/react@19/jsx-runtime',
  'lucide-react': 'https://esm.sh/lucide-react@0.542.0',
  'recharts': 'https://esm.sh/recharts@3.8.1',
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

    // Collect import specifiers for importmap
    const importSpecs = new Set<string>()
    const importRe = /from\s+['"]([^'"]+)['"]/g
    let m
    while ((m = importRe.exec(code)) !== null) {
      const spec = m[1]
      if (!spec.startsWith('.')) importSpecs.add(spec)
    }

    // Build importmap — always include react deps needed by jsx transform + bootstrap
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

    // Transpile TSX → JS (no bundling — browser resolves imports via importmap)
    const result = await esbuild.transform(code, {
      loader: 'tsx',
      jsx: 'automatic',
    })

    const importMapJson = JSON.stringify(importMap, null, 2)
    const compiled = result.code

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="importmap">${importMapJson}</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
${compiled}

import React from 'react';
import { createRoot } from 'react-dom/client';
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
