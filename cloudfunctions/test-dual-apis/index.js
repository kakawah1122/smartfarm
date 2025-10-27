/**
 * 双模型API测试云函数
 * 用于验证 GLM4_API_KEY 和 siliconflow_API_KEY 是否正确配置
 */

const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 测试 GLM4 API
async function testGLM4() {
  try {
    const apiKey = process.env.GLM4_API_KEY
    if (!apiKey) {
      return { success: false, error: 'GLM4_API_KEY 未配置' }
    }

    const response = await axios.post(
      'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      {
        model: 'glm-4-flash',
        messages: [
          { role: 'system', content: '你是一个有帮助的助手。' },
          { role: 'user', content: '请简要介绍自己' }
        ],
        max_tokens: 100,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )

    return {
      success: true,
      provider: 'GLM4（智谱AI）',
      model: 'glm-4-flash',
      response: response.data.choices[0].message.content,
      usage: response.data.usage
    }
  } catch (error) {
    return {
      success: false,
      provider: 'GLM4',
      error: error.message
    }
  }
}

// 测试 SiliconFlow API
async function testSiliconFlow() {
  try {
    const apiKey = process.env.siliconflow_API_KEY
    if (!apiKey) {
      return { success: false, error: 'siliconflow_API_KEY 未配置' }
    }

    const response = await axios.post(
      'https://api.siliconflow.cn/v1/chat/completions',
      {
        model: 'Qwen/Qwen2.5-72B-Instruct',
        messages: [
          { role: 'system', content: '你是一个有帮助的助手。' },
          { role: 'user', content: '请简要介绍自己' }
        ],
        max_tokens: 100,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    )

    return {
      success: true,
      provider: 'SiliconFlow（Qwen2.5-72B）',
      model: 'Qwen/Qwen2.5-72B-Instruct',
      response: response.data.choices[0].message.content,
      usage: response.data.usage
    }
  } catch (error) {
    return {
      success: false,
      provider: 'SiliconFlow',
      error: error.message
    }
  }
}

exports.main = async (event, context) => {
  const glm4Test = await testGLM4()
  const sfTest = await testSiliconFlow()

  return {
    timestamp: new Date().toISOString(),
    glm4: glm4Test,
    siliconflow: sfTest,
    summary: {
      glm4Status: glm4Test.success ? '✅ 正常' : '❌ 失败',
      siliconflowStatus: sfTest.success ? '✅ 正常' : '❌ 失败'
    }
  }
}
