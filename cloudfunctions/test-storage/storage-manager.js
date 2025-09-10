/**
 * 云开发存储管理工具
 * 自动创建文件夹结构，统一文件上传管理
 * 
 * 作者：AI Assistant
 * 更新时间：2025-09-10
 */

// 适配不同环境
let cloud
if (typeof wx !== 'undefined' && wx.cloud) {
  // 小程序环境
  cloud = wx.cloud
} else if (typeof require !== 'undefined') {
  // Node.js环境（云函数）
  try {
    cloud = require('wx-server-sdk')
  } catch (e) {
    console.warn('wx-server-sdk not found, some features may not work')
  }
}

class StorageManager {
  constructor() {
    this.folderStructure = {
      // 用户模块
      users: {
        avatars: '用户头像',
        profiles: '个人资料文件',
        certificates: '认证证书',
        documents: '用户相关文档'
      },
      
      // 生产管理模块
      production: {
        batches: '批次相关文件',
        entry: '入栏记录照片',
        exit: '出栏记录照片', 
        reports: '生产报告',
        photos: '生产过程照片'
      },
      
      // 健康管理模块
      health: {
        records: '健康记录照片',
        symptoms: '病症图片',
        treatment: '治疗过程照片',
        vaccines: '疫苗证书',
        reports: '健康报告',
        monitoring: '监测数据文件'
      },
      
      // AI诊断模块
      'ai-diagnosis': {
        input: '用户上传的诊断图片',
        results: 'AI分析结果截图',
        cache: '缓存的诊断数据',
        models: '模型相关文件'
      },
      
      // 物料管理模块
      materials: {
        inventory: '库存照片',
        usage: '使用记录照片',
        receipts: '采购票据',
        manuals: '物料说明书'
      },
      
      // 文档管理模块
      documents: {
        contracts: '合同文件',
        reports: '各类报告',
        manuals: '操作手册',
        templates: '文档模板',
        notices: '通知公告'
      },
      
      // 财务管理模块（敏感）
      finance: {
        invoices: '发票扫描件',
        receipts: '收据',
        statements: '财务报表',
        contracts: '财务合同',
        audit: '审计文件'
      },
      
      // 系统管理模块
      system: {
        configs: '配置文件',
        logs: '系统日志',
        backups: '备份文件',
        temp: '临时文件',
        exports: '导出文件'
      }
    }
  }

  /**
   * 生成标准的云存储路径
   * @param {string} module - 业务模块 (users, production, health, etc.)
   * @param {string} category - 文件分类 (avatars, reports, etc.)
   * @param {string} filename - 文件名
   * @param {string} userId - 用户ID（可选，用于用户相关文件）
   * @returns {string} 标准化的cloudPath
   */
  generateCloudPath(module, category, filename, userId = '') {
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substr(2, 6)
    
    // 确保文件名的唯一性
    const uniqueFilename = `${timestamp}-${randomSuffix}-${filename}`
    
    // 构建路径
    let cloudPath = `${module}/${category}/${uniqueFilename}`
    
    // 如果是用户相关文件，添加用户ID目录
    if (userId && (module === 'users' || module === 'health')) {
      cloudPath = `${module}/${category}/${userId}/${uniqueFilename}`
    }
    
    return cloudPath
  }

  /**
   * 上传文件到云存储
   * @param {Object} options - 上传配置
   * @param {string} options.module - 业务模块
   * @param {string} options.category - 文件分类
   * @param {string} options.filePath - 本地文件路径
   * @param {string} options.filename - 文件名（可选）
   * @param {string} options.userId - 用户ID（可选）
   * @param {Function} options.onProgress - 上传进度回调（可选）
   * @returns {Promise} 上传结果
   */
  async uploadFile(options) {
    const {
      module,
      category,
      filePath,
      filename,
      userId,
      onProgress
    } = options

    // 验证模块和分类是否存在
    if (!this.folderStructure[module]) {
      throw new Error(`不支持的业务模块: ${module}`)
    }
    
    if (!this.folderStructure[module][category]) {
      throw new Error(`模块 ${module} 不支持的文件分类: ${category}`)
    }

    // 生成文件名（如果未提供）
    const finalFilename = filename || this._extractFilename(filePath)
    
    // 生成云存储路径
    const cloudPath = this.generateCloudPath(module, category, finalFilename, userId)
    
    console.log(`📂 自动创建存储路径: ${cloudPath}`)

    try {
      // 执行上传
      const result = await cloud.uploadFile({
        cloudPath,
        filePath,
        ...(onProgress && { onProgress })
      })

      console.log('✅ 文件上传成功:', {
        cloudPath,
        fileID: result.fileID,
        module,
        category
      })

      return {
        success: true,
        fileID: result.fileID,
        cloudPath,
        module,
        category,
        originalResult: result
      }
    } catch (error) {
      console.error('❌ 文件上传失败:', error)
      throw error
    }
  }

  /**
   * 批量上传文件
   * @param {Array} files - 文件列表
   * @returns {Promise} 批量上传结果
   */
  async uploadBatch(files) {
    const results = []
    const errors = []

    for (let i = 0; i < files.length; i++) {
      try {
        const result = await this.uploadFile(files[i])
        results.push(result)
        console.log(`📁 批量上传进度: ${i + 1}/${files.length}`)
      } catch (error) {
        errors.push({
          index: i,
          file: files[i],
          error: error.message
        })
      }
    }

    return {
      success: errors.length === 0,
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
   * 获取文件的下载URL
   * @param {string} fileID - 文件ID
   * @returns {Promise} 下载URL
   */
  async getFileUrl(fileID) {
    try {
      const result = await cloud.getTempFileURL({
        fileList: [fileID]
      })
      
      if (result.fileList && result.fileList[0]) {
        return result.fileList[0].tempFileURL
      }
      
      throw new Error('获取文件URL失败')
    } catch (error) {
      console.error('❌ 获取文件URL失败:', error)
      throw error
    }
  }

  /**
   * 删除文件
   * @param {string|Array} fileIDs - 文件ID或文件ID数组
   * @returns {Promise} 删除结果
   */
  async deleteFiles(fileIDs) {
    const fileList = Array.isArray(fileIDs) ? fileIDs : [fileIDs]
    
    try {
      const result = await cloud.deleteFile({
        fileList
      })
      
      console.log('🗑️ 文件删除结果:', result)
      return result
    } catch (error) {
      console.error('❌ 文件删除失败:', error)
      throw error
    }
  }

  /**
   * 获取存储结构信息
   * @returns {Object} 存储结构
   */
  getStorageStructure() {
    return this.folderStructure
  }

  /**
   * 私有方法：从文件路径提取文件名
   * @private
   */
  _extractFilename(filePath) {
    const parts = filePath.split('/')
    return parts[parts.length - 1] || `file-${Date.now()}`
  }
}

// 创建单例实例
const storageManager = new StorageManager()

// 导出
if (typeof module !== 'undefined' && module.exports) {
  // Node.js 环境（云函数）
  module.exports = {
    StorageManager,
    storageManager
  }
} else {
  // 小程序环境
  global.StorageManager = StorageManager
  global.storageManager = storageManager
}
