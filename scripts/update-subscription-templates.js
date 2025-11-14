#!/usr/bin/env node
/**
 * 批量更新订阅消息模板配置脚本
 * 用法示例：
 *   node scripts/update-subscription-templates.js \
 *     --template '{"tmplId":"REAL_ID_1","title":"系统交互消息","description":"审批通知"}' \
 *     --template '{"tmplId":"REAL_ID_2","title":"生产进度提醒","description":"生产动态"}'
 * 输出文件：miniprogram/config/subscription-templates.ts
 */

const path = require('path')
const fs = require('fs')

const CONFIG_DIR = path.resolve(__dirname, '../miniprogram/config')
const CONFIG_FILE = path.join(CONFIG_DIR, 'subscription-templates.ts')

function parseArgs() {
  const args = process.argv.slice(2)
  const templates = []

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--template' && args[i + 1]) {
      try {
        const template = JSON.parse(args[i + 1])
        if (!template.tmplId || !template.title) {
          throw new Error('模板缺少 tmplId 或 title')
        }
        templates.push(template)
        i++
      } catch (error) {
        console.error('解析模板参数失败:', error.message)
        process.exit(1)
      }
    }
  }

  if (templates.length === 0) {
    console.error('请至少提供一个 --template 参数')
    process.exit(1)
  }

  return templates
}

function generateTsContent(templates) {
  const updatedAt = new Date().toISOString()
  const templatesJson = JSON.stringify(templates, null, 2)

  return `// 此文件由 scripts/update-subscription-templates.js 自动生成
// 更新时间：${updatedAt}
// ⚠️ 请勿手动修改，如需调整请运行脚本

import type { SubscriptionTemplate } from '../utils/notification-config'

export const SUBSCRIPTION_TEMPLATES: SubscriptionTemplate[] = ${templatesJson}

export const SUBSCRIPTION_TEMPLATES_UPDATED_AT = '${updatedAt}'
`
}

function saveTemplates(templates) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }

  const content = generateTsContent(templates)
  fs.writeFileSync(CONFIG_FILE, content, 'utf-8')
  console.log(`已写入 ${templates.length} 个模板至 ${CONFIG_FILE}`)
}

function main() {
  const templates = parseArgs()
  saveTemplates(templates)
}

main()
