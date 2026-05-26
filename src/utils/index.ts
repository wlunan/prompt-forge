import type { Variable } from '../types'

/** 从文本中提取 {{name}} 或 ${name} 变量 */
export function extractVariables(text: string): Variable[] {
  const regex = /(?:\{\{|\$\{)([a-zA-Z0-9_-]+)(?:=([^}]+))?(?:\}\}|\})/g
  const vars: Variable[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const name = match[1]
    const defaultVal = match[2] || ''
    if (!seen.has(name)) {
      seen.add(name)
      vars.push({ name, required: !defaultVal, defaultValue: defaultVal || undefined })
    }
  }
  return vars
}

/** 替换文本中的变量为实际值 */
export function renderVariables(text: string, values: Record<string, string>): string {
  return text.replace(/(?:\{\{|\$\{)([a-zA-Z0-9_-]+)(?:=[^}]+)?(?:\}\}|\})/g, (_, name) => {
    return values[name] ?? `{{${name}}}`
  })
}

/** FNV-1a 哈希 */
export function fnvHash(str: string): string {
  const data = new TextEncoder().encode(str)
  let hash = BigInt('0xcbf29ce484222325')
  const prime = BigInt('0x100000001b3')
  const mask = BigInt('0xffffffffffffffff')
  for (const byte of data) {
    hash ^= BigInt(byte)
    hash = (hash * prime) & mask
  }
  return hash.toString(16).padStart(16, '0').slice(0, 16)
}

/** 二元组相似度（bigram） */
function bigramSimilarity(a: string, b: string): number {
  const getBigrams = (s: string) => {
    const lower = s.toLowerCase().replace(/\s+/g, '')
    const set = new Set<string>()
    for (let i = 0; i < lower.length - 1; i++) set.add(lower.slice(i, i + 2))
    return set
  }
  const aSet = getBigrams(a)
  const bSet = getBigrams(b)
  if (aSet.size === 0 || bSet.size === 0) return 0
  let intersection = 0
  for (const bg of bSet) if (aSet.has(bg)) intersection++
  return intersection / (aSet.size + bSet.size - intersection)
}

/** 生成 UUID */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** 自动从正文推断标题 */
export function inferTitle(body: string): string {
  if (!body) return '未命名提示词'
  const lines = body.split('\n')
  let firstLine = ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) { firstLine = trimmed; break }
  }
  if (!firstLine) return '未命名提示词'
  let title = firstLine.replace(/^#+\s*/, '').trim()
  title = title.replace(/\s+/g, ' ')
  if (/[\u4e00-\u9fa5]/.test(title)) {
    return title.length > 7 ? title.slice(0, 7) + '…' : title
  }
  return title.length > 15 ? title.slice(0, 15) + '…' : title
}

/** 自动推断分类 */
export function inferCategory(body: string): string {
  const lower = body.toLowerCase()
  if (lower.includes('评审') || lower.includes('review')) return '评审'
  if (lower.includes('代码') || lower.includes('code') || lower.includes('bug')) return '编码'
  if (lower.includes('翻译') || lower.includes('translate')) return '翻译'
  if (lower.includes('周报') || lower.includes('写作') || lower.includes('write')) return '写作'
  if (lower.includes('问') || lower.includes('ask') || lower.includes('解释')) return '问答'
  return '其它'
}

/** 检测重复 */
export async function detectDuplicate(
  existing: Array<{ body: string; id: string; [k: string]: any }>,
  newBody: string,
  newId: string
): Promise<{ phase: 'normal' | 'exact' | 'similar'; exactId?: string; similarItems: Array<{ id: string; score: number }> }> {
  const start = Date.now()
  const newHash = fnvHash(newBody)
  const exact = existing.find(e => e.id !== newId && (e as any).hash === newHash)
  if (exact) return { phase: 'exact', exactId: exact.id, similarItems: [] }

  const similar: Array<{ id: string; score: number }> = []
  for (const item of existing) {
    if (item.id === newId) continue
    if (Date.now() - start > 500) break
    const score = bigramSimilarity(newBody, item.body)
    if (score >= 0.8) similar.push({ id: item.id, score })
  }
  similar.sort((a, b) => b.score - a.score)
  return { phase: similar.length ? 'similar' : 'normal', similarItems: similar.slice(0, 3) }
}
