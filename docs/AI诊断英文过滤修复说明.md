# AI诊断英文过滤修复说明

## 问题描述

AI诊断返回的疾病名称包含英文，例如：
- ❌ `小鹅瘟（Gosling Plague）`
- ❌ `大肠杆菌病 (E. coli Infection)`
- ❌ `鹅副粘病毒病（Goose Paramyxovirus）`

**期望显示：**
- ✅ `小鹅瘟`
- ✅ `大肠杆菌病`
- ✅ `鹅副粘病毒病`

## 问题根源

虽然云函数prompt已明确要求AI只返回中文病名，但：

1. **疾病知识库影响**：`disease-knowledge.js` 中包含示例英文病原名称（如第32行：`病原：鹅细小病毒（Goose Parvovirus/Derzsy's Disease Virus）`）
2. **AI学习模式**：AI可能学习知识库格式，在 `disease` 字段中也添加英文
3. **缺少后处理**：云函数没有对AI返回结果进行清洗，直接返回给前端

## 解决方案

### 1. 添加清洗函数

**文件**：`cloudfunctions/ai-diagnosis/index.js`

**新增代码**：

```javascript
// 清洗疾病名称：移除英文括号部分
function cleanDiseaseName(diseaseName) {
  if (!diseaseName || typeof diseaseName !== 'string') {
    return diseaseName
  }
  
  // 移除所有括号及其内容（中文括号和英文括号）
  return diseaseName
    .replace(/\s*[\(（]([^)）]*?)[\)）]/g, '')  // 移除括号及内容
    .replace(/\s+/g, '')  // 移除多余空格
    .trim()
}

// 递归清洗诊断结果中的所有disease字段
function cleanDiseaseNames(diagnosisResult) {
  if (!diagnosisResult || typeof diagnosisResult !== 'object') {
    return
  }
  
  // 清洗主要诊断
  if (diagnosisResult.primaryDiagnosis?.disease) {
    diagnosisResult.primaryDiagnosis.disease = cleanDiseaseName(diagnosisResult.primaryDiagnosis.disease)
  }
  
  // 清洗主要死因（死因剖析）
  if (diagnosisResult.primaryCause?.disease) {
    diagnosisResult.primaryCause.disease = cleanDiseaseName(diagnosisResult.primaryCause.disease)
  }
  
  // 清洗鉴别诊断列表
  if (Array.isArray(diagnosisResult.differentialDiagnosis)) {
    diagnosisResult.differentialDiagnosis.forEach(item => {
      if (item.disease) {
        item.disease = cleanDiseaseName(item.disease)
      }
    })
  }
  
  // 清洗可能死因列表（死因剖析）
  if (Array.isArray(diagnosisResult.differentialCauses)) {
    diagnosisResult.differentialCauses.forEach(item => {
      if (item.disease) {
        item.disease = cleanDiseaseName(item.disease)
      }
    })
  }
}
```

### 2. 调用清洗函数

在 `callAIModel()` 函数中，解析JSON后立即清洗：

```javascript
try {
  // 尝试解析JSON响应
  const diagnosisResult = JSON.parse(aiResponse)
  
  // ✅ 清洗疾病名称：移除英文括号部分
  cleanDiseaseNames(diagnosisResult)
  
  return {
    success: true,
    data: {
      ...diagnosisResult,
      // ...
    }
  }
}
```

## 技术架构说明

AI诊断的完整流程：
1. **前端** 调用 `ai-diagnosis` 云函数，创建诊断任务
2. `ai-diagnosis` 在数据库中创建记录，状态为 `processing`
3. `ai-diagnosis` 异步调用 `process-ai-diagnosis` 云函数进行实际AI诊断
4. **`process-ai-diagnosis`** 调用AI模型，解析返回结果，**清洗病名**，保存到数据库
5. **前端** 轮询数据库 `health_ai_diagnosis` 集合，获取诊断结果

**关键发现**：清洗函数必须在 `process-ai-diagnosis` 中执行，因为它是唯一将AI结果保存到数据库的地方。

## 测试验证

**测试用例：**

| 输入 | 输出 |
|------|------|
| `小鹅瘟（Gosling Plague）` | `小鹅瘟` |
| `大肠杆菌病 (E. coli Infection)` | `大肠杆菌病` |
| `鹅副粘病毒病（Goose Paramyxovirus）` | `鹅副粘病毒病` |
| `球虫病` | `球虫病` |

## 部署步骤 ⚠️ 重要

**必须部署两个云函数：**

1. **上传 `process-ai-diagnosis` 云函数（关键！）**
   ```bash
   # 在微信开发者工具中：
   # 1. 右键 cloudfunctions/process-ai-diagnosis 文件夹
   # 2. 选择"上传并部署：云端安装依赖"
   # 3. 等待部署完成
   ```

2. **（可选）上传 `ai-diagnosis` 云函数**
   ```bash
   # 虽然 ai-diagnosis 也有清洗函数，但实际不会执行到
   # 不过为了代码一致性，建议也部署
   ```

3. **验证修复：**
   - 在小程序中**提交一个新的AI诊断**
   - 等待诊断完成（约30-50秒）
   - 检查疾病名称是否只显示中文
   - 确认"小鹅瘟"、"大肠杆菌病"等不再带英文括号
   - **注意**：历史诊断记录不会更新，只有新诊断才会生效

## 优势

1. **防御性编程**：即使AI仍返回英文，云函数也会自动清洗
2. **兼容性强**：同时处理中文括号（）和英文括号()
3. **完整覆盖**：清洗所有可能的disease字段（主诊断、鉴别诊断、死因）
4. **不影响其他字段**：只处理disease字段，不影响reasoning等描述性字段

## 后续建议

1. **监控AI输出**：观察AI是否仍尝试返回英文，如有必要进一步强化prompt
2. **知识库优化**：考虑从 `disease-knowledge.js` 中移除英文病原名称，避免AI学习错误格式
3. **日志记录**：可在清洗函数中记录被过滤的英文内容，用于分析AI行为

---

**修复日期**：2025-01-16  
**修复文件**：
- ✅ `cloudfunctions/process-ai-diagnosis/index.js`（关键！必须部署）
- `cloudfunctions/ai-diagnosis/index.js`（可选）

**影响范围**：AI智能诊断、死因剖析功能  
**状态**：✅ 已修复，等待部署验证
