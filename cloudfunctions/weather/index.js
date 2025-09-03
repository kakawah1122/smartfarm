// 和风天气API云函数 - 官方规范版本
const cloud = require('wx-server-sdk')
const axios = require('axios')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 和风天气API配置 - 根据官方文档规范
const HEFENG_API_KEY = process.env.HEFENG_API_KEY
// 使用您的专用API Host - 默认优先选择
const HEFENG_API_HOST = 'https://n96apwfjn2.re.qweatherapi.com'
// 备用端点
const HEFENG_FALLBACK_HOSTS = [
  'https://devapi.qweather.com',  // 免费版端点
  'https://api.qweather.com'      // 商业版端点
]

/**
 * 云函数入口函数
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, lat, lon } = event
  
  console.log('=== 和风天气API云函数开始 ===')
  console.log('请求参数:', { action, lat, lon })
  console.log('用户OpenID:', wxContext.OPENID)
  
  // 验证API密钥
  if (!HEFENG_API_KEY) {
    console.error('❌ 和风天气API密钥未配置')
    return {
      success: false,
      error: 'API密钥未配置',
      message: '和风天气API密钥未在云函数环境变量中配置',
      code: 'MISSING_API_KEY'
    }
  }
  
  console.log('✅ 和风天气API密钥已加载')
  
  // 验证输入参数
  if (!lat || !lon) {
    console.error('❌ 缺少必要的经纬度参数')
    return {
      success: false,
      error: '参数错误',
      message: '缺少经纬度参数',
      code: 'MISSING_COORDINATES'
    }
  }
  
  // 验证坐标范围（全球范围）
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    console.error('❌ 坐标参数超出全球有效范围')
    return {
      success: false,
      error: '参数错误',
      message: '经纬度参数超出全球有效范围',
      code: 'INVALID_COORDINATES'
    }
  }
  
  // 验证是否在中国境内（合理范围）
  if (lat < 18 || lat > 54 || lon < 73 || lon > 135) {
    console.warn('⚠️ 坐标可能不在中国境内', { lat, lon })
    // 不阻止执行，但记录警告
  }
  
  try {
    let result
    switch (action) {
      case 'getCurrentWeather':
        result = await getCurrentWeather(lat, lon)
        break
      default:
        result = await getCurrentWeather(lat, lon)
        break
    }
    
    console.log('✅ 云函数执行成功')
    console.log('=== 和风天气API云函数结束 ===')
    return result
    
  } catch (error) {
    console.error('❌ 云函数执行失败:', error)
    console.log('=== 和风天气API云函数结束 ===')
    
    return {
      success: false,
      error: error.message,
      message: '云函数执行失败: ' + error.message,
      code: 'FUNCTION_ERROR',
      details: error.stack
    }
  }
}

/**
 * 调用和风天气API - 根据官方文档规范
 * https://dev.qweather.com/docs/configuration/api-config/
 * 支持API KEY认证，使用query参数方式
 */
async function callQWeatherAPI(endpoint, params) {
  // 添加API密钥到参数中 - 根据官方文档标准格式
  const apiParams = {
    ...params,
    key: HEFENG_API_KEY
  }
  
  const queryString = new URLSearchParams(apiParams).toString()
  
  console.log(`🌐 开始调用和风天气API: ${endpoint}`)
  console.log(`📋 请求参数: ${queryString.replace(HEFENG_API_KEY, '***')}`)
  
  // 首先尝试您的专用API Host
  const allHosts = [HEFENG_API_HOST, ...HEFENG_FALLBACK_HOSTS]
  
  for (let i = 0; i < allHosts.length; i++) {
    const host = allHosts[i]
    const url = `${host}${endpoint}?${queryString}`
    
    const hostType = i === 0 ? '专用API Host' : `备用Host ${i}`
    console.log(`🔄 尝试${hostType} ${i + 1}/${allHosts.length}: ${host}`)
    
    try {
      const startTime = Date.now()
      
      // 根据官方文档，使用标准请求头
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'WeChat-MiniProgram-Weather/2.0',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate' // 支持Gzip压缩
        }
      })
      
      const duration = Date.now() - startTime
      console.log(`✅ API调用成功 (${duration}ms)`)
      console.log(`📊 响应状态: ${response.status}`)
      console.log(`📦 响应数据:`, {
        code: response.data.code,
        updateTime: response.data.updateTime,
        fxLink: response.data.fxLink,
        refer: response.data.refer
      })
      
      // 检查API响应码
      if (response.data.code === '200') {
        return response.data
      } else {
        console.warn(`⚠️ API返回错误码: ${response.data.code}`)
        throw new Error(`API错误码: ${response.data.code} - ${getQWeatherErrorMessage(response.data.code)}`)
      }
      
    } catch (error) {
      console.log(`❌ API Host ${i + 1} 调用失败:`, {
        host: host,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        code: error.code
      })
      
      // 如果不是最后一个Host，继续尝试下一个
      if (i < allHosts.length - 1) {
        console.log(`🔄 尝试下一个API Host...`)
        continue
      }
      
      // 所有Host都失败了，抛出错误
      console.error('❌ 所有API Host都调用失败')
      throw new Error(`API调用失败: ${error.message}`)
    }
  }
}

/**
 * GCJ02坐标转WGS84坐标（精确转换算法）
 * 微信小程序wx.getLocation返回GCJ02坐标，需要转换为WGS84给和风天气API使用
 */
function gcj02ToWgs84(lat, lon) {
  const a = 6378245.0
  const ee = 0.00669342162296594323
  
  const dlat = transformLat(lon - 105.0, lat - 35.0)
  const dlon = transformLon(lon - 105.0, lat - 35.0)
  
  const radlat = lat / 180.0 * Math.PI
  let magic = Math.sin(radlat)
  magic = 1 - ee * magic * magic
  const sqrtmagic = Math.sqrt(magic)
  
  const dlat2 = (dlat * 180.0) / ((a * (1 - ee)) / (magic * sqrtmagic) * Math.PI)
  const dlon2 = (dlon * 180.0) / (a / sqrtmagic * Math.cos(radlat) * Math.PI)
  
  const mglat = lat - dlat2
  const mglon = lon - dlon2
  
  return { lat: mglat, lon: mglon }
}

function transformLat(lon, lat) {
  let ret = -100.0 + 2.0 * lon + 3.0 * lat + 0.2 * lat * lat + 0.1 * lon * lat + 0.2 * Math.sqrt(Math.abs(lon))
  ret += (20.0 * Math.sin(6.0 * lon * Math.PI) + 20.0 * Math.sin(2.0 * lon * Math.PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(lat * Math.PI) + 40.0 * Math.sin(lat / 3.0 * Math.PI)) * 2.0 / 3.0
  ret += (160.0 * Math.sin(lat / 12.0 * Math.PI) + 320 * Math.sin(lat * Math.PI / 30.0)) * 2.0 / 3.0
  return ret
}

function transformLon(lon, lat) {
  let ret = 300.0 + lon + 2.0 * lat + 0.1 * lon * lon + 0.1 * lon * lat + 0.1 * Math.sqrt(Math.abs(lon))
  ret += (20.0 * Math.sin(6.0 * lon * Math.PI) + 20.0 * Math.sin(2.0 * lon * Math.PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(lon * Math.PI) + 40.0 * Math.sin(lon / 3.0 * Math.PI)) * 2.0 / 3.0
  ret += (150.0 * Math.sin(lon / 12.0 * Math.PI) + 300.0 * Math.sin(lon / 30.0 * Math.PI)) * 2.0 / 3.0
  return ret
}

/**
 * 获取当前天气 - 根据官方API文档
 * https://dev.qweather.com/docs/api/weather/weather-now/
 */
async function getCurrentWeather(lat, lon) {
  console.log(`📍 接收到坐标 (GCJ02): ${lat}, ${lon}`)
  
  // 验证坐标范围（全球范围）
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error(`坐标超出有效范围: lat=${lat}, lon=${lon}`)
  }
  
  // 微信小程序返回GCJ02坐标，需要转换为WGS84供和风天气API使用
  const wgs84Coords = gcj02ToWgs84(lat, lon)
  const convertedLat = wgs84Coords.lat
  const convertedLon = wgs84Coords.lon
  
  console.log(`📍 转换后坐标 (WGS84): ${convertedLat}, ${convertedLon}`)
  
  try {
    // 根据官方文档，使用经纬度格式: "经度,纬度"
    const location = `${convertedLon.toFixed(6)},${convertedLat.toFixed(6)}`
    
    // 调用实时天气API - 严格按照官方文档格式
    const weatherData = await callQWeatherAPI('/v7/weather/now', {
      location: location,
      lang: 'zh',     // 中文响应
      unit: 'metric'  // 公制单位（摄氏度、公里等）
    })
    
    // 获取城市信息（使用GeoAPI）
    let cityInfo
    try {
      cityInfo = await getCityInfo(convertedLat, convertedLon)
      console.log('✅ 城市信息获取成功:', cityInfo)
    } catch (error) {
      console.warn('⚠️ 获取城市信息失败，使用坐标推测位置:', error.message)
      // 基于坐标推测城市信息，而不是使用固定的苏州
      cityInfo = estimateCityFromCoords(convertedLat, convertedLon)
    }
    
    // 构建返回结果
    const result = {
      success: true,
      source: 'qweather_api',
      data: {
        current: {
          temperature: parseInt(weatherData.now.temp),
          feelsLike: parseInt(weatherData.now.feelsLike),
          humidity: parseInt(weatherData.now.humidity),
          weather: weatherData.now.text,
          windDirection: weatherData.now.windDir,
          windScale: weatherData.now.windScale,
          windSpeed: parseFloat(weatherData.now.windSpeed),
          visibility: parseFloat(weatherData.now.vis),
          pressure: parseFloat(weatherData.now.pressure),
          updateTime: weatherData.updateTime
        },
        condition: {
          text: weatherData.now.text,
          icon: weatherData.now.icon,
          emoji: getWeatherEmoji(weatherData.now.text)
        },
        locationInfo: cityInfo,
        source: {
          api: 'QWeather',
          fxLink: weatherData.fxLink,
          license: weatherData.license
        }
      }
    }
    
    console.log('✅ 天气数据获取成功')
    return result
    
  } catch (error) {
    console.error('❌ 天气数据获取失败:', error)
    return {
      success: false,
      source: 'api_error',
      error: error.message,
      message: '天气数据获取失败: ' + error.message,
      code: 'WEATHER_API_ERROR'
    }
  }
}

/**
 * 获取城市信息 - 使用GeoAPI
 * https://dev.qweather.com/docs/api/geoapi/
 */
async function getCityInfo(lat, lon) {
  try {
    const location = `${lon.toFixed(6)},${lat.toFixed(6)}`
    
    // 使用GeoAPI进行逆地理编码 - 严格按照官方文档格式
    const geoData = await callQWeatherAPI('/v7/location/lookup', {
      location: location,
      lang: 'zh',     // 中文响应
      unit: 'metric'  // 公制单位
    })
    
    if (geoData.location && geoData.location.length > 0) {
      const locationData = geoData.location[0]
      return {
        province: locationData.adm1,
        city: locationData.adm2,
        district: locationData.name,
        country: locationData.country,
        locationId: locationData.id
      }
    } else {
      throw new Error('未找到位置信息')
    }
  } catch (error) {
    throw error
  }
}

/**
 * 基于坐标推测城市信息
 */
function estimateCityFromCoords(lat, lon) {
  console.log(`🗺️ 基于坐标推测城市: lat=${lat}, lon=${lon}`)
  
  // 东莞市坐标范围大致为：纬度22.6-23.4，经度113.3-114.3
  if (lat >= 22.6 && lat <= 23.4 && lon >= 113.3 && lon <= 114.3) {
    return {
      province: '广东省',
      city: '东莞市',
      district: '东莞市区',
      country: '中国',
      locationId: '101281601'
    }
  }
  
  // 苏州市坐标范围大致为：纬度31.0-32.0，经度120.0-121.5
  if (lat >= 31.0 && lat <= 32.0 && lon >= 120.0 && lon <= 121.5) {
    return {
      province: '江苏省',
      city: '苏州市',
      district: '苏州市区',
      country: '中国',
      locationId: '101190401'
    }
  }
  
  // 上海市坐标范围大致为：纬度30.7-31.9，经度120.8-122.2
  if (lat >= 30.7 && lat <= 31.9 && lon >= 120.8 && lon <= 122.2) {
    return {
      province: '上海市',
      city: '上海市',
      district: '上海市区',
      country: '中国',
      locationId: '101020100'
    }
  }
  
  // 广州市坐标范围大致为：纬度22.8-23.6，经度113.0-113.8
  if (lat >= 22.8 && lat <= 23.6 && lon >= 113.0 && lon <= 113.8) {
    return {
      province: '广东省',
      city: '广州市',
      district: '广州市区',
      country: '中国',
      locationId: '101280101'
    }
  }
  
  // 深圳市坐标范围大致为：纬度22.4-22.8，经度113.7-114.6
  if (lat >= 22.4 && lat <= 22.8 && lon >= 113.7 && lon <= 114.6) {
    return {
      province: '广东省',
      city: '深圳市',
      district: '深圳市区',
      country: '中国',
      locationId: '101280601'
    }
  }
  
  // 如果都不匹配，返回通用信息
  let province = '未知省份'
  let city = '未知城市'
  
  // 简单的省份判断
  if (lat >= 22.0 && lat <= 25.5 && lon >= 109.0 && lon <= 117.0) {
    province = '广东省'
    city = '广东某市'
  } else if (lat >= 30.0 && lat <= 35.0 && lon >= 118.0 && lon <= 122.0) {
    province = '江苏省'
    city = '江苏某市'
  }
  
  return {
    province: province,
    city: city,
    district: '市区',
    country: '中国',
    locationId: '000000000'
  }
}



/**
 * 根据天气状况返回对应的emoji
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
 * 获取和风天气错误码对应的错误信息
 * https://dev.qweather.com/docs/resource/status-code/
 */
function getQWeatherErrorMessage(code) {
  const errorMap = {
    '400': '请求错误，可能包含错误的请求参数或缺少必选的请求参数',
    '401': '认证失败，可能使用了错误的KEY、数字签名错误、KEY的类型错误',
    '402': '超过访问次数或余额不足以支持继续访问服务，你可以充值、升级访问量或等待访问量重置',
    '403': '无访问权限，可能是绑定的PackageName、BundleID、域名IP地址不一致，或者是需要额外付费的数据',
    '404': '查询的数据或地区不存在',
    '429': '超过限定的QPM（每分钟访问次数），请参考QPM说明',
    '500': '无响应或超时，接口服务异常请联系我们'
  }
  
  return errorMap[code] || `未知错误码: ${code}`
}