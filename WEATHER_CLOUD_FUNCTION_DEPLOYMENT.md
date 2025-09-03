# 和风天气云函数部署指南

## 🌟 功能概述

基于微信小程序云函数最佳实践，重构了天气云函数以提供：

### ✨ 核心功能
- **实时天气数据** - 当前天气状况、温度、湿度等
- **24小时预报** - 逐小时天气变化趋势
- **7天预报** - 每日天气预测
- **空气质量** - AQI指数和各项污染物数据
- **极端天气预警** - 实时预警信息推送
- **完整天气数据** - 并发获取所有类型天气数据

### 🔧 技术特性
- **智能缓存** - 30分钟缓存机制，减少API调用
- **错误重试** - 指数退避算法，提高成功率
- **多端点支持** - 自动故障转移，保证服务可用性
- **坐标转换** - GCJ02到WGS84坐标系转换
- **标准化响应** - 统一的错误处理和响应格式

## 📋 部署前准备

### 1. 获取和风天气API密钥
1. 访问 [和风天气开发平台](https://dev.qweather.com)
2. 注册账号并完成认证
3. 创建应用并获取API Key

### 2. 配置云函数环境变量
在微信小程序云开发控制台设置环境变量：

```bash
# 必需环境变量
HEFENG_API_KEY=your_actual_api_key_here
```

### 3. 创建数据库集合
创建缓存数据库集合：

```javascript
// 集合名：weather_cache
// 字段说明：
{
  "key": "string",        // 缓存键 (格式: type_location)
  "data": "object",       // 缓存的天气数据
  "expireAt": "date",     // 过期时间
  "createdAt": "date"     // 创建时间
}
```

### 4. 设置数据库索引
为提高查询性能，创建索引：

```javascript
// 在 weather_cache 集合上创建索引
db.collection('weather_cache').createIndex({
  key: 1,
  expireAt: 1
})
```

## 🚀 部署步骤

### 1. 上传云函数代码
```bash
# 方法一：使用微信开发者工具
# 右键 cloudfunctions/weather 文件夹 → 上传并部署

# 方法二：使用命令行工具
cd cloudfunctions/weather
npm install  # 如果有新依赖
```

### 2. 配置云函数设置
在云开发控制台 → 云函数 → weather 函数：

| 配置项 | 推荐值 | 说明 |
|--------|--------|------|
| 内存 | 256MB | 足够处理并发请求 |
| 超时时间 | 60秒 | 处理完整天气请求 |
| 环境变量 | HEFENG_API_KEY | 和风天气API密钥 |

### 3. 测试云函数
使用以下测试用例验证部署：

```javascript
// 测试用例1：获取当前天气
{
  "action": "getCurrentWeather",
  "lat": 31.2304,
  "lon": 121.4737
}

// 测试用例2：获取完整天气数据
{
  "action": "getCompleteWeather", 
  "lat": 31.2304,
  "lon": 121.4737,
  "useCache": true
}
```

## 📞 API调用说明

### 支持的操作类型

| action | 说明 | 返回数据 |
|--------|------|----------|
| `getCurrentWeather` | 获取实时天气 | 温度、湿度、风速等 |
| `getHourlyForecast` | 24小时预报 | 逐小时天气变化 |
| `getDailyForecast` | 7天预报 | 每日最高最低温度 |
| `getAirQuality` | 空气质量 | AQI、PM2.5等指标 |
| `getWeatherWarning` | 天气预警 | 极端天气警告信息 |
| `getCompleteWeather` | 完整天气数据 | 以上所有数据的组合 |

### 调用示例

```javascript
// 小程序端调用
wx.cloud.callFunction({
  name: 'weather',
  data: {
    action: 'getCompleteWeather',
    lat: 31.2304,
    lon: 121.4737,
    useCache: true  // 是否使用缓存
  },
  success: res => {
    console.log('天气数据:', res.result)
    if (res.result.success) {
      // 处理成功响应
      const weatherData = res.result.data
    } else {
      // 处理错误
      console.error('获取天气失败:', res.result.error)
    }
  },
  fail: err => {
    console.error('云函数调用失败:', err)
  }
})
```

### 响应格式

```javascript
// 成功响应
{
  "success": true,
  "data": {
    "current": { /* 实时天气数据 */ },
    "hourly": [ /* 24小时预报数据 */ ],
    "daily": [ /* 7天预报数据 */ ],
    "air": { /* 空气质量数据 */ },
    "warning": [ /* 预警信息 */ ]
  },
  "meta": {
    "requestId": "unique_request_id",
    "executionTime": 1250,
    "timestamp": "2024-01-01T12:00:00.000Z",
    "cached": false
  }
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "INVALID_COORDINATES",
    "message": "经纬度参数超出全球有效范围",
    "requestId": "unique_request_id",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## 🎯 性能优化

### 缓存策略
- **缓存时长**: 30分钟
- **缓存键格式**: `{type}_{location}`
- **自动过期**: 使用数据库TTL自动清理

### 网络优化
- **多端点支持**: 主端点 → 商业端点 → 自定义端点
- **重试机制**: 最多重试2次，指数退避
- **超时设置**: 8秒请求超时

### 并发处理
- **Promise.allSettled**: 并发获取所有天气数据
- **容错处理**: 单个接口失败不影响其他数据

## 🐛 常见问题

### 1. API密钥相关
**问题**: `MISSING_API_KEY` 错误
**解决**: 确保在云函数环境变量中设置了正确的 `HEFENG_API_KEY`

### 2. 坐标超出范围
**问题**: `INVALID_COORDINATES` 错误
**解决**: 检查传入的经纬度是否在有效范围内 (-90~90, -180~180)

### 3. 缓存问题
**问题**: 缓存读写失败
**解决**: 确保数据库权限正确配置，weather_cache集合已创建

### 4. 网络超时
**问题**: 请求超时错误
**解决**: 检查网络连接，或增加超时时间配置

## 📊 监控和日志

### 关键指标监控
- 请求成功率
- 平均响应时间
- 缓存命中率
- 错误码分布

### 日志关键字
```bash
# 搜索关键字
"天气API云函数"     # 函数入口日志
"API调用成功"       # 成功调用
"缓存命中"          # 缓存使用
"❌"               # 错误日志
"重试"             # 重试机制
```

## 🔒 安全注意事项

1. **API密钥保护**: 绝不要在客户端代码中暴露API密钥
2. **参数验证**: 云函数对所有输入参数进行严格验证
3. **日志脱敏**: 敏感信息在日志中被脱敏处理
4. **访问限制**: 建议设置适当的API调用频率限制

## 📈 版本历史

### v2.0.0 (当前版本)
- ✅ 重构为企业级规范
- ✅ 添加智能缓存机制
- ✅ 实现多端点故障转移
- ✅ 统一错误处理和响应格式
- ✅ 添加详细的性能监控

### v1.0.0 (基础版本)
- ✅ 基本天气数据获取
- ✅ 坐标系转换
- ✅ 简单错误处理

---

## 🎉 部署完成检查清单

- [ ] ✅ API密钥已配置
- [ ] ✅ 数据库集合已创建
- [ ] ✅ 云函数已上传并部署
- [ ] ✅ 环境变量已设置
- [ ] ✅ 测试用例通过
- [ ] ✅ 缓存机制工作正常
- [ ] ✅ 错误处理验证完成

部署完成后，您的小程序即可享受稳定、高效的天气服务！🌤️
