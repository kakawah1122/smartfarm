const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// AI模型配置
const MODEL_CONFIGS = {
  'glm-4-free': {
    provider: '智谱AI',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    model: 'glm-4-flash',
    apiKey: process.env.GLM4_API_KEY,
    maxTokens: 8192,
    costPerKToken: 0, // 免费额度
    maxRequestsPerDay: 1000
  },
  'deepseek-chat': {
    provider: 'DeepSeek',
    baseURL: 'https://api.deepseek.com/v1/',
    model: 'deepseek-chat',
    apiKey: process.env.DEEPSEEK_API_KEY,
    maxTokens: 4096,
    costPerKToken: 0, // 免费额度
    maxRequestsPerDay: 500
  },
  'moonshot-free': {
    provider: '月之暗面',
    baseURL: 'https://api.moonshot.cn/v1/',
    model: 'moonshot-v1-8k',
    apiKey: process.env.MOONSHOT_API_KEY,
    maxTokens: 8192,
    costPerKToken: 0.012,
    maxRequestsPerDay: 1000
  },
  'groq-fast': {
    provider: 'Groq',
    baseURL: 'https://api.groq.com/openai/v1/',
    model: 'llama3-8b-8192',
    apiKey: process.env.GROQ_API_KEY,
    maxTokens: 8192,
    costPerKToken: 0, // 免费
    maxRequestsPerDay: 14400
  },
  'baidu-vision': {
    provider: '百度AI',
    baseURL: 'https://aip.baidubce.com/rest/2.0/',
    apiKey: process.env.BAIDU_API_KEY,
    secretKey: process.env.BAIDU_SECRET_KEY,
    maxRequestsPerDay: 1000
  },
  'tencent-vision': {
    provider: '腾讯AI',
    baseURL: 'https://recognition.image.myqcloud.com/',
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
    maxRequestsPerDay: 1000
  }
}

// 任务-模型映射策略
const TASK_MODEL_MAPPING = {
  'urgent_diagnosis': {
    primary: 'groq-fast',
    fallback: ['glm-4-free', 'deepseek-chat'],
    timeout: 3000
  },
  'detailed_analysis': {
    primary: 'moonshot-free',
    fallback: ['deepseek-chat', 'glm-4-free'],
    timeout: 10000
  },
  'general_chat': {
    primary: 'glm-4-free',
    fallback: ['deepseek-chat'],
    timeout: 5000
  },
  'image_recognition': {
    primary: 'baidu-vision',
    fallback: ['tencent-vision'],
    timeout: 5000
  },
  'financial_analysis': {
    primary: 'deepseek-chat',
    fallback: ['glm-4-free'],
    timeout: 8000
  },
  'farming_advice': {
    primary: 'glm-4-free',
    fallback: ['deepseek-chat'],
    timeout: 6000
  }
}

// 成本控制配置
const COST_CONTROL = {
  dailyBudget: 50, // 每日预算￥50
  priorityLevels: {
    'free_only': 0,
    'low_cost': 10,
    'balanced': 30,
    'premium': 50
  }
}

// AI模型管理器
class AIModelManager {
  constructor() {
    this.db = cloud.database()
    this.usageCollection = this.db.collection('ai_usage')
    this.cacheCollection = this.db.collection('ai_cache')
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
      console.error('检查模型可用性失败:', error)
      return false
    }
  }

  // 调用AI模型
  async callModel(modelId, messages, options = {}) {
    const config = MODEL_CONFIGS[modelId]
    if (!config) {
      throw new Error(`模型配置不存在: ${modelId}`)
    }

    try {
      let response
      
      // 根据供应商调用不同API
      if (config.provider === '智谱AI') {
        response = await this.callZhipuAI(config, messages, options)
      } else if (config.provider === 'DeepSeek') {
        response = await this.callDeepSeek(config, messages, options)
      } else if (config.provider === '月之暗面') {
        response = await this.callMoonshot(config, messages, options)
      } else if (config.provider === 'Groq') {
        response = await this.callGroq(config, messages, options)
      } else {
        throw new Error(`不支持的AI供应商: ${config.provider}`)
      }

      // 记录使用量
      await this.recordUsage(modelId, response)
      
      return response
    } catch (error) {
      console.error(`调用${modelId}失败:`, error)
      throw error
    }
  }

  // 调用智谱AI
  async callZhipuAI(config, messages, options) {
    const response = await axios.post(`${config.baseURL}chat/completions`, {
      model: config.model,
      messages,
      max_tokens: options.maxTokens || config.maxTokens,
      temperature: options.temperature || 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: options.timeout || 10000
    })

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      model: config.model
    }
  }

  // 调用DeepSeek
  async callDeepSeek(config, messages, options) {
    const response = await axios.post(`${config.baseURL}chat/completions`, {
      model: config.model,
      messages,
      max_tokens: options.maxTokens || config.maxTokens,
      temperature: options.temperature || 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: options.timeout || 10000
    })

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      model: config.model
    }
  }

  // 调用Moonshot
  async callMoonshot(config, messages, options) {
    const response = await axios.post(`${config.baseURL}chat/completions`, {
      model: config.model,
      messages,
      max_tokens: options.maxTokens || config.maxTokens,
      temperature: options.temperature || 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: options.timeout || 10000
    })

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      model: config.model
    }
  }

  // 调用Groq
  async callGroq(config, messages, options) {
    const response = await axios.post(`${config.baseURL}chat/completions`, {
      model: config.model,
      messages,
      max_tokens: options.maxTokens || config.maxTokens,
      temperature: options.temperature || 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: options.timeout || 10000
    })

    return {
      content: response.data.choices[0].message.content,
      usage: response.data.usage,
      model: config.model
    }
  }

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
      console.error('记录使用量失败:', error)
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
      console.error('缓存检查失败:', error)
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
      console.error('设置缓存失败:', error)
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
    console.error('AI服务调用失败:', error)
    return {
      success: false,
      error: error.message,
      fallback: true
    }
  }
}

// 处理对话完成
async function handleChatCompletion(event, manager) {
  const { messages, taskType = 'general_chat', priority = 'balanced', options = {} } = event
  
  // 生成缓存键
  const cacheKey = `chat_${JSON.stringify({ messages, taskType })}`
  
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
    // 选择模型
    const modelId = await manager.selectModel(taskType, priority)
    
    // 调用模型
    const result = await manager.callModel(modelId, messages, options)
    
    // 设置缓存
    await manager.setCache(cacheKey, result, 3600)
    
    return {
      success: true,
      data: result,
      modelId,
      fromCache: false
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      fallback: '很抱歉，AI服务暂时不可用，请稍后重试。'
    }
  }
}

// 处理图像识别
async function handleImageRecognition(event, manager) {
  const { imageData, location, taskType = 'image_recognition' } = event
  
  try {
    // 选择视觉模型
    const modelId = await manager.selectModel(taskType)
    
    let result
    if (modelId === 'baidu-vision') {
      result = await callBaiduVision(imageData, MODEL_CONFIGS[modelId])
    } else if (modelId === 'tencent-vision') {
      result = await callTencentVision(imageData, MODEL_CONFIGS[modelId])
    }
    
    // 记录使用量
    await manager.recordUsage(modelId, { usage: { total_tokens: 1 } })
    
    return {
      success: true,
      data: result,
      modelId
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      fallback: '图像识别服务暂时不可用，请手动盘点。'
    }
  }
}

// 百度视觉API调用
async function callBaiduVision(imageData, config) {
  // 获取access_token
  const tokenResponse = await axios.post('https://aip.baidubce.com/oauth/2.0/token', null, {
    params: {
      grant_type: 'client_credentials',
      client_id: config.apiKey,
      client_secret: config.secretKey
    }
  })
  
  const accessToken = tokenResponse.data.access_token
  
  // 调用动物识别API
  const response = await axios.post(
    `https://aip.baidubce.com/rest/2.0/image-classify/v1/animal?access_token=${accessToken}`,
    {
      image: imageData.replace(/^data:image\/[a-z]+;base64,/, ''),
      top_num: 10
    },
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }
  )
  
  return {
    results: response.data.result,
    confidence: response.data.result[0]?.score || 0
  }
}

// 腾讯视觉API调用（简化实现）
async function callTencentVision(imageData, config) {
  // 这里需要实现腾讯云的签名算法和API调用
  // 简化示例，实际需要完整的签名实现
  return {
    results: [],
    confidence: 0,
    message: '腾讯视觉API需要完整签名实现'
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
