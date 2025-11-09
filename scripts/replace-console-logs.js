#!/usr/bin/env node
/**
 * 批量替换 console.log/warn 为 logger.log/warn
 * 使用方法: node scripts/replace-console-logs.js
 */

const fs = require('fs')
const path = require('path')

// 需要处理的目录
const TARGET_DIR = path.join(__dirname, '../miniprogram')

// 需要排除的文件/目录
const EXCLUDE_PATTERNS = [
  'node_modules',
  'miniprogram_npm'
]

// 需要排除的特定文件
const EXCLUDE_FILES = [
  'utils/logger.ts' // 日志工具本身不处理
]

// 需要处理的文件扩展名
const FILE_EXTENSIONS = ['.ts', '.js']

/**
 * 递归获取所有文件
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath)

  files.forEach(file => {
    const filePath = path.join(dirPath, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      // 跳过排除的目录
      if (!EXCLUDE_PATTERNS.some(pattern => filePath.includes(pattern))) {
        arrayOfFiles = getAllFiles(filePath, arrayOfFiles)
      }
    } else {
      // 只处理 TypeScript 和 JavaScript 文件
      const ext = path.extname(file)
      if (FILE_EXTENSIONS.includes(ext)) {
        // 排除特定文件
        const relativePath = path.relative(TARGET_DIR, filePath).replace(/\\/g, '/')
        if (!EXCLUDE_FILES.some(excludeFile => relativePath.includes(excludeFile))) {
          arrayOfFiles.push(filePath)
        }
      }
    }
  })

  return arrayOfFiles
}

/**
 * 替换文件中的 console.log/warn
 */
function replaceConsoleLogs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  let modified = false
  let hasLoggerImport = content.includes("from './utils/logger'") || content.includes('from "../utils/logger"') || content.includes("from '../../utils/logger'") || content.includes("from '../../../utils/logger'")

  // 计算相对路径层级，确定导入路径
  const relativePath = path.relative(path.dirname(filePath), path.join(TARGET_DIR, 'utils/logger.ts'))
  const importPath = relativePath.replace(/\\/g, '/').replace(/\.ts$/, '').replace(/^\.\.\//, '')

  // 添加 logger 导入（如果还没有）
  if (!hasLoggerImport && (content.includes('console.log') || content.includes('console.warn'))) {
    // 计算正确的相对路径
    let loggerImportPath = './utils/logger'
    const depth = filePath.split(path.sep).length - TARGET_DIR.split(path.sep).length - 1
    if (depth > 0) {
      loggerImportPath = '../'.repeat(depth) + 'utils/logger'
    }
    
    // 查找最后一个 import 语句的位置
    const importMatch = content.match(/^import\s+.*$/gm)
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1]
      const lastImportIndex = content.lastIndexOf(lastImport)
      const insertIndex = lastImportIndex + lastImport.length
      
      content = content.slice(0, insertIndex) + `\nimport { logger } from '${loggerImportPath}'` + content.slice(insertIndex)
      modified = true
    } else {
      // 如果没有 import，在文件开头添加
      content = `import { logger } from '${loggerImportPath}'\n` + content
      modified = true
    }
  }

  // 替换 console.log
  if (content.includes('console.log')) {
    content = content.replace(/console\.log\(/g, 'logger.log(')
    modified = true
  }

  // 替换 console.warn
  if (content.includes('console.warn')) {
    content = content.replace(/console\.warn\(/g, 'logger.warn(')
    modified = true
  }

  // console.error 保持不变（用于错误追踪）

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8')
    return true
  }

  return false
}

/**
 * 主函数
 */
function main() {
  console.log('开始批量替换 console.log/warn...')
  
  const files = getAllFiles(TARGET_DIR)
  let modifiedCount = 0

  files.forEach(file => {
    try {
      if (replaceConsoleLogs(file)) {
        modifiedCount++
        console.log(`✓ 已处理: ${path.relative(TARGET_DIR, file)}`)
      }
    } catch (error) {
      console.error(`✗ 处理失败: ${file}`, error.message)
    }
  })

  console.log(`\n完成！共处理 ${modifiedCount} 个文件`)
  console.log('\n注意：')
  console.log('1. 请检查导入路径是否正确')
  console.log('2. console.error 保持不变（用于错误追踪）')
  console.log('3. 请手动检查替换结果')
}

if (require.main === module) {
  main()
}

module.exports = { replaceConsoleLogs, getAllFiles }

