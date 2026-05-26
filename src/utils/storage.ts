import type { PromptUnit } from '../types'

/** 获取 KV 存储实例（preload kvStorage 或 ztools.dbStorage） */
function getKv() {
  const preload = (window as any).kvStorage
  if (preload) return preload
  const ds = (window as any).ztools?.dbStorage
  if (ds) return {
    get: (key: string) => ds.getItem('promptforge:' + key),
    set: (key: string, value: any) => ds.setItem('promptforge:' + key, value),
    remove: (key: string) => ds.removeItem('promptforge:' + key),
  }
  return null
}

const ALL_KEY = 'prompts'

/** 加载所有提示词 */
export async function loadAll(): Promise<PromptUnit[]> {
  const kv = getKv()
  if (!kv) return seedDefaults()
  try {
    const raw = kv.get(ALL_KEY)
    if (Array.isArray(raw) && raw.length > 0) return raw
    const defaults = seedDefaults()
    kv.set(ALL_KEY, defaults)
    return defaults
  } catch {
    return seedDefaults()
  }
}

/** 保存所有提示词 */
export async function saveAll(units: PromptUnit[]): Promise<void> {
  const kv = getKv()
  if (kv) kv.set(ALL_KEY, JSON.parse(JSON.stringify(units)))
}

/** 保存设置 */
export async function getSettings(): Promise<Record<string, any> | null> {
  const kv = getKv()
  if (kv) return kv.get('settings')
  return null
}

export async function setSettings(settings: Record<string, any>): Promise<void> {
  const kv = getKv()
  if (kv) kv.set('settings', settings)
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
