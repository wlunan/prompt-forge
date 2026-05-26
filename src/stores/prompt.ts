import { ref, computed } from 'vue'
import type { PromptUnit, SearchResult } from '../types'
import { loadAll, saveAll } from '../utils/storage'
import { fnvHash } from '../utils/index'

const rawItems = ref<PromptUnit[]>([])
const isLoading = ref(false)

/** 简易搜索引擎 */
function search(items: PromptUnit[], query: string): SearchResult[] {
  if (!query.trim()) return items.map(item => ({ item, score: 0 }))
  const lower = query.toLowerCase().trim()
  const results: SearchResult[] = []
  for (const item of items) {
    let score = 0
    const title = item.title.toLowerCase()
    const body = item.body.toLowerCase()
    if (title === lower) score += 100
    else if (title.startsWith(lower)) score += 50
    else if (title.includes(lower)) score += 30
    for (const tag of item.tags) {
      const tl = tag.toLowerCase()
      if (tl === lower) score += 40
      else if (tl.includes(lower)) score += 20
    }
    if (body.includes(lower)) score += 5
    if (score > 0) results.push({ item, score })
  }
  return results
}

export function usePromptStore() {
  const query = ref('')
  const phase = ref<'search' | 'fill'>('search')
  const keyboardIndex = ref(0)
  const selectedUnit = ref<PromptUnit | null>(null)
  const variableValues = ref<Record<string, string>>({})
  let _initPromise: Promise<void> | null = null

  /** 排序规则：收藏 > 最近使用 > 使用次数 > 更新时间 */
  const sortedItems = computed(() => {
    return [...rawItems.value].sort((a, b) => {
      const fa = a.favorited ? 1 : 0
      const fb = b.favorited ? 1 : 0
      if (fa !== fb) return fb - fa
      const la = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0
      const lb = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0
      if (la !== lb) return lb - la
      if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  })

  const filteredItems = computed(() => {
    if (!query.value.trim()) return sortedItems.value
    return search(sortedItems.value, query.value)
      .sort((a, b) => b.score - a.score)
      .map(r => r.item)
  })

  const activeItem = computed(() => {
    if (filteredItems.value.length === 0) return null
    return filteredItems.value[keyboardIndex.value] || filteredItems.value[0]
  })

  function moveSelection(dir: 'up' | 'down') {
    if (filteredItems.value.length === 0) return
    if (dir === 'down') {
      if (keyboardIndex.value < filteredItems.value.length - 1) keyboardIndex.value++
    } else {
      if (keyboardIndex.value > 0) keyboardIndex.value--
    }
  }

  function selectActive() {
    if (!activeItem.value) return
    selectedUnit.value = activeItem.value
    phase.value = 'fill'
    // 初始化变量值
    variableValues.value = {}
    if (activeItem.value.variables) {
      for (const v of activeItem.value.variables) {
        variableValues.value[v.name] = v.defaultValue || ''
      }
    }
  }

  function resetSelection() {
    query.value = ''
    phase.value = 'search'
    keyboardIndex.value = 0
    selectedUnit.value = null
    variableValues.value = {}
  }

  async function init() {
    if (_initPromise) return _initPromise
    _initPromise = (async () => {
      isLoading.value = true
      rawItems.value = await loadAll()
      isLoading.value = false
    })()
    return _initPromise
  }

  async function ensureReady() {
    await init()
  }

  async function persistAll() {
    await saveAll(rawItems.value)
  }

  async function recordUsage(id: string) {
    const item = rawItems.value.find(u => u.id === id)
    if (item) {
      item.usageCount = (item.usageCount || 0) + 1
      item.lastUsedAt = new Date().toISOString()
      await persistAll()
    }
  }

  return {
    rawItems,
    isLoading,
    query,
    phase,
    keyboardIndex,
    selectedUnit,
    variableValues,
    filteredItems,
    sortedItems,
    activeItem,
    moveSelection,
    selectActive,
    resetSelection,
    init,
    ensureReady,
    persistAll,
    recordUsage,
  }
}
