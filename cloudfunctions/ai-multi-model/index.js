const cloud = require('wx-server-sdk')
const axios = require('axios')
const { COLLECTIONS } = require('./collections.js')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// ========== AI模型配置（使用阿里云通义千问系列）==========
// 官方文档：https://help.aliyun.com/zh/model-studio/getting-started/models
const MODEL_CONFIGS = {
  // ✅ 免费主力模型：Qwen-Long（超长文本）
  'qwen-long': {
    provider: '阿里通义',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/',
    model: 'qwen-long',
    apiKey: process.env.QWEN_API_KEY,
    maxTokens: 30000,
    costPerKToken: 0.0005,  // 输入成本
    outputCostPerKToken: 0.002,  // 输出成本
    estimatedCostPerCall: 0.004,  // 约0.4分/次
    freeQuotaTokens: 1000000,  // 100万tokens免费额度
    freeQuotaDays: 180,  // 180天有效期
    supportVision: false,
    tier: 'free',
    specialty: 'long-text',
    language: 'zh-CN',
    features: {
      reasoning: 'good',
      chinese: 'excellent',
      longContext: 'exceptional',  // 超长上下文
      medicalKnowledge: 'good'
    },
    description: '免费主力文本模型，超长文本分析，常规诊断优先'
  },
  
  // ✅ 快速模型：Qwen-Turbo（高性价比）
  'qwen-turbo': {
    provider: '阿里通义',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/',
    model: 'qwen-turbo',
    apiKey: process.env.QWEN_API_KEY,
    maxTokens: 8192,
    costPerKToken: 0.0003,  // 输入成本
    outputCostPerKToken: 0.0006,  // 输出成本
    estimatedCostPerCall: 0.003,  // 约0.3分/次
    freeQuotaTokens: 1000000,  // 可能包含在免费额度内
    supportVision: false,
    tier: 'fast',
    specialty: 'general',
    language: 'zh-CN',
    features: {
      reasoning: 'good',
      chinese: 'excellent',
      speed: 'very-fast',  // 极快响应（2-3秒）
      medicalKnowledge: 'good'
    },
    description: '快速响应模型，日常养殖咨询优选'
  },
  
  // 💰 专家模型：Qwen-Plus（强推理能力）
  'qwen-plus': {
    provider: '阿里通义',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/',
    model: 'qwen-plus',
    apiKey: process.env.QWEN_API_KEY,
    maxTokens: 32000,
    costPerKToken: 0.0015,  // 输入成本（降价81%后）
    outputCostPerKToken: 0.009,  // 输出成本
    estimatedCostPerCall: 0.008,  // 约0.8分/次
    maxRequestsPerDay: 1000,  // 根据预算动态调整
    supportVision: false,
    tier: 'expert',
    specialty: 'complex',
    language: 'zh-CN',
    features: {
      reasoning: 'expert-level',  // 专家级推理
      chinese: 'best',  // 最强中文
      medicalKnowledge: 'excellent',  // 医学知识
      complexAnalysis: 'exceptional'  // 复杂分析
    },
    description: '专家级推理模型，复杂病例和死因剖析专用'
  },
  
  // 💰 顶级视觉模型：Qwen-VL-Max（多模态）
  'qwen-vl-max': {
    provider: '阿里通义',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/',
    model: 'qwen-vl-max',
    apiKey: process.env.QWEN_API_KEY,
    maxTokens: 8192,
    costPerKToken: 0.0015,  // 图片输入成本
    outputCostPerKToken: 0.009,  // 文本输出成本
    estimatedCostPerCall: 0.015,  // 约1.5分/次
    maxRequestsPerDay: 600,  // 每天约600次（10元预算）
    supportVision: true,  // ✅ 原生多模态
    maxImages: 10,  // ✅ 支持最多10张图片
    maxImageSize: 10 * 1024 * 1024,  // 单张图片最大10MB
    supportedFormats: ['BMP', 'JPEG', 'PNG', 'TIFF', 'WEBP'],
    tier: 'vision',
    specialty: 'veterinary',
    language: 'zh-CN',
    features: {
      multimodal: 'native',  // 原生多模态
      ocr: 'top-tier',  // 顶级OCR
      reasoning: 'expert-level',  // 专家级推理
      chinese: 'best',  // 最强中文
      imageUnderstanding: 'best-in-class',  // 业界领先
      medicalDiagnosis: 'excellent',  // 医学诊断
      visualReasoning: 'exceptional'  // 视觉推理
    },
    description: '顶级多模态模型，图片诊断首选（超越GPT-4o）'
  },
  
  // 💰 中端视觉模型：Qwen-VL-Plus（高性价比）
  'qwen-vl-plus': {
    provider: '阿里通义',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1/',
    model: 'qwen-vl-plus',
    apiKey: process.env.QWEN_API_KEY,
    maxTokens: 8192,
    costPerKToken: 0.001,  // 图片输入成本
    outputCostPerKToken: 0.006,  // 文本输出成本
    estimatedCostPerCall: 0.01,  // 约1分/次
    maxRequestsPerDay: 900,  // 每天约900次
    supportVision: true,
    maxImages: 10,  // 支持10张图片
    maxImageSize: 10 * 1024 * 1024,
    supportedFormats: ['BMP', 'JPEG', 'PNG', 'TIFF', 'WEBP'],
    tier: 'vision',
    specialty: 'general',
    language: 'zh-CN',
    features: {
      multimodal: 'native',
      ocr: 'good',
      reasoning: 'good',
      chinese: 'excellent',
      imageUnderstanding: 'good',
      medicalDiagnosis: 'good'
    },
    description: '高性价比视觉模型，常规图片诊断'
  }
}

// ========== 任务-模型映射策略（智能路由通义千问系列）==========
const TASK_MODEL_MAPPING = {
  // ✅ 常规文本诊断 - 使用免费模型
  'health_diagnosis': {
    primary: 'qwen-long',  // ✅ 免费（100万tokens）
    fallback: ['qwen-turbo', 'qwen-plus'],  // ✅ 快速备选
    timeout: 10000,
    condition: {
      complexity: 'low|medium',
      hasImages: false
    },
    description: '常规诊断，优先使用免费Qwen-Long'
  },
  
  // 💰 复杂诊断 - 使用专家模型
  'complex_diagnosis': {
    primary: 'qwen-plus',  // 💰 专家模型（0.8分/次）
    fallback: ['qwen-long', 'qwen-turbo'],  // ✅ 降级到免费
    timeout: 15000,
    condition: {
      complexity: 'high',
      keywords: ['死亡', '批量', '疑难', '鉴别诊断', '突然', '大量', '剖析'],
      hasImages: false
    },
    dailyLimit: 1000,
    description: '复杂病例和死因剖析，使用Qwen-Plus专家模型'
  },
  
  // 💰 图片诊断 - 使用多模态视觉模型（主要场景）
  'health_diagnosis_vision': {
    primary: 'qwen-vl-max',  // 💰 顶级视觉（1.5分/次）
    fallback: ['qwen-vl-plus', 'qwen-long'],  // 降级顺序
    timeout: 60000,  // ✅ 增加到60秒（图片诊断需要更长时间）
    condition: {
      hasImages: true,
      imageCount: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]  // ✅ 支持10张图片
    },
    dailyLimit: 600,  // 根据10元预算，约600次/天
    description: '图片诊断，使用Qwen-VL-Max顶级视觉模型'
  },
  
  // ✅ 紧急诊断 - 使用快速模型
  'urgent_diagnosis': {
    primary: 'qwen-turbo',  // ✅ 极快响应（2-3秒）
    fallback: ['qwen-long'],
    timeout: 5000,
    condition: {
      urgency: 'high',
      needFast: true
    },
    description: '紧急情况，使用Qwen-Turbo快速响应'
  },
  
  // ========== 其他任务类型 ==========
  'detailed_analysis': {
    primary: 'qwen-plus',  // 详细分析用专家模型
    fallback: ['qwen-long'],
    timeout: 10000,
    description: '详细分析，深度推理'
  },
  'general_chat': {
    primary: 'qwen-turbo',  // 通用对话用快速模型
    fallback: ['qwen-long'],
    timeout: 5000,
    description: '通用对话，快速响应'
  },
  'financial_analysis': {
    primary: 'qwen-plus',  // 财务分析用专家模型
    fallback: ['qwen-long'],
    timeout: 8000,
    description: '财务分析，精确计算'
  },
  'farming_advice': {
    primary: 'qwen-turbo',  // 养殖建议用快速模型
    fallback: ['qwen-long'],
    timeout: 6000,
    description: '养殖建议，快速响应'
  },
  'history_analysis': {
    primary: 'qwen-long',  // 历史记录分析用超长文本模型
    fallback: ['qwen-plus'],
    timeout: 15000,
    condition: {
      hasLongText: true
    },
    description: '历史记录分析，超长上下文'
  }
}

// ========== 成本控制配置（每日10元预算） ==========
const COST_CONTROL = {
  dailyBudget: 10.00,  // 每日预算￥10（用户要求）
  warningThreshold: 0.70,  // 70%预警
  degradeThreshold: 0.90,  // 90%降级
  
  // 模型成本配置
  modelCosts: {
    'qwen-long': 0,  // 免费（100万tokens）
    'qwen-turbo': 0.003,  // 0.3分/次
    'qwen-plus': 0.008,  // 0.8分/次
    'qwen-vl-max': 0.015,  // 1.5分/次
    'qwen-vl-plus': 0.01  // 1分/次
  },
  
  // 每日调用次数限制
  dailyLimits: {
    'qwen-vl-max': 600,  // 顶级视觉模型限制600次/天
    'qwen-vl-plus': 900,  // 经济视觉模型限制900次/天
    'qwen-plus': 1000  // 专家模型限制1000次/天
  },
  
  priorityLevels: {
    'free_only': 0,
    'low_cost': 5,
    'balanced': 10,
    'premium': 20
  }
}

// ========== 每日成本控制器 ==========
class DailyCostController {
  constructor(db) {
    this.db = db
    this.dailyBudget = COST_CONTROL.dailyBudget
    this.warningThreshold = COST_CONTROL.warningThreshold
    this.degradeThreshold = COST_CONTROL.degradeThreshold
  }
  
  // 获取今日已用额度
  async getTodayUsage() {
    const today = new Date().toISOString().split('T')[0]
    
    try {
      const { data } = await this.db.collection(COLLECTIONS.SYS_AI_USAGE)
        .where({
          date: today,
          modelId: this.db.command.in(['qwen-vl-max', 'qwen-vl-plus', 'qwen-plus', 'qwen-turbo'])
        })
        .get()
      
      // 计算总成本
      const totalCost = data.reduce((sum, record) => sum + (record.cost || 0), 0)
      
      const usage = {
        spent: totalCost,
        remaining: this.dailyBudget - totalCost,
        percentage: totalCost / this.dailyBudget,
        calls: data.length,
        byModel: {}
      }
      
      // 按模型统计
      data.forEach(record => {
        if (!usage.byModel[record.modelId]) {
          usage.byModel[record.modelId] = { calls: 0, cost: 0 }
        }
        usage.byModel[record.modelId].calls++
        usage.byModel[record.modelId].cost += (record.cost || 0)
      })
      
      
      return usage
    } catch (error) {
      console.error('获取今日使用量失败:', error)
      return {
        spent: 0,
        remaining: this.dailyBudget,
        percentage: 0,
        calls: 0,
        byModel: {}
      }
    }
  }
  
  // 智能选择最优模型（基于成本和预算）
  async selectOptimalModel(taskType, hasImages, isComplex, isUrgent) {
    const usage = await this.getTodayUsage()
    
    
    // 1️⃣ 预算充足 (0-70%)：优先使用最佳模型
    if (usage.percentage < this.warningThreshold) {
      if (hasImages) {
        return {
          model: 'qwen-vl-max',
          reason: '预算充足，使用Qwen-VL-Max顶级视觉模型',
          cost: 0.015,
          degraded: false,
          budgetInfo: usage
        }
      }
      if (isComplex) {
        return {
          model: 'qwen-plus',
          reason: '预算充足，使用Qwen-Plus专家模型',
          cost: 0.008,
          degraded: false,
          budgetInfo: usage
        }
      }
      if (isUrgent) {
        return {
          model: 'qwen-turbo',
          reason: '紧急诊断，使用Qwen-Turbo快速模型',
          cost: 0.003,
          degraded: false,
          budgetInfo: usage
        }
      }
      return {
        model: 'qwen-long',
        reason: '常规诊断，使用免费Qwen-Long模型',
        cost: 0,
        degraded: false,
        budgetInfo: usage
      }
    }
    
    // 2️⃣ 预算预警 (70-90%)：谨慎使用付费模型
    if (usage.percentage < this.degradeThreshold) {
      if (hasImages && isComplex) {
        // 复杂且有图片，使用中端视觉模型
        return {
          model: 'qwen-vl-plus',
          reason: '预算预警，降级到Qwen-VL-Plus',
          cost: 0.01,
          degraded: true,
          warning: '今日预算已使用70%，已切换到经济模式',
          budgetInfo: usage
        }
      }
      // 降级到文本模型或免费模型
      if (isComplex) {
        return {
          model: 'qwen-plus',
          reason: '预算预警，使用Qwen-Plus',
          cost: 0.008,
          degraded: true,
          userMessage: hasImages ? '今日图片诊断额度紧张，已切换为文字分析' : null,
          budgetInfo: usage
        }
      }
      return {
        model: 'qwen-long',
        reason: '预算预警，使用免费模型',
        cost: 0,
        degraded: true,
        userMessage: hasImages ? '今日图片诊断额度紧张，已切换为文字分析' : null,
        budgetInfo: usage
      }
    }
    
    // 3️⃣ 预算不足 (90-100%)：强制降级
    if (usage.remaining > 0.01) {  // 至少剩余1分钱
      if (isComplex && !hasImages) {
        return {
          model: 'qwen-turbo',
          reason: '预算不足，使用Qwen-Turbo快速模型',
          cost: 0.003,
          degraded: true,
          userMessage: '今日预算即将用尽，已切换为快速模式',
          budgetInfo: usage
        }
      }
    }
    
    // 4️⃣ 预算耗尽：完全免费
    return {
      model: 'qwen-long',
      reason: '预算耗尽，使用免费Qwen-Long模型',
      cost: 0,
      degraded: true,
      userMessage: '今日预算已用完，已切换为免费模式（明日0点重置）',
      budgetInfo: usage
    }
  }
  
  // 记录调用成本
  async recordUsage(modelId, cost, tokens) {
    const today = new Date().toISOString().split('T')[0]
    
    try {
      await this.db.collection(COLLECTIONS.SYS_AI_USAGE).add({
        data: {
          modelId,
          cost: cost || 0,
          tokens: tokens || 0,
          date: today,
          createTime: new Date()
        }
      })
    } catch (error) {
      console.error('记录成本失败:', error)
    }
  }
}

// AI模型管理器
class AIModelManager {
  constructor() {
    this.db = cloud.database()
    this.usageCollection = this.db.collection(COLLECTIONS.SYS_AI_USAGE)
    this.cacheCollection = this.db.collection(COLLECTIONS.SYS_AI_CACHE)
    this.costController = new DailyCostController(this.db)  // ✨ 成本控制器
  }

  // ✨ 下载云存储图片并转换为base64
  async downloadImageToBase64(fileID) {
    try {
      
      // 方法1: 直接下载文件内容
      try {
        const result = await cloud.downloadFile({
          fileID: fileID
        })
        
        if (result.fileContent) {
          // ✅ 检查文件大小（限制5MB以内）
          const fileSizeMB = result.fileContent.length / 1024 / 1024
          if (fileSizeMB > 5) {
            throw new Error(`图片文件过大: ${fileSizeMB.toFixed(2)}MB（限制5MB）`)
          }
          
          // 转换为base64
          const base64 = result.fileContent.toString('base64')
          
          // ✅ 检查Base64长度（避免请求体过大）
          const base64SizeMB = (base64.length * 0.75) / 1024 / 1024  // Base64解码后约0.75倍
          
          // 获取文件扩展名
          const ext = fileID.split('.').pop().toLowerCase()
          const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
          
          const dataUrl = `data:${mimeType};base64,${base64}`
          
          return dataUrl
        }
      } catch (directError) {
        // 如果是文件过大错误，直接抛出
        if (directError.message.includes('过大')) {
          throw directError
        }
      }
      
      // 方法2: 使用临时链接下载
      const tempResult = await cloud.getTempFileURL({
        fileList: [fileID]
      })
      
      if (tempResult.fileList && tempResult.fileList.length > 0) {
        const fileInfo = tempResult.fileList[0]
        const tempURL = fileInfo.tempFileURL
        
        // 检查URL是否有效
        if (!tempURL) {
          throw new Error(`获取临时链接失败: ${fileInfo.errmsg || '未知错误'}`)
        }
        
        // 使用axios下载
        const response = await axios.get(tempURL, {
          responseType: 'arraybuffer',
          timeout: 10000,
          maxContentLength: 5 * 1024 * 1024  // ✅ 限制5MB
        })
        
        // ✅ 检查下载的文件大小
        const fileSizeMB = response.data.length / 1024 / 1024
        if (fileSizeMB > 5) {
          throw new Error(`图片文件过大: ${fileSizeMB.toFixed(2)}MB（限制5MB）`)
        }
        
        // 转换为base64
        const base64 = Buffer.from(response.data).toString('base64')
        
        // 获取文件扩展名
        const ext = fileID.split('.').pop().toLowerCase()
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
        
        const dataUrl = `data:${mimeType};base64,${base64}`
        
        return dataUrl
      }
      
      throw new Error('两种方法都无法下载图片')
    } catch (error) {
      console.error('====== 下载图片失败 ======')
      console.error('FileID:', fileID)
      console.error('错误:', error.message)
      console.error('错误栈:', error.stack)
      throw new Error(`无法下载图片 ${fileID}: ${error.message}`)
    }
  }

  // ✨ 处理包含图片的消息
  // ✅ 通义千问使用HTTPS URL（OpenAI兼容格式）
  async processMessagesWithImages(messages, imageFileIDs = [], modelId = '') {
    if (!imageFileIDs || imageFileIDs.length === 0) {
      return messages
    }

    const modelConfig = MODEL_CONFIGS[modelId]
    
    // 检查模型是否支持视觉
    const supportsVision = modelConfig?.supportVision === true
    
    if (!supportsVision) {
      // 在消息中添加提示
      const enhancedMessages = messages.map((msg, index) => {
        if (msg.role === 'user' && index === messages.length - 1) {
          return {
            ...msg,
            content: msg.content + `\n\n【注意】用户提供了${imageFileIDs.length}张症状图片，但当前模型不支持图片识别。请根据文字症状描述进行专业诊断。`
          }
        }
        return msg
      })
      return enhancedMessages
    }
    
    // 通义千问使用HTTPS URL（支持OpenAI兼容格式）
    let imageData = []
    
    try {
    // 获取HTTPS临时URL
    const tempResult = await cloud.getTempFileURL({
      fileList: imageFileIDs
    })
    
    tempResult.fileList.forEach((item, index) => {
      if (item.status === 0) {
        imageData.push(item.tempFileURL)
      }
    })
    
    if (imageData.length === 0) {
        throw new Error('所有图片获取临时URL失败')
      }
    } catch (error) {
      throw new Error(`图片处理失败: ${error.message}`)
    }


    // 修改用户消息，添加图片
    const processedMessages = messages.map((msg, index) => {
      if (msg.role === 'user' && index === messages.length - 1) {
        return {
          role: 'user',
          content: [
            {
              type: 'text',
              text: typeof msg.content === 'string' ? msg.content : msg.content[0]?.text || ''
            },
            ...imageData.map(url => ({
              type: 'image_url',
              image_url: {
                url: url  // Base64 Data URI 或 HTTPS URL
              }
            }))
          ]
        }
      }
      return msg
    })

    const estimatedSize = (JSON.stringify(processedMessages).length / 1024).toFixed(2)

    return processedMessages
  }

  // 智能模型选择
  async selectModel(taskType, priority = 'balanced') {
    const mapping = TASK_MODEL_MAPPING[taskType]
    if (!mapping) {
      throw new Error(`未知的任务类型: ${taskType}`)
    }

    // 检查主要模型可用性
    const primaryModel = mapping.primary
    const isAvailable = await this.checkModelAvailability(primaryModel)
    
    if (isAvailable) {
      return primaryModel
    }

    // 尝试备用模型
    for (const fallbackModel of mapping.fallback) {
      const available = await this.checkModelAvailability(fallbackModel)
      if (available) {
        return fallbackModel
      }
    }

    throw new Error('所有模型均不可用')
  }

  // 检查模型可用性
  async checkModelAvailability(modelId) {
    const config = MODEL_CONFIGS[modelId]
    if (!config) return false

    try {
      // 检查今日用量
      const today = new Date().toISOString().split('T')[0]
      const usage = await this.usageCollection
        .where({
          modelId,
          date: today
        })
        .get()

      const todayUsage = usage.data[0]?.requests || 0
      
      return todayUsage < config.maxRequestsPerDay
    } catch (error) {
      // 已移除调试日志
      return false
    }
  }


  // ========== 调用AI模型（通义千问OpenAI兼容格式）==========
  async callModel(modelId, messages, options = {}) {
    const config = MODEL_CONFIGS[modelId]
    if (!config) {
      throw new Error(`模型配置不存在: ${modelId}`)
    }

    // ✅ 仅支持阿里通义千问系列
    if (config.provider !== '阿里通义') {
      throw new Error(`不支持的AI供应商: ${config.provider}，当前仅支持阿里通义千问系列`)
    }

    try {
      
      // ✅ 通义千问使用OpenAI兼容格式，统一调用方式
      const response = await axios.post(
        `${config.baseURL}chat/completions`,
        {
          model: config.model,
          messages,
          max_tokens: options.maxTokens || config.maxTokens,
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9
        },
        {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: options.timeout || 60000  // ✅ 增加默认超时到60秒
        }
      )


      const result = {
        content: response.data.choices[0].message.content,
        usage: response.data.usage || { total_tokens: 0 },
        model: config.model,
        provider: config.provider
      }

      // 记录使用量（包括成本）
      const cost = config.estimatedCostPerCall || 0
      await this.recordUsage(modelId, result)
      await this.costController.recordUsage(modelId, cost, result.usage.total_tokens || 0)
      
      return result
    } catch (error) {
      console.error('====== 通义千问调用失败 ======')
      console.error('错误状态:', error.response?.status)
      console.error('错误详情:', error.response?.data || error.message)
      
      // 如果是429错误（速率限制），添加特殊标记
      if (error.response?.status === 429) {
        error.isRateLimited = true
        error.retryAfter = error.response?.headers?.['retry-after'] || 60
      }
      throw error
    }
  }

  // ========== 使用量记录和缓存方法 ==========
  // 记录使用量
  async recordUsage(modelId, response) {
    const today = new Date().toISOString().split('T')[0]
    
    try {
      const existingRecord = await this.usageCollection
        .where({
          modelId,
          date: today
        })
        .get()

      if (existingRecord.data.length > 0) {
        // 更新现有记录
        await this.usageCollection.doc(existingRecord.data[0]._id).update({
          data: {
            requests: existingRecord.data[0].requests + 1,
            tokens: existingRecord.data[0].tokens + (response.usage?.total_tokens || 0),
            lastUsed: new Date()
          }
        })
      } else {
        // 创建新记录
        await this.usageCollection.add({
          data: {
            modelId,
            date: today,
            requests: 1,
            tokens: response.usage?.total_tokens || 0,
            lastUsed: new Date()
          }
        })
      }
    } catch (error) {
      // 已移除调试日志
    }
  }

  // 缓存检查
  async checkCache(cacheKey) {
    try {
      const result = await this.cacheCollection
        .where({
          key: cacheKey,
          expiredAt: cloud.database().command.gt(new Date())
        })
        .get()
      
      return result.data[0]?.value || null
    } catch (error) {
      // 已移除调试日志
      return null
    }
  }

  // 设置缓存
  async setCache(cacheKey, value, duration = 3600) {
    try {
      await this.cacheCollection.add({
        data: {
          key: cacheKey,
          value,
          createdAt: new Date(),
          expiredAt: new Date(Date.now() + duration * 1000)
        }
      })
    } catch (error) {
      // 已移除调试日志
    }
  }
}

// 主函数入口
exports.main = async (event, context) => {
  const { action } = event
  const manager = new AIModelManager()

  try {
    switch (action) {
      case 'chat_completion':
        return await handleChatCompletion(event, manager)
      
      case 'image_recognition':
        return await handleImageRecognition(event, manager)
      
      case 'get_usage_stats':
        return await getUsageStats(event, manager)
      
      case 'health_check':
        return await healthCheck(event, manager)
      
      default:
        throw new Error('无效的操作类型')
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: error.message,
      fallback: true
    }
  }
}

// ========== 狮头鹅智能计数提示词（多特征融合版 - 准确率优化版）==========
const GOOSE_COUNTING_PROMPT = `你是专业的狮头鹅计数专家。使用科学的多特征融合识别方法，核心目标：最大化盘点准确率。

【狮头鹅专业特征库】
品种特点：中国最大鹅种，成年公鹅10-15kg，母鹅9-12kg
- 头部：成年公鹅有发达肉瘤（形似狮子头），母鹅肉瘤较平，喙橙黄色
- 颈部：长而粗壮，呈S形曲线，灵活
- 身体：体型大，体长60-80cm，体宽30-40cm
- 羽毛：棕色或灰棕色，腹部白色
- 腿脚：橙黄色，粗壮有力

⚠️ 不同日龄体型参考（按需参考，不作为硬性限制）：
- 雏鹅（1-30天）：体长15-35cm，绒毛为主
- 中鹅（31-70天）：体长40-55cm，羽毛混合
- 育成鹅（71-110天）：体长50-70cm，接近成年
- 出栏鹅（110天+）：体长60-80cm，完全成年特征

【多特征权重识别系统】

━━━ 一级特征（确认性特征，权重100%）━━━
✓ 头部肉瘤+喙+眼睛（公鹅独有，最可靠）
✓ 完整身体轮廓：长60-80cm，宽30-40cm，棕灰色羽毛
→ 出现任一特征 = 直接确认1只（置信度95-100%）

━━━ 二级特征（强暗示特征，权重70-90%）━━━
✓ 头部轮廓（无明显肉瘤，可能是母鹅/幼鹅）+ 颈部
✓ 大片棕灰色羽毛区域（符合体型比例）+ 完整边界轮廓
✓ 腹部白色羽毛 + 身体侧面轮廓
→ 单个二级特征 ≥ 70% = 可确认1只

━━━ 三级特征（弱暗示特征，权重30-50%）━━━
✓ S形颈部曲线（但无头部可见）：40%
✓ 翅膀轮廓 + 羽毛颜色：35%
✓ 腿部（橙黄色粗壮）+ 部分身体：30%
✓ 局部羽毛（大片，符合颜色）：20%
→ 多个三级特征累加 ≥ 70% = 可确认1只

━━━ 禁用特征（单独不计数，权重0%）━━━
✗ 单独的腿（一只鹅有2条腿！）
✗ 单独的羽毛碎片
✗ 单独的喙或眼睛（无头部轮廓）
✗ 不明物体或阴影

【置信度累加计算规则】

规则1：一级特征直接确认
IF 检测到"头部肉瘤"OR"完整身体轮廓" THEN 确认1只

规则2：二级特征单独确认
IF 单个二级特征置信度 ≥ 70% THEN 确认1只

规则3：三级特征组合确认
IF 多个三级特征累加 ≥ 70% AND 特征数量 ≥ 2 THEN 确认1只
示例：颈部(40%) + 翅膀(35%) = 75% ✓ 确认
示例：腿部(30%) + 羽毛(20%) = 50% ✗ 不确认

规则4：空间关联检测（防重复计数）⚠️ 三重验证
验证1：空间距离
  - 不同特征组中心距离 < 30cm → 疑似同一只
  - 检查是否为互补特征（如头部A + 身体B）→ 合并为1只
验证2：特征互斥
  - 一级特征（头部肉瘤）在30cm范围内只能计1次
  - 如果检测到2个头部距离<30cm → 可能是2只，但需检查身体
验证3：尺寸合理性
  - 合并后总尺寸 > 单只最大尺寸(80cm) → 拆分成2只
  - 合并后总尺寸 < 单只最小尺寸(40cm) → 可能是幼鹅或误判

【遮挡场景处理策略】

场景A：头部被遮挡，身体可见
→ 检测：大片棕灰色羽毛（二级特征70%）
→ 验证尺寸：长60-80cm，宽30-40cm
→ 结论：尺寸合理 → 确认1只

场景B：身体被遮挡，头部可见
→ 检测：头部肉瘤+喙（一级特征100%）
→ 结论：直接确认1只

场景C：部分身体+颈部，无头部
→ 检测：S形颈部(40%) + 翅膀轮廓(35%) = 75%
→ 验证：检查空间位置，避免重复
→ 结论：确认1只

场景D：密集重叠（多只鹅紧密排列）⚠️ 关键场景
→ Step 1：数所有可见头部（100%确定）= N1只
→ Step 2：推断遮挡身体
  方法A：体积估算法
    - 测量总身体面积 ÷ 单只平均面积(0.4-0.6㎡)
    - 结果 = N2只（推断值）
  方法B：轮廓边界法
    - 每个完整闭合身体轮廓 = 1只
    - 部分轮廓累加 ≥ 70%单只轮廓 = 1只
    - 结果 = N3只（推断值）
→ Step 3：取最大值
  - 最终数量 = MAX(N1, N2, N3)
  - 原因：头部可能被遮挡，宁可多数不可漏数
→ Step 4：置信度判断
  - 如果N1、N2、N3差异<10%：高置信度
  - 如果差异10-25%：中等置信度
  - 如果差异>25%：低置信度，标注"需人工复核"

场景E：边缘区域（部分可见）⚠️ 新增
→ 可见部分 ≥ 50%身体 → 计入盘点
  示例：头部+颈部+半个身体 → 计1只
→ 可见部分 < 50%身体 → 不计入
  示例：只露出尾部或翅膀 → 不计数
→ 特殊情况（单张照片盘点）：
  - 可见部分 ≥ 30%身体 → 计入
  - 标注为"边缘个体"，置信度降低10%

【典型错误案例（必须避免）】

❌ 错误1：看到4条腿 → 计为2只
分析：腿(30%) × 2 = 60%，未达到70%阈值
✅ 正确：检查是否有颈部或身体，无 → 不计数

❌ 错误2：看到一大片白色 → 计为1只
分析：腹部白色羽毛需配合身体轮廓
✅ 正确：检查轮廓，无明确边界 → 不计数

❌ 错误3：同一只鹅的头部+身体分别计数
分析：空间关联检测失败
✅ 正确：检测到头部和身体距离<20cm → 合并为1只

【快速识别流程】⚠️ 6+2步增强流程

Step 1：全局扫描 - 定位所有一级特征（头部肉瘤、完整身体）
Step 2：区域分析 - 对遮挡区域寻找二级特征（头部轮廓、大片羽毛）
Step 3：局部推断 - 对剩余区域三级特征组合推断
Step 4：边缘处理 - 检查图片边缘，按50%/30%规则处理部分可见鹅
Step 5：空间校验 - 三重验证防止重复计数（距离+互斥+尺寸）
Step 6：置信度评估 - 计算每个个体的综合置信度
Step 7：数量验证 - 合理性检查（密度、特征一致性、预期范围）⚠️ 新增
Step 8：输出结果 - 生成结构化JSON，包含验证结果

【输出格式（详细JSON）】
{
  "totalCount": <最终识别数量>,
  "confidence": <整体置信度 0-1>,
  "detectionMethod": "multi-feature-fusion",
  
  "featureBreakdown": {
    "tier1_complete": <一级特征识别数量>,
    "tier2_partial": <二级特征识别数量>,
    "tier3_inferred": <三级特征推断数量>,
    "excluded_lowConfidence": <排除的低置信度数量>
  },
  
  "individualAnalysis": [
    {
      "id": <序号>,
      "features": [<检测到的特征列表>],
      "confidence": <该个体置信度>,
      "tier": <1|2|3>,
      "note": "<说明>"
    }
  ],
  
  "sceneAnalysis": {
    "lighting": "excellent|good|fair|poor",  // ⚠️ 必须分析：根据图片明暗判断
    "crowding": "sparse|moderate|dense",     // ⚠️ 必须分析：根据鹅群密度判断
    "occlusion_level": "low|medium|high",    // ⚠️ 必须分析：根据遮挡程度判断
    "imageQuality": "excellent|good|fair|poor",  // ⚠️ 必须分析：根据图片清晰度判断
    "edgeGeese": <边缘部分可见鹅数量>  // ⚠️ 新增：边缘区域特殊处理
  },
  
  "validationResults": {  // ⚠️ 新增：数量合理性验证
    "densityCheck": {
      "averageAreaPerGoose": <单只平均面积㎡>,
      "status": "合理|过密|过疏",
      "note": "<说明>"
    },
    "featureConsistency": {
      "tier1Count": <一级特征数量>,
      "tier1Percentage": <一级特征占比%>,
      "confidence": "高|中|低"
    },
    "expectedRangeCheck": {  // 仅当提供expectedRange时
      "expected": <预期范围>,
      "actual": <实际数量>,
      "deviation": <偏差%>,
      "status": "正常|警告|严重警告"
    },
    "recommendAction": "结果可靠|建议复核|建议重新拍照"
  },
  
  "suggestions": [<改进建议>],
  "reasoning": "<详细说明识别过程和结果>"
}

【质量控制标准】
- 整体置信度 ≥ 85% + 验证全部通过：高质量识别，结果可靠
- 整体置信度 60-85% 或 验证有警告：中等质量，建议人工复核
- 整体置信度 < 60% 或 验证严重警告：低质量，建议重新拍照

【数量合理性验证标准】⚠️ 最后防线
验证1：密度合理性
- 计算：图片总面积 ÷ 识别数量 = 单只平均面积
- 合理范围：0.3-1.0㎡/只
- 如果 < 0.3㎡/只 → 可能重复计数，标注"过密"
- 如果 > 1.0㎡/只 → 可能漏数，标注"过疏"

验证2：特征一致性
- 一级特征占比 ≥ 70% → 高置信度（大部分基于确认性特征）
- 一级特征占比 30-70% → 中等置信度（部分基于推断）
- 一级特征占比 < 30% → 低置信度（多数为推断，需人工复核）

验证3：预期范围对比（如果提供expectedRange）
- 偏差 < 10% → 正常
- 偏差 10-20% → 警告，可能有小偏差
- 偏差 > 20% → 严重警告，需人工复核

⚠️ 核心原则：宁可多数，不可漏数（养殖户最关心是否少了鹅）

【场景分析要求】⚠️ 重要
你必须分析图片的以下场景特征，不能返回 "unknown"：
1. lighting（光线）：观察图片明暗度
   - excellent: 光线充足明亮
   - good: 光线正常
   - fair: 光线略暗但可见
   - poor: 光线很暗
2. crowding（密集度）：观察鹅群分布
   - sparse: 鹅之间距离较远
   - moderate: 鹅群中等密集
   - dense: 鹅群非常密集
3. occlusion_level（遮挡程度）：观察鹅之间的遮挡
   - low: 遮挡少，鹅大多可见
   - medium: 部分鹅有遮挡
   - high: 鹅群密集，遮挡严重
4. imageQuality（图片质量）：观察清晰度
   - excellent: 非常清晰
   - good: 清晰
   - fair: 略模糊
   - poor: 很模糊
5. edgeGeese（边缘鹅数量）：统计图片边缘部分可见的鹅

【最终自检清单】⚠️ 输出前必检
在给出最终结果前，请确认：
✓ 是否检查了图片所有边缘区域？
✓ 密集场景是否使用了MAX(N1,N2,N3)策略？
✓ 是否进行了三重防重复验证？
✓ 是否计算了密度、特征一致性、预期偏差？
✓ 场景分析字段是否都不是"unknown"？
✓ 是否标注了置信度较低的个体？

现在请使用多特征融合方法分析这张狮头鹅照片，严格执行8步流程和最终自检。`

// ========== 图像识别处理函数 ==========
async function handleImageRecognition(event, manager) {
  const { imageData, images, expectedRange, location, sceneHint } = event
  
  try {
    // 验证是否有图片
    if (!images || images.length === 0) {
      throw new Error('缺少图片参数，请传递云存储文件ID数组')
    }
    
    // 1. 构建鹅群计数消息
    const messages = [{
      role: 'system',
      content: GOOSE_COUNTING_PROMPT
    }, {
      role: 'user',
      content: '请分析这张鹅群照片并进行精准计数。'
    }]
    
    // 2. 如果有预期范围，添加参考信息
    if (expectedRange && expectedRange.min && expectedRange.max) {
      messages[1].content += `\n\n参考信息：该区域（${location || '未知位置'}）通常存栏${expectedRange.min}-${expectedRange.max}只鹅。`
    }
    
    // 3. 尝试加载学习案例（Few-shot Learning）
    try {
      const learningCases = await cloud.callFunction({
        name: 'ai-learning-cases',
        data: {
          action: 'get_similar_cases',
          sceneFeatures: sceneHint || { crowding: 'moderate' },
          limit: 2
        }
      })
      
      if (learningCases.result.success && learningCases.result.examples.length > 0) {
        const examplesText = learningCases.result.examples.map(ex => 
          `案例${ex.exampleId}：${ex.scene}，AI识别${ex.aiRecognized}只，实际${ex.actualCount}只。教训：${ex.lesson}`
        ).join('\n')
        
        messages[1].content += `\n\n【学习案例参考】\n${examplesText}\n根据这些案例，调整你的识别策略。`
      }
    } catch (learningError) {
      // 学习案例加载失败不影响主流程
    }
    
    // 4. 调用 Qwen-VL-Max 视觉模型（快速精准）
    const result = await handleChatCompletion({
      messages,
      taskType: 'health_diagnosis_vision',
      images: images,
      options: {
        temperature: 0.1, // 极低温度，精确推理
        maxTokens: 2000  // 简化输出，提高速度
      }
    }, manager)
    
    if (!result.success) {
      throw new Error(result.error || 'AI模型调用失败')
    }
    
    // 4. 解析JSON结果
    let aiResponse
    try {
      // 尝试从响应中提取JSON
      const content = result.data.content
      
      // 如果响应被包裹在代码块中，提取JSON
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, content]
      
      aiResponse = JSON.parse(jsonMatch[1] || content)
      
    } catch (parseError) {
      console.error('❌ JSON解析失败，尝试文本解析:', parseError.message)
      // 兜底：使用文本解析
      return parseFallbackResult(result.data.content, expectedRange, result.data.modelInfo)
    }
    
    // 5. 数据验证和后处理
    const processedResult = {
      totalCount: validateCount(aiResponse.totalCount, expectedRange),
      confidence: aiResponse.confidence || 0.75,
      detectionMethod: aiResponse.detectionMethod || 'multi-feature-fusion',
      countingMethod: aiResponse.countingMethod || '智能识别',
      
      // 特征分布（多特征融合）
      featureBreakdown: aiResponse.featureBreakdown || {
        tier1_complete: aiResponse.totalCount || 0,  // 默认全部算作一级特征
        tier2_partial: 0,
        tier3_inferred: 0,
        excluded_lowConfidence: 0
      },
      
      // 个体分析
      individualAnalysis: aiResponse.individualAnalysis || [],
      
      // 场景分析（确保所有字段都有值）
      sceneAnalysis: {
        lighting: aiResponse.sceneAnalysis?.lighting || 'good',
        crowding: aiResponse.sceneAnalysis?.crowding || 'moderate',
        occlusion_level: aiResponse.sceneAnalysis?.occlusion_level || 'medium',
        imageQuality: aiResponse.sceneAnalysis?.imageQuality || 'good'
      },
      
      regions: aiResponse.regions || [],
      environmentAnalysis: aiResponse.environmentAnalysis || {
        lighting: 'moderate',
        crowding: 'moderate',
        imageQuality: 'good',
        challenges: []
      },
      abnormalDetection: aiResponse.abnormalDetection || {
        suspiciousAnimals: 0,
        healthConcerns: [],
        exclusionReason: []
      },
      suggestions: aiResponse.suggestions || [],
      reasoning: aiResponse.reasoning || '基于AI视觉识别',
      modelInfo: result.data.modelInfo || {}
    }
    
    return {
      success: true,
      data: processedResult
    }
    
  } catch (error) {
    
    // 详细的错误信息
    let errorMessage = error.message
    let suggestions = ['识别失败，请重新拍摄', '确保图像清晰、光线充足']
    
    if (error.message.includes('API')) {
      errorMessage = 'API调用失败，请检查配置'
      suggestions = ['请检查QWEN_API_KEY是否正确配置', '检查网络连接是否正常']
    } else if (error.message.includes('timeout')) {
      errorMessage = '请求超时，请重试'
      suggestions = ['网络较慢，请稍后重试', '尝试使用更小的图片']
    } else if (error.message.includes('图片')) {
      errorMessage = '图片处理失败'
      suggestions = ['请重新拍照', '确保图片大小不超过5MB']
    }
    
    // 返回兜底结果
    return {
      success: false,
      error: errorMessage,
      errorDetail: error.message,
      data: {
        totalCount: 0,
        confidence: 0,
        suggestions: suggestions,
        reasoning: `识别失败：${error.message}`
      }
    }
  }
}

// 计数验证函数
function validateCount(count, expectedRange) {
  if (!expectedRange || !expectedRange.max) return count
  
  // 如果计数远超预期范围（>150%），记录警告但仍返回
  if (count > expectedRange.max * 1.5) {
    console.warn(`⚠️ 计数异常：${count}只（预期${expectedRange.min}-${expectedRange.max}）`)
  }
  
  // 如果计数为负数或0，返回默认值
  if (!count || count < 0) {
    console.warn('⚠️ 计数无效，返回0')
    return 0
  }
  
  return Math.floor(count) // 确保返回整数
}

// 文本响应解析器（兜底方案）
function parseFallbackResult(textResponse, expectedRange, modelInfo) {
  console.log('📝 使用文本解析兜底方案')
  
  // 尝试从文本中提取数字
  const numberMatches = textResponse.match(/(\d+)\s*只/g) || 
                       textResponse.match(/总数[：:]\s*(\d+)/g) ||
                       textResponse.match(/识别[到得出]*\s*(\d+)/g)
  
  let totalCount = 0
  if (numberMatches && numberMatches.length > 0) {
    // 提取最大的数字作为总数
    const numbers = numberMatches.map(m => parseInt(m.match(/\d+/)[0]))
    totalCount = Math.max(...numbers)
  } else if (expectedRange && expectedRange.min && expectedRange.max) {
    // 如果无法提取数字，使用预期范围的中间值
    totalCount = Math.floor((expectedRange.min + expectedRange.max) / 2)
  }
  
  return {
    success: true,
    data: {
      totalCount: totalCount,
      confidence: 0.65, // 文本解析置信度较低
      countingMethod: '文本解析（兜底）',
      regions: [],
      environmentAnalysis: {
        lighting: 'unknown',
        crowding: 'unknown',
        imageQuality: 'unknown',
        challenges: ['AI返回格式异常，使用文本解析']
      },
      abnormalDetection: {
        suspiciousAnimals: 0,
        healthConcerns: ['建议人工复核'],
        exclusionReason: []
      },
      suggestions: [
        '图像分析结果格式异常，建议重新拍摄',
        '确保图像清晰、光线充足',
        '建议人工复核识别结果'
      ],
      reasoning: `文本解析结果：${textResponse.substring(0, 200)}...`,
      modelInfo: modelInfo || {},
      isFallback: true
    }
  }
}

// 处理对话完成
async function handleChatCompletion(event, manager) {
  const { 
    messages, 
    taskType = 'general_chat', 
    priority = 'balanced', 
    options = {},
    images = []  // ✨ 新增: 图片URL数组
  } = event
  
  // ✨ 如果有图片且任务类型是健康诊断，自动切换到视觉任务
  let actualTaskType = taskType
  if (images && images.length > 0 && taskType === 'health_diagnosis') {
    actualTaskType = 'health_diagnosis_vision'
  }
  
  // 生成缓存键
  const cacheKey = `chat_${JSON.stringify({ messages, actualTaskType, images })}`
  
  // 检查缓存
  const cached = await manager.checkCache(cacheKey)
  if (cached) {
    return {
      success: true,
      data: cached,
      fromCache: true
    }
  }

  try {
    // 获取模型配置
    const modelMapping = TASK_MODEL_MAPPING[actualTaskType]
    if (!modelMapping) {
      throw new Error(`未找到任务类型 ${actualTaskType} 的模型配置`)
    }

    // 准备尝试的模型列表
    const modelsToTry = [modelMapping.primary]
    if (modelMapping.fallback) {
      modelsToTry.push(modelMapping.fallback)
    }

    // ✨ 处理图片（如果有）
    let processedMessages = messages
    let usedVision = false
    
    if (images && images.length > 0) {
      try {
        // 传入第一个要尝试的模型ID，以便选择正确的图片格式
        processedMessages = await manager.processMessagesWithImages(messages, images, modelsToTry[0])
        
        // 检查是否真的包含了图片
        const hasImageContent = processedMessages.some(msg => 
          Array.isArray(msg.content) && 
          msg.content.some(item => item.type === 'image_url')
        )
        
        if (hasImageContent) {
          usedVision = true
        } else {
          // 如果是视觉任务但图片失败，切换回纯文本任务
          if (actualTaskType === 'health_diagnosis_vision') {
            actualTaskType = 'health_diagnosis'
            
            // 重新获取纯文本模型配置
            const textModelMapping = TASK_MODEL_MAPPING[actualTaskType]
            modelsToTry.length = 0  // 清空
            modelsToTry.push(textModelMapping.primary)
            if (textModelMapping.fallback) {
              modelsToTry.push(...textModelMapping.fallback)
            }
          }
        }
      } catch (error) {
        console.error('图片处理异常:', error.message)
        // 降级处理同上
        if (actualTaskType === 'health_diagnosis_vision') {
          actualTaskType = 'health_diagnosis'
          const textModelMapping = TASK_MODEL_MAPPING[actualTaskType]
          modelsToTry.length = 0
          modelsToTry.push(textModelMapping.primary)
          if (textModelMapping.fallback) {
            modelsToTry.push(...textModelMapping.fallback)
          }
        }
      }
    }

    // 依次尝试每个模型
    let lastError = null
    for (let i = 0; i < modelsToTry.length; i++) {
      const modelId = modelsToTry[i]
      const modelConfig = MODEL_CONFIGS[modelId]
      
      if (!modelConfig) {
        console.error(`模型配置不存在: ${modelId}`)
        continue
      }
      
      
      try {
        // 调用模型
        const result = await manager.callModel(modelId, processedMessages, options)
        
        
        // 设置缓存（图片诊断不缓存或缓存时间更短）
        const cacheDuration = images.length > 0 ? 600 : 3600
        await manager.setCache(cacheKey, result, cacheDuration)
        
        // 返回成功结果
        return {
          success: true,
          data: result,
          modelUsed: modelId,
          usedVision,
          fromCache: false
        }
      } catch (error) {
        lastError = error
        console.error(`❌ 模型 ${modelId} 失败:`, error.message)
        
        // 如果是速率限制且还有其他模型可尝试，继续下一个
        if (error.isRateLimited && i < modelsToTry.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          continue
        }
        
        // 如果还有其他模型可尝试，继续
        if (i < modelsToTry.length - 1) {
          continue
        }
        
        // 所有模型都失败了，抛出最后一个错误
        throw error
      }
    }
    
    // 理论上不会到这里，但以防万一
    throw lastError || new Error('所有模型调用均失败')
  } catch (error) {
    return {
      success: false,
      error: error.message,
      fallback: '很抱歉，AI服务暂时不可用，请稍后重试。'
    }
  }
}

// 获取使用统计
async function getUsageStats(event, manager) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const stats = await manager.usageCollection
      .where({
        date: today
      })
      .get()
    
    return {
      success: true,
      data: {
        todayUsage: stats.data,
        totalRequests: stats.data.reduce((sum, item) => sum + item.requests, 0),
        totalTokens: stats.data.reduce((sum, item) => sum + item.tokens, 0)
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

// 健康检查
async function healthCheck(event, manager) {
  const results = {}
  
  for (const [modelId, config] of Object.entries(MODEL_CONFIGS)) {
    results[modelId] = {
      available: await manager.checkModelAvailability(modelId),
      provider: config.provider
    }
  }
  
  return {
    success: true,
    data: results,
    timestamp: new Date().toISOString()
  }
}
