// weather云函数 - 和风天气API集成
const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

/**
 * 和风天气配置
 * 请在这里配置您的和风天气API相关信息
 */
const QWEATHER_CONFIG = {
  // 您的专用API Host
  API_HOST: 'n96apwfjn2.re.qweatherapi.com',
  
  // JWT认证配置
  JWT: {
    PROJECT_ID: '2M2BEEB3V5',               // 您的项目ID
    CREDENTIAL_ID: 'C8B7JUH5V6',            // 您的凭据ID（KID）
    PRIVATE_KEY: `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIPjx83mg0QC795KAds+Wavn5S9Br7fw/7c4XVF9AferQ
-----END PRIVATE KEY-----`
  }
}

/**
 * 生成JWT Token用于和风天气API认证
 */
function generateJWT() {
  try {
    const now = Math.floor(Date.now() / 1000)
    
    
    const header = {
      alg: 'EdDSA',
      kid: QWEATHER_CONFIG.JWT.CREDENTIAL_ID
    }
    
    const payload = {
      sub: QWEATHER_CONFIG.JWT.PROJECT_ID,
      iat: now - 30,
      exp: now + 3600
    }
    
    
    const base64UrlEncode = (obj) => {
      return Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
    }
    
    const headerEncoded = base64UrlEncode(header)
    const payloadEncoded = base64UrlEncode(payload)
    const data = `${headerEncoded}.${payloadEncoded}`
    
    const privateKey = crypto.createPrivateKey(QWEATHER_CONFIG.JWT.PRIVATE_KEY)
    const signature = crypto.sign(null, Buffer.from(data), {
      key: privateKey,
      format: 'pem'
    })
    
    const signatureEncoded = signature
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
    
    return `${data}.${signatureEncoded}`
  } catch (error) {
    throw new Error('JWT生成失败: ' + error.message)
  }
}

/**
 * 解压缩响应数据
 */
function decompressData(rawData, encoding, callback) {
  const zlib = require('zlib')
  
  try {
    if (!encoding || encoding === 'identity') {
      // 无压缩，直接返回字符串
      callback(rawData.toString('utf8'))
      return
    }
    
    if (encoding === 'gzip') {
      zlib.gunzip(rawData, (err, decompressed) => {
        if (err) {
          callback(rawData.toString('utf8')) // 尝试直接解析
        } else {
          callback(decompressed.toString('utf8'))
        }
      })
    } else if (encoding === 'deflate') {
      zlib.inflate(rawData, (err, decompressed) => {
        if (err) {
          callback(rawData.toString('utf8')) // 尝试直接解析
        } else {
          callback(decompressed.toString('utf8'))
        }
      })
    } else {
      // 其他编码，尝试直接解析
      callback(rawData.toString('utf8'))
    }
  } catch (error) {
    callback(rawData.toString('utf8')) // 尝试直接解析
  }
}

/**
 * 发起和风天气API请求
 */
async function qweatherRequest(apiPath, params = {}) {
  const https = require('https')
  const zlib = require('zlib')
  const jwt = generateJWT()
  const queryString = new URLSearchParams(params).toString()
  const url = `https://${QWEATHER_CONFIG.API_HOST}${apiPath}${queryString ? '?' + queryString : ''}`
  
  
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'User-Agent': 'WeChat-MiniProgram-Weather/1.0',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate'  // 支持gzip压缩
      }
    }
    
    const req = https.request(url, options, (res) => {
      let rawData = Buffer.alloc(0)
      
      // 收集原始二进制数据
      res.on('data', (chunk) => {
        rawData = Buffer.concat([rawData, chunk])
      })
      
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            // 尝试解压缩错误响应
            decompressData(rawData, res.headers['content-encoding'], (decompressedData) => {
              reject(new Error(`HTTP Error: ${res.statusCode} ${res.statusMessage} - ${decompressedData}`))
            })
            return
          }
          
          // 解压缩响应数据
          decompressData(rawData, res.headers['content-encoding'], (decompressedData) => {
            try {
              const jsonData = JSON.parse(decompressedData)
              
              if (jsonData.code !== '200') {
                // 已移除调试日志
                reject(new Error(`API Error: ${jsonData.code} - ${jsonData.message || '未知错误'}`))
                return
              }
              
              resolve(jsonData)
            } catch (parseError) {
              // 已移除调试日志
              // 已移除调试日志
              reject(parseError)
            }
          })
        } catch (error) {
          // 已移除调试日志
          reject(error)
        }
      })
    })
    
    req.on('error', (error) => {
      // 已移除调试日志
      reject(error)
    })
    
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('请求超时'))
    })
    
    req.setTimeout(10000) // 10秒超时
    req.end()
  })
}

/**
 * 通过坐标获取城市信息
 */
async function getCityByCoordinates(lat, lon) {
  const result = await qweatherRequest('/geo/v2/city/lookup', {
    location: `${lon},${lat}`,
    lang: 'zh'
  })
  
  if (result.location && result.location.length > 0) {
    return result.location[0]
  }
  
  throw new Error('未找到对应的城市信息')
}

/**
 * 获取实时天气
 */
async function getCurrentWeather(locationId) {
  return await qweatherRequest('/v7/weather/now', {
    location: locationId,
    lang: 'zh'
  })
}

/**
 * 获取逐小时天气预报（24小时）
 */
async function getHourlyForecast(locationId) {
  return await qweatherRequest('/v7/weather/24h', {
    location: locationId,
    lang: 'zh'
  })
}

/**
 * 获取逐日天气预报（7天）
 */
async function getDailyForecast(locationId) {
  return await qweatherRequest('/v7/weather/7d', {
    location: locationId,
    lang: 'zh'
  })
}

/**
 * 获取天气预警
 */
async function getWeatherWarning(locationId) {
  try {
    return await qweatherRequest('/v7/warning/now', {
      location: locationId,
      lang: 'zh'
    })
  } catch (error) {
    return { warning: [] }
  }
}

/**
 * 获取空气质量（使用坐标）
 */
async function getAirQuality(lat, lon) {
  try {
    return await qweatherRequest('/v7/air/now', {
      location: `${lon},${lat}`,
      lang: 'zh'
    })
  } catch (error) {
    return { now: {} }
  }
}

/**
 * 获取天气表情图标
 */
function getWeatherEmoji(weather) {
  const emojiMap = {
    '晴': '☀️',
    '多云': '⛅',
    '阴': '☁️',
    '小雨': '🌦️',
    '中雨': '🌧️',
    '大雨': '⛈️',
    '雷阵雨': '⛈️',
    '雪': '❄️',
    '小雪': '❄️',
    '中雪': '❄️',
    '大雪': '❄️',
    '雾': '🌫️',
    '霾': '😷',
    '沙尘暴': '🌪️',
    '浮尘': '🌪️',
    '扬沙': '🌪️'
  }
  
  return emojiMap[weather] || '🌤️'
}

/**
 * 获取完整天气数据
 */
async function getCompleteWeatherData(lat, lon) {
  try {
    // 1. 首先通过坐标获取城市信息
    const cityInfo = await getCityByCoordinates(lat, lon)
    const locationId = cityInfo.id
    
    
    // 2. 并行获取各种天气数据
    const [
      currentWeather,
      hourlyForecast,
      dailyForecast,
      weatherWarning,
      airQuality
    ] = await Promise.all([
      getCurrentWeather(locationId),
      getHourlyForecast(locationId),
      getDailyForecast(locationId),
      getWeatherWarning(locationId),
      getAirQuality(lat, lon)
    ])
    
    // 3. 整理数据格式，匹配前端期望
    const processedData = {
      locationInfo: {
        province: cityInfo.adm1 || cityInfo.country,
        city: cityInfo.adm2 || cityInfo.name,
        district: cityInfo.name,
        latitude: lat,
        longitude: lon
      },
      current: {
        temperature: parseInt(currentWeather.now.temp) || 0,
        humidity: parseInt(currentWeather.now.humidity) || 0,
        feelsLike: parseInt(currentWeather.now.feelsLike) || parseInt(currentWeather.now.temp) || 0,
        windDirection: currentWeather.now.windDir || '无风',
        windScale: currentWeather.now.windScale || '0级',
        windSpeed: parseInt(currentWeather.now.windSpeed) || 0,
        visibility: parseInt(currentWeather.now.vis) || 0,
        pressure: parseInt(currentWeather.now.pressure) || 0,
        updateTime: currentWeather.updateTime || new Date().toISOString()
      },
      condition: {
        text: currentWeather.now.text || '未知',
        emoji: getWeatherEmoji(currentWeather.now.text)
      },
      hourly: hourlyForecast.hourly || [],
      daily: dailyForecast.daily || [],
      warning: weatherWarning.warning || [],
      air: airQuality.now || {}
    }
    
    return {
      success: true,
      data: processedData
    }
    
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      }
    }
  }
}

// 更新后的main函数
exports.main = async (event, context) => {
  const { action, lat, lon } = event
  
  // 检查配置
  if (QWEATHER_CONFIG.JWT.PROJECT_ID === 'YOUR_PROJECT_ID' || 
      QWEATHER_CONFIG.JWT.CREDENTIAL_ID === 'YOUR_CREDENTIAL_ID' ||
      QWEATHER_CONFIG.JWT.PRIVATE_KEY.includes('YOUR_ED25519_PRIVATE_KEY_HERE')) {
    return {
      success: false,
      error: {
        message: '请先在index.js中配置您的和风天气API认证信息（PROJECT_ID、CREDENTIAL_ID、PRIVATE_KEY）',
        code: 'CONFIG_REQUIRED'
      }
    }
  }
  
  try {
    switch (action) {
      case 'getCompleteWeather':
        if (!lat || !lon) {
          throw new Error('缺少必要的经纬度参数')
        }
        return await getCompleteWeatherData(parseFloat(lat), parseFloat(lon))
      
      default:
        throw new Error(`不支持的操作: ${action}`)
    }
  } catch (error) {
    // 已移除调试日志
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      }
    }
  }
}
