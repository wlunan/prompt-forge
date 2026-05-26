/** 变量定义 */
export interface Variable {
  name: string
  required: boolean
  defaultValue?: string
}

/** 版本快照 */
export interface Snapshot {
  version: number
  body: string
  note: string
  createdAt: string
}

/** 提示词单元 */
export interface PromptUnit {
  id: string
  title: string
  type: 'prompt' | 'fragment'
  status: 'active' | 'draft' | 'archived'
  category: string
  tags: string[]
  body: string
  variables: Variable[]
  version: number
  usageCount: number
  favorited: boolean
  snapshots: Snapshot[]
  createdAt: string
  updatedAt: string
  lastUsedAt?: string
}

/** DB 文档格式（带 _id/_rev） */
export interface PromptDoc {
  _id: string
  _rev?: string
  data: PromptUnit
}

/** 导入/导出格式 */
export type PromptLibrary = PromptUnit[]

/** 搜索结果 */
export interface SearchResult {
  item: PromptUnit
  score: number
}

/** 重复检测结果 */
export interface DuplicateResult {
  phase: 'normal' | 'exact' | 'similar'
  exact?: PromptUnit
  similar: Array<{ item: PromptUnit; score: number }>
}
