// 临时测试文件：验证环境变量是否正确配置
// 使用方法：在云函数入口临时添加这段代码测试

exports.main = async (event, context) => {
  console.log('====== 环境变量检查 ======')
  
  // 检查环境变量是否存在
  const hasApiKey = !!process.env.ERNIE_API_KEY
  const hasSecretKey = !!process.env.ERNIE_SECRET_KEY
  
  console.log('ERNIE_API_KEY 是否配置:', hasApiKey ? '✅' : '❌')
  console.log('ERNIE_SECRET_KEY 是否配置:', hasSecretKey ? '✅' : '❌')
  
  if (hasApiKey) {
    const apiKey = process.env.ERNIE_API_KEY
    console.log('API Key 长度:', apiKey.length)
    console.log('API Key 前6位:', apiKey.substring(0, 6))
    console.log('API Key 后4位:', apiKey.substring(apiKey.length - 4))
    console.log('API Key 是否包含空格:', apiKey.includes(' '))
    console.log('API Key 是否包含换行:', apiKey.includes('\n'))
  }
  
  if (hasSecretKey) {
    const secretKey = process.env.ERNIE_SECRET_KEY
    console.log('Secret Key 长度:', secretKey.length)
    console.log('Secret Key 前6位:', secretKey.substring(0, 6))
    console.log('Secret Key 后4位:', secretKey.substring(secretKey.length - 4))
    console.log('Secret Key 是否包含空格:', secretKey.includes(' '))
    console.log('Secret Key 是否包含换行:', secretKey.includes('\n'))
  }
  
  // 尝试获取Access Token
  if (hasApiKey && hasSecretKey) {
    try {
      const axios = require('axios')
      console.log('\n====== 尝试获取百度Access Token ======')
      
      const response = await axios.post('https://aip.baidubce.com/oauth/2.0/token', null, {
        params: {
          grant_type: 'client_credentials',
          client_id: process.env.ERNIE_API_KEY,
          client_secret: process.env.ERNIE_SECRET_KEY
        },
        timeout: 10000
      })
      
      console.log('✅ Access Token获取成功!')
      console.log('Token:', response.data.access_token?.substring(0, 20) + '...')
      console.log('有效期:', response.data.expires_in, '秒')
      
      return {
        success: true,
        message: '环境变量配置正确，API认证成功！',
        tokenPreview: response.data.access_token?.substring(0, 20) + '...'
      }
    } catch (error) {
      console.error('❌ Access Token获取失败')
      console.error('错误状态码:', error.response?.status)
      console.error('错误信息:', error.response?.data || error.message)
      
      return {
        success: false,
        error: error.message,
        details: error.response?.data,
        statusCode: error.response?.status
      }
    }
  }
  
  return {
    success: false,
    message: '环境变量未配置'
  }
}

