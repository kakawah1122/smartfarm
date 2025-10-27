// 测试GEMINI配置脚本
// 在微信开发者工具的云函数控制台运行

const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async (event, context) => {
  console.log('====== 开始测试GEMINI配置 ======')
  
  // 1. 检查环境变量
  const apiKey = process.env.GEMINI_API_KEY
  const baseURL = process.env.GEMINI_BASE_URL
  
  console.log('✓ 检查环境变量:')
  console.log('  GEMINI_API_KEY:', apiKey ? `已配置 (前6位: ${apiKey.substring(0, 6)}...)` : '❌ 未配置')
  console.log('  GEMINI_BASE_URL:', baseURL || '❌ 未配置')
  
  if (!apiKey || !baseURL) {
    return {
      success: false,
      error: '环境变量未配置完整',
      details: {
        hasApiKey: !!apiKey,
        hasBaseURL: !!baseURL
      }
    }
  }
  
  // 2. 测试简单的纯文本API调用
  try {
    console.log('\n✓ 测试GEMINI API调用 (纯文本):')
    
    const requestData = {
      contents: [
        {
          parts: [
            {
              text: "请用一句话介绍狮头鹅的特点。"
            }
          ]
        }
      ],
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.7
      }
    }
    
    const apiUrl = `${baseURL}/v1beta/models/gemini-2.5-pro:generateContent`
    console.log('  API URL:', apiUrl)
    console.log('  请求体大小:', JSON.stringify(requestData).length, 'bytes')
    
    const response = await axios.post(apiUrl, requestData, {
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      timeout: 30000
    })
    
    console.log('\n✅ GEMINI API调用成功!')
    console.log('  响应状态:', response.status)
    console.log('  响应数据:', JSON.stringify(response.data, null, 2).substring(0, 500))
    
    const generatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    console.log('\n✅ 生成的文本:')
    console.log('  ', generatedText)
    
    return {
      success: true,
      message: 'GEMINI配置正确，API调用成功！',
      generatedText,
      usage: response.data.usageMetadata
    }
    
  } catch (error) {
    console.error('\n❌ GEMINI API调用失败:')
    console.error('  错误状态:', error.response?.status)
    console.error('  错误数据:', JSON.stringify(error.response?.data, null, 2))
    console.error('  错误消息:', error.message)
    
    return {
      success: false,
      error: 'GEMINI API调用失败',
      details: {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      }
    }
  }
}

