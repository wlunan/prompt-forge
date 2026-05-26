<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from '../stores/router'
import { usePromptStore } from '../stores/prompt'
import { useAppSettings } from '../stores/app'

const router = useRouter()
const promptStore = usePromptStore()
const appSettings = useAppSettings()
const tab = ref('behavior')

function goBack() { router.navigateTo('call') }

function exportJson() {
  const json = JSON.stringify(promptStore.rawItems.value, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `promptforge-library-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importJson(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result as string)
      if (!Array.isArray(data)) { alert('文件格式不正确'); return }
      await promptStore.ensureReady()
      let count = 0
      for (const item of data) {
        if (item.id && item.title && item.body) {
          if (!promptStore.rawItems.value.some(u => u.id === item.id)) {
            promptStore.rawItems.value.push(item)
            count++
          }
        }
      }
      await promptStore.persistAll()
      alert(`✓ 导入 ${count} 条提示词`)
    } catch { alert('导入失败：文件内容不是合法 JSON') }
  }
  reader.readAsText(file)
}

async function clearAll() {
  if (!confirm('⚠ 确定要清空全部提示词吗？此操作不可撤销。')) return
  if (!confirm('最后确认：删除后无法恢复，是否继续？')) return
  await promptStore.ensureReady()
  promptStore.rawItems.value.splice(0, promptStore.rawItems.value.length)
  await promptStore.persistAll()
  alert('✓ 已清空')
}
</script>

<template>
  <div class="settings-view">
    <div class="top-bar">
      <button class="back-btn" @click="goBack">←</button>
      <span class="bar-title">设置</span>
      <span class="spacer"></span>
    </div>

    <div class="settings-body">
      <!-- 侧边导航 -->
      <div class="settings-nav">
        <div class="nav-section">通用</div>
        <div :class="['nav-item', { active: tab === 'behavior' }]" @click="tab = 'behavior'">⚙ 行为</div>
        <div class="nav-section">数据</div>
        <div :class="['nav-item', { active: tab === 'import-export' }]" @click="tab = 'import-export'">📦 导入/导出</div>
        <div class="nav-section">关于</div>
        <div :class="['nav-item', { active: tab === 'about' }]" @click="tab = 'about'">ℹ 关于</div>
      </div>

      <!-- 内容区 -->
      <div class="settings-content">
        <!-- 行为 -->
        <div v-if="tab === 'behavior'">
          <h2>行为设置</h2>
          <p class="sub">复制、保存相关的默认策略。</p>
          <div class="setting-group">
            <h3>复制行为</h3>
            <div class="setting-row">
              <div class="info">
                <div class="lbl">复制后关闭窗口</div>
                <div class="desc">复制成功后自动隐藏插件窗口</div>
              </div>
              <div class="toggle" :class="{ on: appSettings.settings.value.closeAfterCopy }"
                @click="appSettings.settings.value.closeAfterCopy = !appSettings.settings.value.closeAfterCopy; appSettings.save()">
              </div>
            </div>
            <div class="setting-row">
              <div class="info">
                <div class="lbl">自动聚焦目标应用</div>
                <div class="desc">复制完成后切换到上次活动的窗口</div>
              </div>
              <span class="lock-tag">v1.1</span>
            </div>
          </div>
        </div>

        <!-- 导入/导出 -->
        <div v-if="tab === 'import-export'">
          <h2>导入与导出</h2>
          <p class="sub">支持 JSON 格式的备份与恢复。</p>
          <div class="setting-group">
            <h3>导出</h3>
            <div class="setting-row">
              <div class="info">
                <div class="lbl">导出词库为 JSON</div>
                <div class="desc">将全部提示词导出为标准 JSON 文件</div>
              </div>
              <button class="btn primary" @click="exportJson">导出</button>
            </div>
          </div>
          <div class="setting-group">
            <h3>导入</h3>
            <div class="setting-row">
              <div class="info">
                <div class="lbl">从 JSON 导入</div>
                <div class="desc">选择 JSON 文件合并导入到当前词库</div>
              </div>
              <label class="btn file-btn">
                选择文件
                <input type="file" accept=".json" @change="importJson" style="display:none" />
              </label>
            </div>
          </div>
          <div class="setting-group danger-zone">
            <h3 style="color: var(--pf-danger)">危险操作</h3>
            <div class="setting-row" style="border-bottom:0">
              <div class="info">
                <div class="lbl" style="color: var(--pf-danger)">清空全部提示词</div>
                <div class="desc">永久删除所有提示词，操作不可逆。建议先导出备份。</div>
              </div>
              <button class="btn danger" @click="clearAll">清空全部</button>
            </div>
          </div>
        </div>

        <!-- 关于 -->
        <div v-if="tab === 'about'">
          <h2>关于 PromptForge</h2>
          <p class="sub">一款专注的提示词生命周期管理插件。</p>
          <div class="about-card">
            <div class="about-logo">PF</div>
            <div class="about-info">
              <h3>PromptForge</h3>
              <p class="v-num">v1.0.0</p>
              <p class="copyright">© 2026 PromptForge. All rights reserved.</p>
            </div>
          </div>
          <div class="setting-group">
            <h3>隐私声明</h3>
            <ul class="privacy-list">
              <li>本插件 <strong>不发起任何网络请求</strong>，无遥测、无云端账户。</li>
              <li>提示词数据存储在 ztools 内置数据库中，仅在你明确选择的本地文件夹中同步。</li>
              <li>卸载插件时，ztools 会清理数据库；同步文件夹将原样保留。</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  background: var(--pf-bg); user-select: none; overflow: hidden;
}
.top-bar {
  height: 48px; flex-shrink: 0;
  display: flex; align-items: center; padding: 0 16px; gap: 10px;
  border-bottom: 1px solid var(--pf-border-soft);
  background: var(--pf-surface);
}
.back-btn {
  width: 28px; height: 28px; border: 0; background: transparent;
  color: var(--pf-text-muted); font-size: 16px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
.back-btn:hover { background: var(--pf-bg); }
.bar-title { font-size: 13.5px; font-weight: 600; color: var(--pf-text); }
.spacer { flex: 1; }

.settings-body {
  flex: 1; min-height: 0; display: grid;
  grid-template-columns: 160px 1fr;
}
.settings-nav {
  background: var(--pf-bg); border-right: 1px solid var(--pf-border);
  padding: 12px 6px; overflow-y: auto;
  display: flex; flex-direction: column;
}
.nav-section {
  font-size: 10.5px; color: var(--pf-text-faint);
  text-transform: uppercase; letter-spacing: 0.08em;
  padding: 10px 10px 3px; font-weight: 600;
}
.nav-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; border-radius: var(--pf-radius-sm);
  color: var(--pf-text); cursor: pointer; font-size: 12.5px;
}
.nav-item:hover { background: rgba(74, 111, 165, 0.06); }
.nav-item.active { background: var(--pf-primary-soft); color: var(--pf-primary); font-weight: 500; }

.settings-content {
  overflow-y: auto; padding: 20px 24px;
  background: var(--pf-surface);
}
.settings-content h2 { font-size: 16px; font-weight: 600; color: var(--pf-text); margin: 0 0 4px; }
.sub { font-size: 12px; color: var(--pf-text-muted); margin: 0 0 18px; }
.setting-group { margin-bottom: 20px; }
.setting-group h3 { font-size: 12.5px; font-weight: 600; color: var(--pf-text-muted); margin: 0 0 10px; }
.setting-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0; border-bottom: 1px solid var(--pf-border-soft);
}
.setting-row:last-of-type { border-bottom: 0; }
.info { display: flex; flex-direction: column; gap: 2px; padding-right: 16px; }
.lbl { font-size: 12.5px; font-weight: 600; color: var(--pf-text); }
.desc { font-size: 11.5px; color: var(--pf-text-muted); line-height: 1.4; }
.toggle {
  width: 32px; height: 18px; background: var(--pf-border);
  border-radius: 9px; position: relative; cursor: pointer;
  transition: background 0.12s; flex-shrink: 0;
}
.toggle::before {
  content: ''; position: absolute; left: 2px; top: 2px;
  width: 14px; height: 14px; border-radius: 50%;
  background: #fff; transition: left 0.12s;
  box-shadow: var(--pf-shadow-xs);
}
.toggle.on { background: var(--pf-primary); }
.toggle.on::before { left: 16px; }
.lock-tag {
  font-size: 10px; color: var(--pf-text-faint);
  background: var(--pf-border-soft); padding: 2px 8px;
  border-radius: 12px; font-weight: 600;
}
.file-btn { cursor: pointer; }
.about-card {
  display: flex; align-items: center; gap: 16px;
  background: var(--pf-surface-raised); border: 1px solid var(--pf-border);
  border-radius: var(--pf-radius); padding: 20px; margin: 10px 0 20px;
}
.about-logo {
  width: 52px; height: 52px; background: var(--pf-primary);
  color: #fff; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 800;
}
.about-info h3 { font-size: 15px; font-weight: 700; margin: 0 0 2px; color: var(--pf-text); }
.v-num { font-size: 12px; color: var(--pf-primary); font-weight: 600; margin: 0 0 4px; }
.copyright { font-size: 11px; color: var(--pf-text-faint); margin: 0; }
.privacy-list { margin: 0; padding-left: 18px; font-size: 12.5px; color: var(--pf-text); line-height: 1.7; }
.privacy-list li + li { margin-top: 4px; }
.privacy-list strong { font-weight: 600; }
.danger-zone h3 { color: var(--pf-danger) !important; }
</style>
