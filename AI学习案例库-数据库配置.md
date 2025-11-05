# AI学习案例库 - 数据库配置快速指南

## 📋 集合信息

**集合名称**：`ai_learning_cases`  
**用途**：AI识别学习案例库（多特征融合版）  
**权限类型**：所有用户可读、创建者可读写

---

## 🚀 快速配置步骤

### Step 1：创建集合

1. 登录[微信云开发控制台](https://console.cloud.tencent.com/)
2. 选择环境 → 数据库 → 点击"添加集合"
3. 集合名称：`ai_learning_cases`
4. 权限设置：选择"所有用户可读、创建者可读写"
5. 点击"确定"创建

---

### Step 2：创建索引

#### 索引1：相似场景查询索引 ⭐（最重要）

```
索引名称：sceneFeatures.crowding_1_sceneFeatures.occlusion_level_1_accuracy_-1
索引属性：非唯一

字段配置：
1. 字段：sceneFeatures.crowding，排序：升序(1)
2. 字段：sceneFeatures.occlusion_level，排序：升序(1)  
3. 字段：accuracy，排序：降序(-1)
```

**配置步骤**：
1. 进入 ai_learning_cases 集合 → 索引标签
2. 点击"添加索引"
3. 索引名称填入：`sceneFeatures.crowding_1_sceneFeatures.occlusion_level_1_accuracy_-1`
4. 索引属性：保持"非唯一"
5. 添加索引字段：
   - 点击"添加字段" → 字段名：`sceneFeatures.crowding` → 排序：选择"升序(1)"
   - 点击"添加字段" → 字段名：`sceneFeatures.occlusion_level` → 排序：选择"升序(1)"
   - 点击"添加字段" → 字段名：`accuracy` → 排序：选择"降序(-1)"
6. 点击"确定"

---

#### 索引2：时间排序索引

```
索引名称：createTime_-1
索引属性：非唯一

字段配置：
1. 字段：createTime，排序：降序(-1)
```

**配置步骤**：
1. 点击"添加索引"
2. 索引名称：`createTime_-1`
3. 添加字段：`createTime`，排序：降序(-1)
4. 点击"确定"

---

#### 索引3：准确率过滤索引

```
索引名称：accuracy_-1_used_1
索引属性：非唯一

字段配置：
1. 字段：accuracy，排序：降序(-1)
2. 字段：used，排序：升序(1)
```

**配置步骤**：
1. 点击"添加索引"
2. 索引名称：`accuracy_-1_used_1`
3. 添加字段：
   - `accuracy`，排序：降序(-1)
   - `used`，排序：升序(1)
4. 点击"确定"

---

#### 索引4：偏差类型统计索引

```
索引名称：deviationType_1_createTime_-1
索引属性：非唯一

字段配置：
1. 字段：deviationType，排序：升序(1)
2. 字段：createTime，排序：降序(-1)
```

**配置步骤**：
1. 点击"添加索引"
2. 索引名称：`deviationType_1_createTime_-1`
3. 添加字段：
   - `deviationType`，排序：升序(1)
   - `createTime`，排序：降序(-1)
4. 点击"确定"

---

## 📊 数据结构示例

```javascript
{
  "_id": "auto_generated_id",
  "imageFileID": "cloud://prod-xxx.7072-prod-xxx/ai-count/xxx.jpg",
  "aiCount": 25,
  "correctCount": 28,
  "accuracy": 0.89,
  "deviation": -3,
  "deviationType": "under_count",
  
  "sceneFeatures": {
    "lighting": "good",
    "crowding": "moderate",
    "occlusion_level": "medium",
    "imageQuality": "good"
  },
  
  "featureBreakdown": {
    "tier1_complete": 15,
    "tier2_partial": 8,
    "tier3_inferred": 2,
    "excluded_lowConfidence": 5
  },
  
  "errorAnalysis": {
    "tier1_ratio": 0.60,
    "tier2_ratio": 0.32,
    "tier3_ratio": 0.08,
    "possible_reason": "tier2阈值过严，遗漏了3个遮挡个体"
  },
  
  "operator": "张三",
  "createTime": Date,
  "used": false,
  "useCount": 0
}
```

---

## ✅ 验证配置

### 检查清单

- [ ] 集合 `ai_learning_cases` 已创建
- [ ] 权限设置为"所有用户可读、创建者可读写"
- [ ] 索引1（相似场景查询）已创建
- [ ] 索引2（时间排序）已创建
- [ ] 索引3（准确率过滤）已创建
- [ ] 索引4（偏差类型统计）已创建

### 测试验证

在云开发控制台 → 数据库 → ai_learning_cases → 索引标签，确认看到4个索引：

```
✓ sceneFeatures.crowding_1_sceneFeatures.occlusion_level_1_accuracy_-1
✓ createTime_-1
✓ accuracy_-1_used_1
✓ deviationType_1_createTime_-1
```

---

## 💡 索引作用说明

| 索引 | 用途 | 使用场景 |
|------|------|---------|
| **索引1** | Few-shot Learning相似场景查询 | AI识别时加载相似案例 |
| **索引2** | 按时间倒序排列 | 获取最新学习案例 |
| **索引3** | 筛选高质量未使用案例 | 避免重复使用同一案例 |
| **索引4** | 统计偏差类型分布 | 动态阈值调整分析 |

---

## 🔧 常见问题

### Q1：为什么索引1有3个字段？
A：用于Few-shot Learning的多条件查询，同时匹配密度、遮挡程度，并按准确率排序找到最佳案例。

### Q2：索引名称能自定义吗？
A：可以，但建议使用推荐的命名格式（`字段名_排序方向`），便于识别和维护。

### Q3：如果索引创建失败怎么办？
A：
1. 检查字段名是否正确（注意大小写和点号）
2. 确认排序方向：1=升序，-1=降序
3. 如果提示冲突，先删除旧索引再创建

### Q4：索引占用多少存储空间？
A：索引会占用一定存储空间，但通常小于原数据的20%。对于学习案例库（预计数百条记录），影响可忽略不计。

---

## 📚 相关文档

- [DATABASE_CONFIG_GUIDE.md](./DATABASE_CONFIG_GUIDE.md) - 完整数据库配置指南
- [多特征融合识别方案-最终版.md](./多特征融合识别方案-最终版.md) - AI技术方案
- [AI自学习系统说明.md](./AI自学习系统说明.md) - 学习系统原理

---

## ⏱️ 预计配置时间

**总时间**：10-15分钟
- 创建集合：2分钟
- 创建4个索引：8-10分钟
- 验证测试：3分钟

---

## 🎉 配置完成后

配置完成后，部署云函数并重新编译小程序即可使用AI自学习功能：

```bash
cd "/Users/kaka/Documents/Sync/小程序/鹅数通"
./deploy-ai-learning.sh
```

---

**文档版本**：v1.0  
**创建时间**：2025年11月5日  
**适用项目**：鹅数通 - AI多特征融合识别系统

