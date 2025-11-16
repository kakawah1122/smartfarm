#!/usr/bin/env node

/**
 * 检查并删除空目录脚本
 * 用途：防止微信开发者工具因空目录报错
 * 
 * 运行方式：
 * node scripts/check-empty-dirs.js
 */

const fs = require('fs')
const path = require('path')

// 需要检查的目录
const CHECK_DIRS = [
  'miniprogram/packageAI',
  'miniprogram/packageFinance',
  'miniprogram/packageHealth',
  'miniprogram/packageProduction',
  'miniprogram/packageUser'
]

/**
 * 检查目录是否为空
 */
function isDirEmpty(dirPath) {
  try {
    const files = fs.readdirSync(dirPath)
    // 忽略 .DS_Store 等隐藏文件
    const visibleFiles = files.filter(file => !file.startsWith('.'))
    return visibleFiles.length === 0
  } catch (error) {
    return false
  }
}

/**
 * 递归查找空目录
 */
function findEmptyDirs(dirPath, emptyDirs = []) {
  try {
    const files = fs.readdirSync(dirPath)
    
    // 检查当前目录是否为空
    if (isDirEmpty(dirPath)) {
      emptyDirs.push(dirPath)
      return emptyDirs
    }
    
    // 递归检查子目录
    for (const file of files) {
      const fullPath = path.join(dirPath, file)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory() && !file.startsWith('.')) {
        findEmptyDirs(fullPath, emptyDirs)
      }
    }
  } catch (error) {
    console.error(`检查目录 ${dirPath} 失败:`, error.message)
  }
  
  return emptyDirs
}

/**
 * 删除空目录
 */
function removeEmptyDir(dirPath) {
  try {
    fs.rmdirSync(dirPath)
    console.log(`✅ 已删除空目录: ${dirPath}`)
    return true
  } catch (error) {
    console.error(`❌ 删除目录失败 ${dirPath}:`, error.message)
    return false
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🔍 开始检查空目录...\n')
  
  const rootDir = path.resolve(__dirname, '..')
  let totalEmptyDirs = []
  
  // 检查所有分包目录
  for (const checkDir of CHECK_DIRS) {
    const fullPath = path.join(rootDir, checkDir)
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  目录不存在: ${checkDir}`)
      continue
    }
    
    const emptyDirs = findEmptyDirs(fullPath)
    totalEmptyDirs = totalEmptyDirs.concat(emptyDirs)
  }
  
  // 输出结果
  if (totalEmptyDirs.length === 0) {
    console.log('✅ 没有发现空目录\n')
    return
  }
  
  console.log(`\n⚠️  发现 ${totalEmptyDirs.length} 个空目录:\n`)
  totalEmptyDirs.forEach(dir => {
    console.log(`   - ${dir}`)
  })
  
  // 询问是否删除
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  readline.question('\n是否删除这些空目录？(y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      console.log('\n开始删除...\n')
      let successCount = 0
      
      // 从最深层开始删除
      totalEmptyDirs.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length)
      
      totalEmptyDirs.forEach(dir => {
        if (removeEmptyDir(dir)) {
          successCount++
        }
      })
      
      console.log(`\n✅ 成功删除 ${successCount}/${totalEmptyDirs.length} 个空目录`)
    } else {
      console.log('\n❌ 已取消删除操作')
    }
    
    readline.close()
  })
}

// 运行主函数
main()
