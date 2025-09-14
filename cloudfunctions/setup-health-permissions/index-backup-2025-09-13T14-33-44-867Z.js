// setup-health-permissions/index.js - 健康管理模块数据库权限配置云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, collection, testMode } = event

  try {
    switch (action) {
      case 'setup_permissions':
        return await setupPermissions(testMode)
      case 'verify_permissions':
        return await verifyPermissions(collection)
      case 'create_collections':
        return await createCollections()
      case 'setup_indexes':
        return await setupIndexes()
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '权限配置操作失败'
    }
  }
}

// 设置权限配置（生成配置指南）
async function setupPermissions(testMode = false) {
  // 健康管理模块的数据库集合定义
  const healthCollections = {
    // 标准权限集合：创建者读写，其他用户只读
    standard: [
      'health_records',           // 健康记录
      'death_records',            // 死亡记录  
      'followup_records',         // 跟进记录
      'cure_records',             // 治愈记录
      'prevention_records',       // 预防记录
      'vaccine_plans',            // 疫苗计划
      'treatment_records',        // 治疗记录
      'ai_diagnosis_records'      // AI诊断记录
    ],
    
    // 特殊权限集合
    special: {
      'health_alerts': {
        read: 'auth.openid != null',
        write: false, // 只能通过云函数写入
        description: '健康预警集合，用户只读，系统写入'
      }
    }
  }

  // 生成权限配置脚本
  const permissionConfig = generatePermissionConfig(healthCollections)
  
  if (testMode) {
    // 测试模式：验证集合存在性
    const collectionStatus = await checkCollections(healthCollections)
    return {
      success: true,
      data: {
        permissionConfig,
        collectionStatus,
        message: '测试模式：权限配置规则已生成，集合状态已检查'
      }
    }
  }

  return {
    success: true,
    data: {
      permissionConfig,
      instructions: [
        '1. 打开微信云开发控制台',
        '2. 进入数据库管理页面', 
        '3. 为每个集合设置对应的权限规则',
        '4. 使用 verify_permissions 操作验证配置'
      ],
      message: '权限配置规则已生成，请按指导手动配置'
    }
  }
}

// 生成权限配置
function generatePermissionConfig(collections) {
  const config = {
    standard_collections: {},
    special_collections: collections.special,
    console_commands: []
  }

  // 标准集合权限
  const standardPermission = {
    read: 'auth.openid != null',
    write: 'auth.openid == resource._openid'
  }

  collections.standard.forEach(collectionName => {
    config.standard_collections[collectionName] = {
      ...standardPermission,
      description: `${collectionName} - 创建者读写，其他用户只读`
    }
    
    // 生成控制台命令
    config.console_commands.push({
      collection: collectionName,
      command: `设置 ${collectionName} 集合权限`,
      read_rule: standardPermission.read,
      write_rule: standardPermission.write
    })
  })

  // 特殊集合权限命令
  Object.entries(collections.special).forEach(([collectionName, permission]) => {
    config.console_commands.push({
      collection: collectionName,
      command: `设置 ${collectionName} 集合权限`,
      read_rule: permission.read,
      write_rule: permission.write || 'false'
    })
  })

  return config
}

// 检查集合存在性
async function checkCollections(collections) {
  const status = {
    existing: [],
    missing: [],
    errors: []
  }

  // 检查标准集合
  for (const collectionName of collections.standard) {
    try {
      const result = await db.collection(collectionName).limit(1).get()
      status.existing.push(collectionName)
    } catch (error) {
      if (error.errCode === -502002) {
        // 集合不存在
        status.missing.push(collectionName)
      } else {
        status.errors.push({
          collection: collectionName,
          error: error.message
        })
      }
    }
  }

  // 检查特殊集合
  for (const collectionName of Object.keys(collections.special)) {
    try {
      const result = await db.collection(collectionName).limit(1).get()
      status.existing.push(collectionName)
    } catch (error) {
      if (error.errCode === -502002) {
        status.missing.push(collectionName)
      } else {
        status.errors.push({
          collection: collectionName,
          error: error.message
        })
      }
    }
  }

  return status
}

// 验证权限配置
async function verifyPermissions(targetCollection) {
  const testResults = {
    collection: targetCollection,
    tests: [],
    summary: {
      passed: 0,
      failed: 0,
      total: 0
    }
  }

  try {
    // 测试1：尝试读取数据
    try {
      const readResult = await db.collection(targetCollection).limit(1).get()
      testResults.tests.push({
        test: 'read_access',
        status: 'passed',
        message: '读取权限正常'
      })
      testResults.summary.passed++
    } catch (error) {
      testResults.tests.push({
        test: 'read_access',
        status: 'failed', 
        message: `读取权限失败: ${error.message}`
      })
      testResults.summary.failed++
    }

    // 测试2：尝试写入测试数据（仅在非生产环境）
    if (process.env.NODE_ENV !== 'production') {
      try {
        const testDoc = {
          _openid: 'test_openid',
          testField: 'permission_test',
          createTime: new Date().toISOString(),
          isTest: true
        }
        
        const writeResult = await db.collection(targetCollection).add({
          data: testDoc
        })
        
        // 立即删除测试数据
        await db.collection(targetCollection).doc(writeResult._id).remove()
        
        testResults.tests.push({
          test: 'write_access',
          status: 'passed',
          message: '写入权限正常'
        })
        testResults.summary.passed++
      } catch (error) {
        testResults.tests.push({
          test: 'write_access',
          status: 'failed',
          message: `写入权限测试失败: ${error.message}`
        })
        testResults.summary.failed++
      }
    }

    testResults.summary.total = testResults.tests.length

  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '权限验证过程出错'
    }
  }

  return {
    success: true,
    data: testResults,
    message: `权限验证完成，通过 ${testResults.summary.passed}/${testResults.summary.total} 项测试`
  }
}

// 创建缺失的集合
async function createCollections() {
  const collectionsToCreate = [
    'health_records',
    'death_records',
    'followup_records', 
    'cure_records',
    'prevention_records',
    'vaccine_plans',
    'treatment_records',
    'ai_diagnosis_records',
    'health_alerts'
  ]

  const results = {
    created: [],
    existing: [],
    errors: []
  }

  for (const collectionName of collectionsToCreate) {
    try {
      // 尝试创建集合（通过插入一条临时记录）
      const tempDoc = {
        _temp: true,
        createdAt: new Date().toISOString(),
        purpose: 'collection_initialization'
      }
      
      const result = await db.collection(collectionName).add({
        data: tempDoc
      })
      
      // 删除临时记录
      await db.collection(collectionName).doc(result._id).remove()
      
      results.created.push(collectionName)
    } catch (error) {
      if (error.errCode === -502005) {
        // 集合已存在
        results.existing.push(collectionName)
      } else {
        results.errors.push({
          collection: collectionName,
          error: error.message
        })
      }
    }
  }

  return {
    success: true,
    data: results,
    message: `集合创建完成：新建 ${results.created.length} 个，已存在 ${results.existing.length} 个`
  }
}

// 设置数据库索引
async function setupIndexes() {
  // 关键索引配置
  const indexConfig = [
    {
      collection: 'health_records',
      indexes: [
        { keys: { '_openid': 1, 'createTime': -1 } },
        { keys: { 'animalId': 1, 'createTime': -1 } },
        { keys: { 'severity': 1, 'createTime': -1 } }
      ]
    },
    {
      collection: 'ai_diagnosis_records', 
      indexes: [
        { keys: { '_openid': 1, 'createTime': -1 } },
        { keys: { 'status': 1, 'createTime': -1 } },
        { keys: { 'confidence': -1, 'createTime': -1 } }
      ]
    },
    {
      collection: 'treatment_records',
      indexes: [
        { keys: { '_openid': 1, 'createTime': -1 } },
        { keys: { 'status': 1, 'createTime': -1 } },
        { keys: { 'diagnosisId': 1 } }
      ]
    },
    {
      collection: 'health_alerts',
      indexes: [
        { keys: { 'severity': 1, 'createTime': -1 } },
        { keys: { 'status': 1, 'createTime': -1 } },
        { keys: { 'isDeleted': 1, 'createTime': -1 } }
      ]
    }
  ]

  return {
    success: true,
    data: {
      indexConfig,
      message: '索引配置已生成，请在云开发控制台手动创建索引'
    },
    instructions: [
      '1. 进入云开发控制台 -> 数据库 -> 集合管理',
      '2. 选择对应集合 -> 索引管理',
      '3. 点击新建索引，按配置创建复合索引',
      '4. 验证索引创建成功'
    ]
  }
}
