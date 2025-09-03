# 智慧养鹅小程序 - 天气模块文档

## 📋 模块概述

基于地理位置的天气预报功能，使用和风天气API提供准确的实时天气信息。

### 🎯 核心功能
- ✅ 自动获取用户GPS位置
- ✅ 实时天气数据展示
- ✅ 智能位置识别（支持全国主要城市）
- ✅ 缓存机制优化性能
- ✅ 完善的错误处理和降级策略

## 🏗️ 架构设计

### 技术栈
- **前端**: 微信小程序原生开发
- **后端**: 腾讯云云函数
- **API**: 和风天气API
- **坐标系**: GCJ02 → WGS84 转换

### 数据流程
```
用户位置获取 → GPS坐标 → 云函数处理 → 和风天气API → 天气数据 → 前端展示
```

## 📁 文件结构

```
├── cloudfunctions/weather/          # 天气云函数
│   ├── index.js                    # 主逻辑文件
│   ├── package.json                # 依赖配置
│   └── node_modules/               # 依赖包
├── miniprogram/pages/index/        # 首页（包含天气模块）
│   ├── index.ts                    # 页面逻辑
│   ├── index.wxml                  # 页面结构
│   ├── index.scss                  # 页面样式
│   └── index.json                  # 页面配置
└── miniprogram/app.json            # 位置权限配置
```

## 🔧 配置要求

### 1. 环境变量配置
在云开发控制台设置：
```
HEFENG_API_KEY = 您的和风天气API密钥
```

### 2. 域名白名单配置
在微信公众平台添加以下域名：
```
https://n96apwfjn2.re.qweatherapi.com  # 专用API Host
https://devapi.qweather.com            # 免费版端点
https://api.qweather.com               # 商业版端点
```

### 3. 位置权限配置
在 `app.json` 中已配置：
```json
{
  "permission": {
    "scope.userLocation": {
      "desc": "您的位置信息将用于获取当地天气信息"
    }
  },
  "requiredPrivateInfos": [
    "getLocation"
  ]
}
```

## 🔍 核心功能实现

### 1. 位置获取
```typescript
// 获取用户GPS坐标 - 标准微信小程序实现
wx.getLocation({
  type: 'gcj02',           // 微信小程序标准坐标系
  isHighAccuracy: true,    // 高精度定位
  success: (locationRes) => {
    // 调用云函数获取天气
  }
})
```

### 2. 坐标系转换
```javascript
// GCJ02 → WGS84 精确转换算法
function gcj02ToWgs84(lat, lon) {
  // 使用标准转换算法
  // 确保和风天气API坐标准确性
}
```

### 3. 智能城市识别
```javascript
// 基于坐标智能推测城市
function estimateCityFromCoords(lat, lon) {
  // 支持东莞、苏州、上海、广州、深圳等主要城市
  // 坐标范围精确匹配
}
```

### 4. API调用
```javascript
// 和风天气API标准调用
const apiParams = {
  location: `${lon},${lat}`,  // 经度,纬度格式
  lang: 'zh',                 // 中文响应
  key: HEFENG_API_KEY        // API密钥
}
```

## 📊 数据格式

### 输入数据
```javascript
{
  action: 'getCurrentWeather',
  lat: 23.0007,              // 纬度
  lon: 113.7399              // 经度
}
```

### 输出数据
```javascript
{
  success: true,
  source: 'qweather_api',
  data: {
    current: {
      temperature: 26,         // 温度
      feelsLike: 29,          // 体感温度
      humidity: 90,           // 湿度
      weather: '多云',         // 天气状况
      windDirection: '东风',    // 风向
      windScale: '3级',       // 风力等级
      updateTime: '2024-12-19T...'
    },
    condition: {
      text: '多云',
      icon: '104',
      emoji: '⛅'
    },
    locationInfo: {
      province: '广东省',
      city: '东莞市',
      district: '东莞市区',
      country: '中国'
    }
  }
}
```

## ⚡ 性能优化

### 1. 缓存策略
- **缓存时长**: 1小时
- **缓存键**: `weather_cache`
- **缓存内容**: 完整天气数据
- **缓存清除**: 手动刷新时自动清除

### 2. 容错机制
- **多端点支持**: 专用Host → 免费版 → 商业版
- **智能降级**: API失败时使用坐标推测位置
- **错误重试**: 网络异常自动重试

### 3. 用户体验
- **加载提示**: 实时显示获取状态
- **精度检查**: 定位精度过低时提醒用户
- **权限引导**: 位置权限被拒绝时友好提示

## 🛠️ 部署流程

### 1. 云函数部署
```bash
# 在微信开发者工具中
右键 cloudfunctions/weather 文件夹
→ 选择"上传并部署：云端安装依赖"
→ 等待部署完成
```

### 2. 环境变量设置
```bash
# 在云开发控制台
1. 进入"环境" → "云函数" → "环境配置"
2. 添加环境变量：HEFENG_API_KEY
3. 值为您的和风天气API密钥
```

### 3. 域名白名单
```bash
# 在微信公众平台
1. 登录小程序管理后台
2. 开发 → 开发管理 → 开发设置
3. 服务器域名 → request合法域名
4. 添加上述三个和风天气域名
```

## 🔍 调试方法

### 1. 云函数日志
```javascript
// 关键日志标识
=== 和风天气API云函数开始 ===
📍 接收到坐标 (GCJ02): 23.0007, 113.7399
📍 转换后坐标 (WGS84): 22.9965, 113.7352
🔄 尝试专用API Host 1/3: https://n96apwfjn2.re.qweatherapi.com
✅ API调用成功 (500ms)
✅ 天气数据获取成功
```

### 2. 前端调试
```javascript
// 双击天气卡片进入调试模式
console.log('🎨 更新天气UI，接收到的数据:', weatherData)
console.log('📍 位置信息:', weatherData.locationInfo)
```

### 3. 常见问题
| 错误码 | 问题 | 解决方案 |
|--------|------|----------|
| 403 | 域名未白名单 | 检查微信公众平台域名配置 |
| 401 | API密钥错误 | 检查环境变量设置 |
| 404 | 位置不存在 | 检查坐标格式和转换 |

## 📈 使用统计

### API调用限制
- **免费版**: 每天1000次，每分钟10次
- **专用Host**: 根据和风天气配置的具体限制

### 性能指标
- **响应时间**: 通常 < 1秒
- **成功率**: > 95%
- **缓存命中**: 约 60-70%

## 🔒 安全考虑

### 1. API密钥保护
- 使用云函数环境变量存储
- 避免在前端代码中暴露
- 日志中自动隐藏密钥

### 2. 权限控制
- 严格的位置权限申请流程
- 用户友好的权限说明
- 权限被拒绝时的降级处理

### 3. 数据隐私
- 位置数据仅用于天气查询
- 不存储用户位置信息
- 符合微信小程序隐私规范

## 🚀 未来扩展

### 计划功能
- [ ] 7天天气预报
- [ ] 天气预警推送
- [ ] 多地点天气对比
- [ ] 天气历史记录

### 技术优化
- [ ] WebSocket实时更新
- [ ] 更精细的位置识别
- [ ] 离线天气数据支持
- [ ] 天气数据可视化

---

## 📞 技术支持

### 维护联系
- **云函数**: 腾讯云云开发控制台
- **API服务**: 和风天气开发者平台
- **小程序**: 微信公众平台

### 相关文档
- [和风天气API文档](https://dev.qweather.com/docs/)
- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/)
- [腾讯云云开发文档](https://cloud.tencent.com/product/tcb)

---

**智慧养鹅小程序天气模块 v2.0** 🌤️

*文档版本: 2024年12月*
