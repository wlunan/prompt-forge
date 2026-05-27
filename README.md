# PromptForge — 词匠

> 专为 AI 创作者与开发者打造的提示词资产管理插件。

集模板化编排、变量注入、组合拼接与一键调用为一体，助你像工匠打磨作品一样，系统化地沉淀、优化并复用高质量提示词。

## 功能特性

### 调用

通过关键词搜索提示词，选中后一键复制到剪贴板。含变量的提示词自动进入填写模式，填完参数后复制即用。

- 左侧分类/标签侧边栏，按类型和标签快速筛选
- 键盘快捷键：`↑↓` 选择、`Enter` 复制、`E` 编辑
- 复制后自动隐藏窗口（可配置）

### 快速保存

在任意应用中选中或复制一段提示词，通过 ZTools 唤起栏触发保存。自动检测变量、推断标题和分类，并检测与已有提示词的重复度。

### 新建向导

三步引导式创建提示词：

1. **编写正文** — 支持 `{{变量名}}` 语法，实时识别变量
2. **基本信息** — 设置标题、分类、标签（可自动生成）
3. **变量配置** — 为每个变量设定默认值和必填性

### 库管理

左右分栏的编辑器界面，支持：

- 按分类（评审/编码/翻译/写作/问答/其它）和标签筛选
- 正文编辑、变量精细配置、使用统计
- 版本管理：正文变更自动递增版本号
- 一键复制、批量删除

### 组合

将一个基础提示词与多个片段拼接，实时预览合成结果。片段适合放风格约束、格式要求、安全声明等可复用段落。

### 设置

- **行为** — 复制后是否关闭窗口
- **主题** — 浅色/深色切换，跟随系统偏好
- **导入/导出** — JSON 格式备份与恢复
- **清空** — 一键清除全部数据

## 技术栈

- **Vue 3** + Composition API
- **TypeScript**
- **Vite** 构建
- **ZTools API** — 数据库、剪贴板、通知、窗口控制

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器（http://localhost:5173）
npm run dev

# 构建
npx vite build
```

在 ZTools 的插件配置中将开发地址设为 `http://localhost:5173` 即可实时预览。

## 项目结构

```
prompt-forge/
├── public/
│   ├── plugin.json          # 插件配置（功能入口、命令）
│   ├── logo.png
│   └── preload/
│       └── services.js      # Node.js 能力注入（文件读写、KV 存储）
├── src/
│   ├── App.vue              # 根组件（路由、CommandBar）
│   ├── main.ts
│   ├── main.css             # Light/Dark 双主题设计系统
│   ├── types/index.ts       # PromptUnit、Variable 等类型定义
│   ├── stores/
│   │   ├── router.ts        # 路由状态管理
│   │   ├── prompt.ts        # 提示词数据、搜索、筛选
│   │   ├── app.ts           # 应用设置
│   │   └── theme.ts         # 主题切换
│   ├── utils/
│   │   ├── index.ts         # 变量提取、相似度检测、标题推断
│   │   ├── storage.ts       # KV 存储抽象层
│   │   └── platform.ts      # ZTools API 封装
│   ├── components/
│   │   ├── CommandBar.vue   # 顶部导航 + 搜索
│   │   ├── PromptList.vue   # 提示词卡片列表
│   │   └── FillPanel.vue    # 变量填写 + 正文预览
│   └── views/
│       ├── CallView.vue     # 调用（主界面）
│       ├── WizardView.vue   # 新建向导
│       ├── LibraryView.vue  # 库管理
│       ├── ComposeView.vue  # 组合拼接
│       ├── QuickSaveView.vue # 快速保存
│       └── SettingsView.vue # 设置
└── vite.config.js
```

## 数据存储

提示词数据存储在 ZTools 内置数据库中，通过 `ztools.db` API 读写。插件不发起任何网络请求，所有数据仅保留在本地。

## 许可

© 2026 PromptForge
