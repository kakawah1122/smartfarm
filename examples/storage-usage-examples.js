/**
 * 云开发存储管理工具使用示例
 * 展示各种业务场景下的文件上传使用方法
 * 
 * 作者：AI Assistant
 * 更新时间：2025-09-10
 */

// 引入存储管理工具
const { storageManager } = require('../utils/storage-manager.js')

/**
 * 示例1：用户头像上传
 */
const uploadUserAvatar = async (tempFilePath, userId) => {
  try {
    const result = await storageManager.uploadFile({
      module: 'users',
      category: 'avatars', 
      filePath: tempFilePath,
      filename: 'avatar.jpg',
      userId: userId,
      onProgress: (progress) => {
        console.log('上传进度:', progress.progress + '%')
      }
    })
    
    console.log('✅ 头像上传成功:', result.fileID)
    return result.fileID
  } catch (error) {
    console.error('❌ 头像上传失败:', error)
    throw error
  }
}

/**
 * 示例2：生产批次照片上传
 */
const uploadProductionPhoto = async (tempFilePath, batchNumber) => {
  try {
    const result = await storageManager.uploadFile({
      module: 'production',
      category: 'batches',
      filePath: tempFilePath,
      filename: `batch-${batchNumber}-${Date.now()}.jpg`
    })
    
    console.log('✅ 生产照片上传成功:', result.fileID)
    return result.fileID
  } catch (error) {
    console.error('❌ 生产照片上传失败:', error)
    throw error
  }
}

/**
 * 示例3：健康记录图片上传
 */
const uploadHealthRecord = async (tempFilePath, userId, recordType) => {
  try {
    const result = await storageManager.uploadFile({
      module: 'health',
      category: recordType, // 'symptoms', 'treatment', 'vaccines' etc.
      filePath: tempFilePath,
      filename: `health-${recordType}-${Date.now()}.jpg`,
      userId: userId
    })
    
    console.log('✅ 健康记录上传成功:', result.fileID)
    return result.fileID
  } catch (error) {
    console.error('❌ 健康记录上传失败:', error)
    throw error
  }
}

/**
 * 示例4：AI诊断图片上传
 */
const uploadAIDiagnosisImage = async (tempFilePath, diagnosisId) => {
  try {
    const result = await storageManager.uploadFile({
      module: 'ai-diagnosis',
      category: 'input',
      filePath: tempFilePath,
      filename: `diagnosis-${diagnosisId}-input.jpg`
    })
    
    console.log('✅ AI诊断图片上传成功:', result.fileID)
    return result.fileID
  } catch (error) {
    console.error('❌ AI诊断图片上传失败:', error)
    throw error
  }
}

/**
 * 示例5：物料采购票据上传
 */
const uploadMaterialReceipt = async (tempFilePath, purchaseId) => {
  try {
    const result = await storageManager.uploadFile({
      module: 'materials',
      category: 'receipts',
      filePath: tempFilePath,
      filename: `receipt-${purchaseId}.pdf`
    })
    
    console.log('✅ 采购票据上传成功:', result.fileID)
    return result.fileID
  } catch (error) {
    console.error('❌ 采购票据上传失败:', error)
    throw error
  }
}

/**
 * 示例6：财务发票上传（敏感文件）
 */
const uploadFinanceInvoice = async (tempFilePath, invoiceNumber) => {
  try {
    const result = await storageManager.uploadFile({
      module: 'finance',
      category: 'invoices',
      filePath: tempFilePath,
      filename: `invoice-${invoiceNumber}.pdf`
    })
    
    console.log('✅ 财务发票上传成功:', result.fileID)
    return result.fileID
  } catch (error) {
    console.error('❌ 财务发票上传失败:', error)
    throw error
  }
}

/**
 * 示例7：批量文件上传
 */
const uploadBatchFiles = async (fileList) => {
  try {
    const result = await storageManager.uploadBatch(fileList)
    
    console.log('📁 批量上传结果:', {
      总数: result.summary.total,
      成功: result.summary.succeeded,
      失败: result.summary.failed
    })
    
    // 处理上传成功的文件
    result.results.forEach(file => {
      console.log('✅ 上传成功:', file.cloudPath)
    })
    
    // 处理上传失败的文件
    result.errors.forEach(error => {
      console.error('❌ 上传失败:', error.file, error.error)
    })
    
    return result
  } catch (error) {
    console.error('❌ 批量上传失败:', error)
    throw error
  }
}

/**
 * 示例8：获取文件下载链接
 */
const getFileDownloadUrl = async (fileID) => {
  try {
    const url = await storageManager.getFileUrl(fileID)
    console.log('🔗 文件下载链接:', url)
    return url
  } catch (error) {
    console.error('❌ 获取下载链接失败:', error)
    throw error
  }
}

/**
 * 示例9：删除过期文件
 */
const deleteExpiredFiles = async (fileIDs) => {
  try {
    const result = await storageManager.deleteFiles(fileIDs)
    console.log('🗑️ 文件删除完成:', result)
    return result
  } catch (error) {
    console.error('❌ 文件删除失败:', error)
    throw error
  }
}

/**
 * 小程序端使用示例
 */
const miniProgramExamples = {
  // 选择并上传图片
  selectAndUploadImage: async function(module, category, userId) {
    try {
      // 选择图片
      const chooseResult = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      
      const tempFilePath = chooseResult.tempFilePaths[0]
      
      // 上传到云存储
      const uploadResult = await storageManager.uploadFile({
        module,
        category,
        filePath: tempFilePath,
        userId
      })
      
      console.log('✅ 图片上传成功:', uploadResult.fileID)
      return uploadResult
      
    } catch (error) {
      wx.showToast({
        title: '上传失败',
        icon: 'error'
      })
      console.error('❌ 图片上传失败:', error)
    }
  },
  
  // 选择并上传文件
  selectAndUploadFile: async function(module, category) {
    try {
      // 选择文件
      const chooseResult = await wx.chooseMessageFile({
        count: 1,
        type: 'file'
      })
      
      const tempFilePath = chooseResult.tempFiles[0].path
      const filename = chooseResult.tempFiles[0].name
      
      // 上传到云存储
      const uploadResult = await storageManager.uploadFile({
        module,
        category,
        filePath: tempFilePath,
        filename
      })
      
      console.log('✅ 文件上传成功:', uploadResult.fileID)
      return uploadResult
      
    } catch (error) {
      wx.showToast({
        title: '上传失败',
        icon: 'error'
      })
      console.error('❌ 文件上传失败:', error)
    }
  }
}

/**
 * 云函数端使用示例
 */
const cloudFunctionExamples = {
  // 云函数中上传文件
  uploadFromCloudFunction: async function(fileContent, module, category, filename) {
    try {
      // 注意：云函数中需要使用 wx-server-sdk
      const cloud = require('wx-server-sdk')
      cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
      
      const result = await cloud.uploadFile({
        cloudPath: storageManager.generateCloudPath(module, category, filename),
        fileContent: fileContent
      })
      
      console.log('✅ 云函数文件上传成功:', result.fileID)
      return result
      
    } catch (error) {
      console.error('❌ 云函数文件上传失败:', error)
      throw error
    }
  }
}

// 导出示例函数
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    uploadUserAvatar,
    uploadProductionPhoto,
    uploadHealthRecord,
    uploadAIDiagnosisImage,
    uploadMaterialReceipt,
    uploadFinanceInvoice,
    uploadBatchFiles,
    getFileDownloadUrl,
    deleteExpiredFiles,
    miniProgramExamples,
    cloudFunctionExamples
  }
}

// 小程序环境下的全局导出
if (typeof global !== 'undefined') {
  global.storageExamples = {
    uploadUserAvatar,
    uploadProductionPhoto,
    uploadHealthRecord,
    uploadAIDiagnosisImage,
    uploadMaterialReceipt,
    uploadFinanceInvoice,
    uploadBatchFiles,
    getFileDownloadUrl,
    deleteExpiredFiles,
    miniProgramExamples,
    cloudFunctionExamples
  }
}
