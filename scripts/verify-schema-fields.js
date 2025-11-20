#!/usr/bin/env node
/**
 * 校验导出的数据是否符合关键字段与类型要求
 * 用法：node scripts/verify-schema-fields.js <schemaType> <dataFile>
 * 例如：node scripts/verify-schema-fields.js finance-cost records/finance-cost.json
 */

const fs = require('fs')
const path = require('path')

const SCHEMAS = {
  'health-dashboard': {
    required: ['totalAnimals', 'actualHealthyCount', 'originalTotalQuantity'],
    number: ['totalAnimals', 'deadCount', 'sickCount', 'actualHealthyCount', 'originalTotalQuantity'],
    flags: []
  },
  'finance-cost': {
    required: ['costType', 'title', 'amount', 'costDate'],
    number: ['amount'],
    flags: ['shouldSyncToFinance']
  },
  'finance-reimbursement': {
    required: ['applicantId', 'amount', 'status', 'category'],
    number: ['amount'],
    flags: []
  },
  'production-batch-entry': {
    required: ['batchNumber', 'quantity', 'entryDate'],
    number: ['quantity', 'unitPrice', 'totalAmount'],
    flags: ['openid']
  },
  'production-batch-exit': {
    required: ['batchNumber', 'quantity', 'exitDate'],
    number: ['quantity', 'unitPrice', 'totalRevenue'],
    flags: ['openid']
  },
  'production-material-record': {
    required: ['materialId', 'materialName', 'quantity', 'usageDate'],
    number: ['quantity', 'totalCost'],
    flags: ['openid']
  },
  'user-profile': {
    required: ['userId'],
    number: [],
    flags: ['openid']
  },
  'user-employee': {
    required: ['employeeId', 'name', 'role'],
    number: [],
    flags: []
  },
  'task-todo': {
    required: ['batchId', 'title', 'taskType', 'status', 'planDate'],
    number: [],
    flags: []
  },
  'ai-diagnosis': {
    required: ['diagnosisResult', 'createdAt'],
    number: ['confidence'],
    flags: []
  }
}

function usage() {
  console.log('用法：node scripts/verify-schema-fields.js <schemaType> <dataFile>')
  console.log('可选 schemaType：', Object.keys(SCHEMAS).join(', '))
}

function loadData(file) {
  const abs = path.resolve(file)
  if (!fs.existsSync(abs)) {
    throw new Error(`数据文件不存在：${abs}`)
  }
  const content = fs.readFileSync(abs, 'utf8')
  try {
    const data = JSON.parse(content)
    if (!Array.isArray(data)) {
      throw new Error('数据文件必须是 JSON 数组')
    }
    return data
  } catch (error) {
    throw new Error(`解析 JSON 失败：${error.message}`)
  }
}

function validate(schemaKey, records) {
  const schema = SCHEMAS[schemaKey]
  if (!schema) {
    throw new Error(`未知 schemaType：${schemaKey}`)
  }

  const errors = []

  records.forEach((record, index) => {
    schema.required.forEach(field => {
      if (!(field in record) || record[field] === '' || record[field] === null) {
        errors.push({ index, field, message: '缺少必填字段' })
      }
    })

    schema.number.forEach(field => {
      if (field in record && record[field] !== null && record[field] !== undefined) {
        const value = Number(record[field])
        if (!Number.isFinite(value)) {
          errors.push({ index, field, message: '应为数值类型' })
        }
      }
    })

    if (schema.flags.includes('openid')) {
      if (!record._openid || typeof record._openid !== 'string') {
        errors.push({ index, field: '_openid', message: '缺少 _openid' })
      }
    }

    if (schema.flags.includes('shouldSyncToFinance')) {
      if (!('shouldSyncToFinance' in (record.costBreakdown || record))) {
        errors.push({ index, field: 'shouldSyncToFinance', message: '缺少 shouldSyncToFinance 标记' })
      }
    }
  })

  return errors
}

function main() {
  const [schemaType, dataFile] = process.argv.slice(2)
  if (!schemaType || !dataFile) {
    usage()
    process.exit(1)
  }

  const data = loadData(dataFile)
  const errors = validate(schemaType, data)

  if (errors.length === 0) {
    console.log(`✅ ${schemaType} 数据校验通过，共 ${data.length} 条记录`)
  } else {
    console.error(`❌ ${schemaType} 数据发现 ${errors.length} 个问题：`)
    errors.slice(0, 50).forEach(err => {
      console.error(`- 第 ${err.index} 条记录 [${err.field}] ${err.message}`)
    })
    if (errors.length > 50) {
      console.error(`... 以及另外 ${errors.length - 50} 个问题`)
    }
    process.exitCode = 1
  }
}

main()
