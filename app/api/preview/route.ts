import { NextRequest, NextResponse } from 'next/server'

const CDN: Record<string, string> = {
  'react': 'https://esm.sh/react@19',
  'react-dom/client': 'https://esm.sh/react-dom@19/client',
  'react/jsx-runtime': 'https://esm.sh/react@19/jsx-runtime',
  'react/jsx-dev-runtime': 'https://esm.sh/react@19/jsx-runtime',
  'lucide-react': 'https://esm.sh/lucide-react@0.542.0',
  'recharts': 'https://esm.sh/recharts@3.8.1',
}

// Pre-built dashboard templates for instant rendering (compiled once, cached)
const TEMPLATES: Record<string, { name: string; code: string }> = {}

const CAR_DASHBOARD_CODE = `import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Car, TrendingUp, Wrench, MapPin } from 'lucide-react';

const CarPerformance = () => {
  const data = [
    { name: 'Jan', mpg: 28, speed: 65, range: 400 },
    { name: 'Feb', mpg: 30, speed: 68, range: 420 },
    { name: 'Mar', mpg: 32, speed: 70, range: 440 },
    { name: 'Apr', mpg: 35, speed: 72, range: 460 },
    { name: 'May', mpg: 33, speed: 71, range: 450 },
    { name: 'Jun', mpg: 36, speed: 74, range: 480 },
  ];
  return React.createElement('div', { className: 'w-full h-full bg-gradient-to-br from-gray-900 to-gray-800 p-6' },
    React.createElement('div', { className: 'flex items-center gap-3 mb-6' },
      React.createElement(Car, { className: 'text-blue-400', size: 24 }),
      React.createElement('h2', { className: 'text-xl font-bold text-white' }, 'Car Performance Dashboard'),
    ),
    React.createElement('div', { className: 'grid grid-cols-4 gap-4 mb-6' },
      ...[
        { label: 'Fuel Efficiency', value: '32.4 MPG', icon: 'TrendingUp', color: 'text-blue-400' },
        { label: 'Engine Health', value: 'Excellent', icon: 'Wrench', color: 'text-green-400' },
        { label: 'Range', value: '420 mi', icon: 'MapPin', color: 'text-amber-400' },
        { label: 'Avg Speed', value: '70 mph', icon: 'Car', color: 'text-purple-400' },
      ].map(kpi => React.createElement('div', { className: 'bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-gray-700' },
        React.createElement('div', { className: 'flex items-center gap-2 mb-2' },
          React.createElement(TrendingUp, { className: kpi.color, size: 16 }),
          React.createElement('span', { className: 'text-sm font-semibold text-gray-300' }, kpi.label),
        ),
        React.createElement('div', { className: 'text-2xl font-bold text-white' }, kpi.value),
      )),
    ),
    React.createElement('div', { className: 'h-64 w-full' },
      React.createElement(ResponsiveContainer, { width: '100%', height: '100%' },
        React.createElement(BarChart, { data },
          React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: '#444' }),
          React.createElement(XAxis, { dataKey: 'name', stroke: '#94a3b8' }),
          React.createElement(YAxis, { stroke: '#94a3b8' }),
          React.createElement(Tooltip, { contentStyle: { backgroundColor: 'rgba(30, 41, 59, 0.8)', borderColor: '#334155', borderRadius: '8px' }, itemStyle: { color: '#f1f5f9' }, labelStyle: { color: '#e2e8f0' } }),
          React.createElement(Legend, null),
          React.createElement(Bar, { dataKey: 'mpg', fill: '#3b82f6', name: 'MPG', radius: [4, 4, 0, 0] }),
          React.createElement(Bar, { dataKey: 'speed', fill: '#10b981', name: 'Speed (mph)', radius: [4, 4, 0, 0] }),
          React.createElement(Bar, { dataKey: 'range', fill: '#8b5cf6', name: 'Range (miles)', radius: [4, 4, 0, 0] }),
        ),
      ),
    ),
  );
};
export default CarPerformance;`

const KPI_GRID_CODE = `import React from 'react';
import { TrendingUp, Users, ShoppingCart, DollarSign } from 'lucide-react';

const KPIGrid = () => {
  const ICONS: Record<string, any> = { TrendingUp, Users, ShoppingCart, DollarSign }
  const kpis = [
    { label: 'Total Revenue', value: '$45,231', change: '+20.1%', icon: 'DollarSign', color: 'bg-blue-500' },
    { label: 'Subscriptions', value: '1,234', change: '+19%', icon: 'Users', color: 'bg-green-500' },
    { label: 'Sales', value: '23,234', change: '+5.4%', icon: 'ShoppingCart', color: 'bg-purple-500' },
    { label: 'Active Users', value: '12,345', change: '+12.5%', icon: 'TrendingUp', color: 'bg-yellow-500' },
  ];
  return React.createElement('div', { className: 'min-h-screen bg-gray-100 dark:bg-gray-900 p-8' },
    React.createElement('h1', { className: 'text-3xl font-bold text-gray-900 dark:text-white mb-8' }, 'Dashboard Overview'),
    React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6' },
      ...kpis.map(kpi => React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow', key: kpi.label },
        React.createElement('div', { className: 'flex items-center gap-4' },
          React.createElement('div', { className: kpi.color + ' p-3 rounded-lg' },
            React.createElement(ICONS[kpi.icon], { className: 'h-6 w-6 text-white' }),
          ),
          React.createElement('div', null,
            React.createElement('p', { className: 'text-sm text-gray-500 dark:text-gray-400' }, kpi.label),
            React.createElement('p', { className: 'text-2xl font-bold text-gray-900 dark:text-white mt-1' }, kpi.value),
            React.createElement('p', { className: 'text-sm text-green-500 mt-2' }, kpi.change),
          ),
        ),
      )),
    ),
  );
};
export default KPIGrid;`

TEMPLATES['car-dashboard'] = { name: 'Car Performance Dashboard', code: CAR_DASHBOARD_CODE }
TEMPLATES['kpi-grid'] = { name: 'KPI Metrics Grid', code: KPI_GRID_CODE }

// Template compilation cache
const templateCache = new Map<string, string>()
const compilingTemplates = new Set<string>()
/**
 * Compile and cache a template's esbuild output (first call compiles, rest instant).
 */
async function getTemplateTransformed(name: string, esbuild: any): Promise<string> {
  const cached = templateCache.get(name)
  if (cached) return cached
  const template = TEMPLATES[name]
  if (!template) return ''
  if (compilingTemplates.has(name)) {
    while (compilingTemplates.has(name)) await new Promise(r => setTimeout(r, 50))
    return templateCache.get(name) || ''
  }
  compilingTemplates.add(name)
  try {
    const result = await esbuild.transform(template.code, { loader: 'tsx', jsx: 'automatic' })
    templateCache.set(name, result.code)
    return result.code
  } finally {
    compilingTemplates.delete(name)
  }
}
/**
 * Build preview HTML for a pre-built template (instant after first compilation).
 */
async function buildTemplatePreview(name: string, esbuild: any): Promise<string> {
  const template = TEMPLATES[name]
  if (!template) throw new Error('Template not found: ' + name)
  const transformedCode = await getTemplateTransformed(name, esbuild)
  // Extract component name from export default
  const compMatch = template.code.match(/export\s+default\s+(\w+)/)
  const compName = compMatch ? compMatch[1] : 'App'
  // Strip default React import (boilerplate provides it)
  const finalCode = transformedCode
    .replace(/^import\s+React\s+from\s+['"]react['"]\s*;?\s*\n?/gm, '')
    .replace(/^import\s+React,\s*\{([^}]*)\}\s+from\s+['"]react['"]\s*;?\s*\n?/gm, 'import { $1 } from "react"\n')
    .replace(/^import\s+.*?from\s+['"]react-dom\/client['"]\s*;?\s*\n?/gm, '')
  const importMap: Record<string, string> = {
    'react': CDN['react'],
    'react-dom/client': CDN['react-dom/client'],
    'react/jsx-runtime': CDN['react/jsx-runtime'],
  }
  for (const [spec, url] of Object.entries(CDN)) {
    if (!['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'].includes(spec)) {
      importMap[spec] = url
    }
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <script type="importmap">${JSON.stringify({ imports: importMap }, null, 2)}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>*,*::before,*::after{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;overflow-y:auto}#root{min-height:100vh;overflow-y:auto}</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
${finalCode}
const root = createRoot(document.getElementById('root'));
root.render(React.createElement(${compName}));
</script>
</body>
</html>`
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

        // Skip non-HTML closing tags (React components like </BarChart>,
        // </ResponsiveContainer>). Opening uppercase tags are also skipped
        // (not pushed to stack), so processing them here would misidentify
        // them as "mismatched" and replace them with </div>.
        if (!HTML_TAG_RE.test(tagName)) {
          while (j < code.length && code[j] !== '>') j++
          const closeEnd = j + 1
          result += code.substring(i, closeEnd)
          i = closeEnd
          continue
        }

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
 * Fix extra closing parentheses in JSX callback expressions.
 * AI commonly generates: .map(() => ( ... )))}  (3 parens + 1 brace)
 * But should be:        .map(() => ( ... ))}   (2 parens + 1 brace)
 * The extra `)` causes esbuild: Expected "}" but found ")"
 */
function fixExtraClosingParens(code: string): string {
  // Match )))} on its own line (after whitespace) — the 3-paren-then-brace
  // pattern is almost never valid in TSX. Replace with ))}.
  return code.replace(/^(\s*)\)\)\)\}/gm, '$1))}')
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

/**
 * When the AI exports a component declared inside another function body
 * (e.g. `const Outer = () => { const Inner = () => { ... }; }; export default Inner`),
 * hoist the inner component declaration to module level so it can
 * be used as the render target.
 */
function hoistComponent(code: string, componentName: string): string {
  // Already at module level — no hoisting needed
  const moduleDeclRe = new RegExp('^(?:const|let|var|function)\\s+' + componentName + '\\b', 'm')
  if (moduleDeclRe.test(code)) return code

  // Search for `const ComponentName = ... => {` (arrow function with braces)
  const re = new RegExp('const\\s+' + componentName + '\\s*=\\s*(?:\\([^)]*\\)\\s*=>\\s*\\{)')
  const match = re.exec(code)
  if (!match) return code

  const start = match.index
  let i = match.index + match[0].length - 1  // position at the `{`
  let braceDepth = 1
  i++
  while (i < code.length && braceDepth > 0) {
    const c = code[i]
    if (c === '"' || c === "'") {
      const quote = c; i++
      while (i < code.length && code[i] !== quote) { if (code[i] === '\\') i++; i++ }
      if (i < code.length) i++
      continue
    }
    if (c === '`') {
      i++
      while (i < code.length && code[i] !== '`') { if (code[i] === '\\') i++; i++ }
      if (i < code.length) i++
      continue
    }
    if (c === '{') braceDepth++
    if (c === '}') braceDepth--
    i++
  }

  const declEnd = i
  const declaration = code.substring(start, declEnd)
  code = code.substring(0, start) + code.substring(declEnd)
  code = declaration + '\n' + code
  return code
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const rawCode = body.code as string | undefined
  const templateName = body.template as string | undefined

  // Template mode: serve pre-built cached template (instant after first compile)
  if (templateName && TEMPLATES[templateName]) {
    try {
      const esbuild = require('esb' + 'uild')
      const html = await buildTemplatePreview(templateName, esbuild)
      return NextResponse.json({ html })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
  }

  // Code mode: compile AI-generated code
  if (!rawCode || typeof rawCode !== 'string') {
    return NextResponse.json({ error: 'Code or template is required' }, { status: 400 })
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
    // Hoist nested component to module level if not at module scope
    code = hoistComponent(code, componentName)

    // Check for incomplete/streaming code
    if (isCodeIncomplete(code)) {
      return NextResponse.json({ error: 'Code is still streaming, try again when complete' }, { status: 200 })
    }

    // Fix missing closing brace in imports
    code = fixImportBraces(code)

    // Fix unbalanced HTML closing tags
    code = fixMismatchedClosingTags(code)
    // Fix extra closing parentheses in JSX callbacks
    code = fixExtraClosingParens(code)

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

    // Strip import lines from transformed code that the template already
    // provides (react, react-dom/client) to avoid "redeclaration of import".
    let transformedCode = result.code

    // Strip react default import (template provides `import React from 'react'`)
    // but preserve any named hook imports like useState, useEffect the AI code uses
    transformedCode = transformedCode.replace(
      /^import\s+React\s+from\s+['"]react['"]\s*;?\s*\n?/gm, ''
    )
    transformedCode = transformedCode.replace(
      /^import\s+React,\s*\{([^}]*)\}\s+from\s+['"]react['"]\s*;?\s*\n?/gm,
      'import { $1 } from "react"\n'
    )
    // Strip react-dom/client import (template provides createRoot)
    transformedCode = transformedCode.replace(
      /^import\s+.*?from\s+['"]react-dom\/client['"]\s*;?\s*\n?/gm, ''
    )

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <script type="importmap">${JSON.stringify({ imports: importMap }, null, 2)}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>*, *::before, *::after { box-sizing: border-box; } body { margin: 0; font-family: system-ui, -apple-system, sans-serif; overflow-y: auto; } #root { min-height: 100vh; overflow-y: auto; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
import React from 'react';
import { createRoot } from 'react-dom/client';
${transformedCode}
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

export async function GET() {
  const list = Object.entries(TEMPLATES).map(([id, t]) => ({
    id,
    name: t.name,
  }))
  return NextResponse.json({ templates: list })
}