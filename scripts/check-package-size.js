#!/usr/bin/env node
/**
 * 检查主包与分包大小是否符合微信规范
 */

const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')
const MINIPROGRAM_DIR = path.join(ROOT, 'miniprogram')

const LIMITS = {
  main: 1.5 * 1024 * 1024, // 1.5MB
  sub: 2 * 1024 * 1024,    // 2MB
  total: 16 * 1024 * 1024  // 16MB
}

const getSize = dir => {
  const output = execSync(`du -sk ${dir}`).toString().trim()
  const sizeKb = parseInt(output.split('\t')[0], 10)
  return sizeKb * 1024
}

function checkPackageSizes() {
  const packages = [
    'pages',
    'packageHealth',
    'packageProduction',
    'packageFinance',
    'packageUser',
    'packageAI'
  ]

  let totalSize = 0
  const report = packages.map(pkg => {
    const dir = path.join(MINIPROGRAM_DIR, pkg)
    if (!fs.existsSync(dir)) {
      return null
    }
    const size = getSize(dir)
    totalSize += size
    return { name: pkg, size }
  }).filter(Boolean)

  const violations = []

  report.forEach(({ name, size }) => {
    const limit = name === 'pages' ? LIMITS.main : LIMITS.sub
    if (size > limit) {
      violations.push(`${name} 超出限制：${(size / 1024 / 1024).toFixed(2)}MB`) 
    }
  })

  if (totalSize > LIMITS.total) {
    violations.push(`总包大小超出限制：${(totalSize / 1024 / 1024).toFixed(2)}MB`)
  }

  console.log('包体积报告:')
  report.forEach(({ name, size }) => {
    console.log(`- ${name}: ${(size / 1024 / 1024).toFixed(2)} MB`)
  })
  console.log(`总计: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)

  if (violations.length > 0) {
    console.error('\n检测到以下超限项目:')
    violations.forEach(v => console.error(`- ${v}`))
    process.exitCode = 1
  } else {
    console.log('\n所有包都符合体积限制')
  }
}

checkPackageSizes()
