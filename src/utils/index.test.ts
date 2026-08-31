import { describe, expect, it } from 'vitest'
import { extractVariables, renderVariables } from './index'

describe('变量解析与渲染', () => {
  it('同时支持双花括号和美元花括号语法', () => {
    const template = '你是 {{role=工程师}}，请处理 ${topic}。'

    expect(extractVariables(template)).toEqual([
      { name: 'role', required: false, defaultValue: '工程师' },
      { name: 'topic', required: true, defaultValue: undefined },
    ])
    expect(renderVariables(template, { role: '设计师', topic: '导入流程' }))
      .toBe('你是 设计师，请处理 导入流程。')
  })
})
