import type { PromptUnit, PromptDoc } from '../types'

const DB_PREFIX = 'promptforge:'
const ALL_KEY = DB_PREFIX + 'prompts'

function getDb() {
  return (window as any).ztools?.db
}

function getDbStorage() {
  return (window as any).ztools?.dbStorage
}

/** 将 PromptUnit 转为 DB doc 格式 */
function toDoc(unit: PromptUnit): PromptDoc {
  return { _id: unit.id, data: JSON.parse(JSON.stringify(unit)) }
}

/** 将 DB doc 转为 PromptUnit */
function fromDoc(doc: PromptDoc): PromptUnit {
  return doc.data
}

/** 加载所有提示词 */
export async function loadAll(): Promise<PromptUnit[]> {
  const db = getDb()
  if (db) {
    const docs = db.allDocs ? db.allDocs(DB_PREFIX) : []
    const units: PromptUnit[] = []
    for (const doc of docs) {
      if (doc.data) units.push(doc.data)
    }
    return units.length > 0 ? units : seedDefaults()
  }
  // fallback: dbStorage
  const ds = getDbStorage()
  if (ds) {
    const raw = ds.getItem(ALL_KEY)
    if (Array.isArray(raw) && raw.length > 0) return raw
    const defaults = seedDefaults()
    ds.setItem(ALL_KEY, defaults)
    return defaults
  }
  return seedDefaults()
}

/** 保存所有提示词 */
export async function saveAll(units: PromptUnit[]): Promise<void> {
  const db = getDb()
  if (db) {
    for (const unit of units) {
      const existing = db.get(unit.id)
      if (existing) {
        db.put({ ...existing, data: JSON.parse(JSON.stringify(unit)) })
      } else {
        db.put(toDoc(unit))
      }
    }
    return
  }
  const ds = getDbStorage()
  if (ds) ds.setItem(ALL_KEY, units)
}

/** 保存单个提示词 */
export async function saveOne(unit: PromptUnit): Promise<void> {
  const db = getDb()
  if (db) {
    const existing = db.get(unit.id)
    if (existing) {
      db.put({ ...existing, data: JSON.parse(JSON.stringify(unit)) })
    } else {
      db.put(toDoc(unit))
    }
    return
  }
  const ds = getDbStorage()
  if (ds) {
    const all = ds.getItem(ALL_KEY) || []
    const idx = all.findIndex((u: PromptUnit) => u.id === unit.id)
    if (idx !== -1) all[idx] = unit
    else all.push(unit)
    ds.setItem(ALL_KEY, all)
  }
}

/** 删除提示词 */
export async function removeOne(id: string): Promise<void> {
  const db = getDb()
  if (db) {
    const existing = db.get(id)
    if (existing) db.remove(existing)
    return
  }
  const ds = getDbStorage()
  if (ds) {
    const all = ds.getItem(ALL_KEY) || []
    ds.setItem(ALL_KEY, all.filter((u: PromptUnit) => u.id !== id))
  }
}

/** 应用设置读写 */
export async function getSettings(): Promise<Record<string, any> | null> {
  const ds = getDbStorage()
  if (ds) return ds.getItem('promptforge:settings')
  return null
}

export async function setSettings(settings: Record<string, any>): Promise<void> {
  const ds = getDbStorage()
  if (ds) ds.setItem('promptforge:settings', settings)
}

/** 默认种子数据 */
function seedDefaults(): PromptUnit[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'welcome',
      title: '👋 欢迎使用 PromptForge',
      type: 'prompt',
      status: 'active',
      category: '教程',
      tags: ['教程', '入门'],
      favorited: true,
      body: `欢迎使用 PromptForge！

这是一款提示词管理工具，主流程：

1. 在搜索栏输入关键词查找提示词
2. 用 ↑↓ 选择条目，Enter 确认
3. 没有变量的提示词会直接复制
4. 含变量的提示词进入填参界面

支持功能：快速保存、向导新建、组合拼接、版本管理。`,
      variables: [],
      version: 1,
      usageCount: 0,
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'tutorial-vars',
      title: '🧩 教程：使用变量',
      type: 'prompt',
      status: 'active',
      category: '教程',
      tags: ['教程', '变量'],
      favorited: true,
      body: `请你扮演一名 {{role=资深前端工程师}}，针对以下 {{topic}} 给出 3 条具体可执行的建议，回答语言为 {{language=中文}}。

背景：
{{context}}

要求：每条建议先给结论，再用一句话说明理由。`,
      variables: [
        { name: 'role', required: false, defaultValue: '资深前端工程师' },
        { name: 'topic', required: true },
        { name: 'language', required: false, defaultValue: '中文' },
        { name: 'context', required: true },
      ],
      version: 1,
      usageCount: 0,
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'frag-style',
      title: '✂️ 片段：输出风格约束',
      type: 'fragment',
      status: 'active',
      category: '教程',
      tags: ['教程', '片段'],
      favorited: false,
      body: '请保持输出简洁、结构化：先用一句话给结论，再用要点列表展开，避免空泛的客套。',
      variables: [],
      version: 1,
      usageCount: 0,
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'frag-markdown',
      title: '✂️ 片段：Markdown 输出',
      type: 'fragment',
      status: 'active',
      category: '教程',
      tags: ['教程', '片段'],
      favorited: false,
      body: '请使用 Markdown 输出，代码片段用 ``` 包裹并标注语言；如果包含表格，使用 GFM 表格语法。',
      variables: [],
      version: 1,
      usageCount: 0,
      snapshots: [],
      createdAt: now,
      updatedAt: now,
    },
  ]
}
