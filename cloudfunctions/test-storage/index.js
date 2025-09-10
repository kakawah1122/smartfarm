/**
 * 云函数：测试存储功能
 * 验证自动创建文件夹机制和各种上传场景
 * 
 * 作者：AI Assistant
 * 创建时间：2025-09-10
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 引入存储管理工具
const { storageManager } = require('./storage-manager')

exports.main = async (event, context) => {
  const { action, params = {} } = event
  
  try {
    switch (action) {
      case 'test-folder-structure':
        return await testFolderStructure()
      
      case 'test-upload-file':
        return await testUploadFile(params)
      
      case 'test-batch-upload':
        return await testBatchUpload(params)
      
      case 'get-storage-info':
        return await getStorageInfo()
      
      case 'cleanup-test-files':
        return await cleanupTestFiles(params)
      
      default:
        return {
          success: false,
          error: '不支持的操作类型',
          supportedActions: [
            'test-folder-structure',
            'test-upload-file', 
            'test-batch-upload',
            'get-storage-info',
            'cleanup-test-files'
          ]
        }
    }
  } catch (error) {
    console.error('❌ 云函数执行失败:', error)
    return {
      success: false,
      error: error.message,
      stack: error.stack
    }
  }
}

/**
 * 测试文件夹结构创建
 */
async function testFolderStructure() {
  console.log('🧪 开始测试文件夹结构创建...')
  
  const testFiles = [
    { module: 'users', category: 'avatars', filename: 'test-avatar.txt' },
    { module: 'users', category: 'profiles', filename: 'test-profile.txt' },
    { module: 'production', category: 'batches', filename: 'test-batch.txt' },
    { module: 'production', category: 'reports', filename: 'test-report.txt' },
    { module: 'health', category: 'records', filename: 'test-health.txt' },
    { module: 'health', category: 'symptoms', filename: 'test-symptom.txt' },
    { module: 'ai-diagnosis', category: 'input', filename: 'test-ai-input.txt' },
    { module: 'ai-diagnosis', category: 'results', filename: 'test-ai-result.txt' },
    { module: 'materials', category: 'inventory', filename: 'test-material.txt' },
    { module: 'materials', category: 'receipts', filename: 'test-receipt.txt' },
    { module: 'documents', category: 'reports', filename: 'test-document.txt' },
    { module: 'documents', category: 'templates', filename: 'test-template.txt' },
    { module: 'system', category: 'configs', filename: 'test-config.txt' },
    { module: 'system', category: 'logs', filename: 'test-log.txt' }
  ]
  
  const results = []
  const errors = []
  
  for (const testFile of testFiles) {
    try {
      const cloudPath = storageManager.generateCloudPath(
        testFile.module,
        testFile.category, 
        testFile.filename
      )
      
      const result = await cloud.uploadFile({
        cloudPath,
        fileContent: Buffer.from(`测试文件\n模块: ${testFile.module}\n分类: ${testFile.category}\n创建时间: ${new Date().toISOString()}`)
      })
      
      results.push({
        module: testFile.module,
        category: testFile.category,
        cloudPath,
        fileID: result.fileID,
        status: 'success'
      })
      
      console.log(`✅ ${testFile.module}/${testFile.category} 文件夹创建成功`)
      
    } catch (error) {
      errors.push({
        module: testFile.module,
        category: testFile.category,
        error: error.message
      })
      
      console.error(`❌ ${testFile.module}/${testFile.category} 文件夹创建失败:`, error)
    }
  }
  
  return {
    success: errors.length === 0,
    message: `测试完成，成功创建 ${results.length} 个文件夹，失败 ${errors.length} 个`,
    results,
    errors,
    summary: {
      total: testFiles.length,
      succeeded: results.length,
      failed: errors.length,
      successRate: `${((results.length / testFiles.length) * 100).toFixed(1)}%`
    }
  }
}

/**
 * 测试单文件上传
 */
async function testUploadFile(params) {
  const { module, category, filename, content, userId } = params
  
  if (!module || !category || !filename) {
    return {
      success: false,
      error: '缺少必需参数: module, category, filename'
    }
  }
  
  try {
    const fileContent = content || `测试文件内容\n模块: ${module}\n分类: ${category}\n时间: ${new Date().toISOString()}`
    
    const cloudPath = storageManager.generateCloudPath(module, category, filename, userId)
    
    const result = await cloud.uploadFile({
      cloudPath,
      fileContent: Buffer.from(fileContent)
    })
    
    return {
      success: true,
      message: '文件上传成功',
      result: {
        module,
        category,
        filename,
        cloudPath,
        fileID: result.fileID,
        userId: userId || null
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      params
    }
  }
}

/**
 * 测试批量文件上传
 */
async function testBatchUpload(params) {
  const { files = [] } = params
  
  if (!Array.isArray(files) || files.length === 0) {
    return {
      success: false,
      error: '请提供文件列表参数'
    }
  }
  
  const results = []
  const errors = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    try {
      const uploadResult = await testUploadFile(file)
      
      if (uploadResult.success) {
        results.push(uploadResult.result)
      } else {
        errors.push({
          index: i,
          file,
          error: uploadResult.error
        })
      }
      
    } catch (error) {
      errors.push({
        index: i,
        file,
        error: error.message
      })
    }
  }
  
  return {
    success: errors.length === 0,
    message: `批量上传完成，成功 ${results.length} 个，失败 ${errors.length} 个`,
    results,
    errors,
    summary: {
      total: files.length,
      succeeded: results.length,
      failed: errors.length
    }
  }
}

/**
 * 获取存储信息
 */
async function getStorageInfo() {
  try {
    const structure = storageManager.getStorageStructure()
    
    // 统计信息
    const moduleCount = Object.keys(structure).length
    let categoryCount = 0
    
    Object.values(structure).forEach(categories => {
      categoryCount += Object.keys(categories).length
    })
    
    return {
      success: true,
      storageStructure: structure,
      statistics: {
        moduleCount,
        categoryCount,
        supportedModules: Object.keys(structure),
        lastUpdated: new Date().toISOString()
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 清理测试文件
 */
async function cleanupTestFiles(params) {
  const { fileIDs = [] } = params
  
  if (!Array.isArray(fileIDs) || fileIDs.length === 0) {
    return {
      success: false,
      error: '请提供要删除的文件ID列表'
    }
  }
  
  try {
    const result = await cloud.deleteFile({
      fileList: fileIDs
    })
    
    const successCount = result.fileList.filter(file => file.status === 0).length
    const failedCount = result.fileList.filter(file => file.status !== 0).length
    
    return {
      success: failedCount === 0,
      message: `清理完成，成功删除 ${successCount} 个文件，失败 ${failedCount} 个`,
      result,
      summary: {
        total: fileIDs.length,
        succeeded: successCount,
        failed: failedCount
      }
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}
