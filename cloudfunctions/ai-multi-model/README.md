# AI多模型智能盘点云函数

## 功能概述

这个云函数为微信小程序提供AI智能盘点服务，支持鹅群数量识别、异常检测和智能建议。

## 核心特性

### 🤖 多模型支持
- **百度AI视觉**：主要的图像识别服务
- **腾讯云AI**：备用图像识别服务
- **智能估算**：基于算法的降级方案
- **多种文本AI**：GLM-4、DeepSeek、Moonshot、Groq

### 📊 智能盘点功能
- 鹅群数量自动识别
- 置信度评估
- 区域检测分析
- 异常个体识别
- 智能建议生成

### 🔄 容错机制
- 自动模型选择和切换
- 智能降级方案
- 缓存机制优化
- 成本控制管理

## 环境变量配置

### 必需配置
```bash
# 百度AI - 图像识别主服务
BAIDU_API_KEY=your_baidu_api_key
BAIDU_SECRET_KEY=your_baidu_secret_key
```

### 可选配置
```bash
# 其他AI服务（按需配置）
GLM4_API_KEY=your_glm4_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key
MOONSHOT_API_KEY=your_moonshot_api_key
GROQ_API_KEY=your_groq_api_key
TENCENT_SECRET_ID=your_tencent_secret_id
TENCENT_SECRET_KEY=your_tencent_secret_key
```

## 部署步骤

### 1. 设置环境变量
在微信开发者工具的云函数控制台中设置环境变量：

1. 右键点击 `ai-multi-model` 云函数
2. 选择"云函数设置"
3. 在"环境变量"选项卡中添加所需的API密钥

### 2. 安装依赖
```bash
cd cloudfunctions/ai-multi-model
npm install
```

### 3. 部署云函数
```bash
# 在微信开发者工具中右键点击云函数文件夹
# 选择"上传并部署：云端安装依赖"
```

## API接口文档

### 图像识别接口

#### 请求参数
```javascript
{
  action: 'image_recognition',
  imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABA...', // base64图像数据
  location: '1号鹅舍',  // 可选，位置信息
  expectedRange: {      // 可选，预期数量范围
    min: 50,
    max: 200
  }
}
```

#### 响应格式
```javascript
{
  success: true,
  data: {
    totalCount: 74,           // 识别到的总数量
    confidence: 85,           // 置信度(0-100)
    location: "1号鹅舍",      // 位置信息
    timestamp: "2025-01-28T02:07:40.000Z",
    recognitionId: "count_1757297260204_abc123def",
    regions: [                // 检测区域
      {
        id: "area_1",
        estimatedCount: 25,
        confidence: 78,
        position: { x: 25.5, y: 30.2 }
      }
    ],
    abnormalDetection: {      // 异常检测
      suspiciousAnimals: 2,
      healthConcerns: [
        "建议对疑似异常个体进行人工检查"
      ]
    },
    suggestions: [            // 智能建议
      "AI识别结果仅供参考，建议结合人工观察",
      "准备出栏时建议多次确认数量"
    ],
    metadata: {
      processedAt: "2025-01-28T02:07:42.150Z",
      version: "1.0.0",
      algorithm: "ai-vision"
    }
  },
  modelId: "baidu-vision",
  processTime: 2150
}
```

## 智能算法说明

### 1. 图像识别流程
1. **预处理**：图像格式转换和优化
2. **AI检测**：调用百度AI进行物体检测
3. **过滤筛选**：识别鹅相关的检测结果
4. **数量估算**：基于检测结果计算数量
5. **置信度评估**：评估识别准确性
6. **异常分析**：检测潜在异常情况

### 2. 智能降级策略
当AI服务不可用时，系统会自动使用智能估算算法：
- 基于图像复杂度分析
- 结合历史数据和位置信息
- 提供合理的数量估计
- 标记为降级结果

### 3. 异常检测机制
- **数量异常**：超出预期范围的提醒
- **质量异常**：识别置信度过低的警告
- **个体异常**：疑似异常个体的标记
- **环境异常**：光线、角度等因素的提示

## 成本优化

### 1. 模型选择策略
- 优先使用免费或低成本模型
- 智能切换备用模型
- 缓存机制减少重复调用

### 2. 用量控制
- 每日调用次数限制
- 成本预算控制
- 使用统计监控

## 错误处理

### 常见错误码
- `-504002`：云函数执行失败
- `API_KEY_INVALID`：API密钥无效
- `QUOTA_EXCEEDED`：调用量超限
- `IMAGE_FORMAT_ERROR`：图像格式错误

### 处理机制
- 自动重试机制
- 降级服务启用
- 详细错误日志
- 用户友好提示

## 监控与维护

### 1. 日志监控
- 查看云函数日志
- 监控API调用次数
- 跟踪错误率

### 2. 性能优化
- 定期清理缓存
- 优化算法参数
- 更新模型配置

## 注意事项

1. **API密钥安全**：绝不在代码中硬编码API密钥
2. **成本控制**：监控API调用费用，设置合理限额
3. **数据隐私**：图像数据不会永久存储
4. **准确性**：AI识别结果仅供参考，重要决策需人工确认
5. **网络依赖**：需要稳定的网络连接调用外部API

## 更新日志

### v1.0.0 (2025-01-28)
- 初始版本发布
- 支持百度AI图像识别
- 智能估算降级方案
- 异常检测功能
- 完整的错误处理机制
