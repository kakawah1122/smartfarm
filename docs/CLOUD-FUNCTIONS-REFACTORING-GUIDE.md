# 云函数拆分执行指南

生成时间：2025-11-23 18:20

## 📋 待办事项总览

### 第一阶段：基础设施准备（Day 1-2）✅ HIGH
- [x] cf-01: 创建云函数拆分基础设施（进行中）
- [ ] cf-02: 运行 refactor-cloud-functions.js
- [ ] cf-03: 复制共享模块到新云函数

### 第二阶段：核心模块拆分（Day 3-7）✅ HIGH  
- [ ] cf-04: health-records 拆分（15个action）
- [ ] cf-05: 迁移健康记录CRUD操作
- [ ] cf-06: 测试health-records所有功能
- [ ] cf-07: health-treatment 拆分（20个action）
- [ ] cf-08: 迁移治疗业务逻辑

### 第三阶段：次要模块拆分（Day 8-10）⚠️ MEDIUM
- [ ] cf-09: health-death 拆分（12个action）
- [ ] cf-10: 迁移死亡记录逻辑
- [ ] cf-13: 创建 ai-services 统一入口
- [ ] cf-14: 增强 ai-learning-cases

### 第四阶段：前端适配（Day 11-12）✅ HIGH
- [ ] cf-11: 创建 cloud-adapter.ts
- [ ] cf-12: 实现 smartCloudCall 函数

### 第五阶段：测试验证（Day 13-15）✅ HIGH
- [ ] cf-15: 创建单元测试脚本
- [ ] cf-16: 执行全量功能测试
- [ ] cf-17: 部署性能监控
- [ ] cf-18: 设置错误告警

### 第六阶段：灰度发布（Day 16-20）📊 LOW
- [ ] cf-19: 10%流量切换
- [ ] cf-20: 50%流量切换
- [ ] cf-21: 全量切换

### 第七阶段：收尾优化（Day 21+）📝 LOW
- [ ] cf-22: 更新API文档
- [ ] cf-23: 编写迁移指南
- [ ] cf-24: 性能优化
- [ ] cf-25: 代码清理

## 🛠️ 执行规范

### 1. 项目规范要求

#### 必须遵守 ⚠️
```javascript
// ✅ 正确：使用统一的collections配置
const { COLLECTIONS } = require('./collections.js')
const result = await db.collection(COLLECTIONS.HEALTH_RECORDS).get()

// ❌ 错误：硬编码集合名
const result = await db.collection('health_records').get()
```

#### 命名规范
- 云函数：小写字母+连字符 `health-records`
- Action名：小写字母+下划线 `create_health_record`
- 文件名：小写字母+连字符 `database-manager.js`

#### 错误处理
```javascript
// 统一的错误返回格式
try {
  // 业务逻辑
  return { success: true, data: result }
} catch (error) {
  console.error('云函数错误:', error)
  return {
    success: false,
    error: error.message || '未知错误'
  }
}
```

### 2. 技术路线

#### 数据库操作
```javascript
// 使用 DatabaseManager 统一管理
const DatabaseManager = require('./database-manager')
const dbManager = new DatabaseManager(db)

// 权限验证
const accessibleBatchIds = await dbManager.getAccessibleBatchIds(openid)
```

#### 分页查询
```javascript
// 大数据量必须分页
const pageSize = 100
let fetched = 0
let hasMore = true

while (hasMore) {
  const res = await db.collection(COLLECTIONS.HEALTH_RECORDS)
    .where(filter)
    .skip(fetched)
    .limit(pageSize)
    .get()
  // ...
}
```

### 3. 最佳实践

#### 云函数超时配置
```json
// package.json
{
  "config": {
    "timeout": 20,    // 最大20秒
    "memory": 128     // 128MB内存
  }
}
```

#### Action数量控制
- 单个云函数：10-15个action
- 超过15个考虑拆分
- 相关功能聚合

#### 性能优化
```javascript
// 并行请求
const [result1, result2] = await Promise.all([
  db.collection(COLLECTIONS.A).get(),
  db.collection(COLLECTIONS.B).get()
])

// 索引优化
// 在云控制台为高频查询字段建立索引
```

## 🔍 测试清单

### 功能测试
- [ ] 每个action独立测试
- [ ] 数据格式兼容性
- [ ] 权限验证正确
- [ ] 错误处理完善

### 性能测试
- [ ] 响应时间 < 500ms
- [ ] 内存占用 < 128MB
- [ ] 并发测试 100 QPS

### 兼容性测试
- [ ] 新旧架构并行
- [ ] 数据格式一致
- [ ] 前端无感知

## ⚠️ 注意事项

### 红线（绝对不能违反）
1. ❌ 不能改变返回数据格式
2. ❌ 不能删除原云函数
3. ❌ 不能破坏前端UI
4. ❌ 不能丢失用户数据

### 黄线（需要特别注意）
1. ⚠️ 保持openid验证逻辑
2. ⚠️ 维护事务一致性
3. ⚠️ 保留原有日志
4. ⚠️ 兼容旧版本调用

## 📝 迁移模板

### Action迁移示例
```javascript
// 原函数：health-management/index.js
case 'create_health_record':
  return await createHealthRecord(event, wxContext)

// 迁移到：health-records/actions/create_health_record.js
exports.main = async (event, wxContext) => {
  const { batchId, recordType, ...data } = event
  
  // 验证权限
  const hasPermission = await checkPermission(wxContext.OPENID, batchId)
  if (!hasPermission) {
    return { success: false, error: '无权限' }
  }
  
  // 业务逻辑（从原函数复制）
  const record = {
    _id: generateRecordId('HR'),
    _openid: wxContext.OPENID,
    batchId,
    recordType,
    ...data,
    createTime: db.serverDate(),
    updateTime: db.serverDate()
  }
  
  // 保存数据
  const res = await db.collection(COLLECTIONS.HEALTH_RECORDS).add({
    data: record
  })
  
  return {
    success: true,
    data: { id: res._id, ...record }
  }
}
```

### 前端调用迁移
```javascript
// 原调用方式
await safeCloudCall({
  name: 'health-management',
  data: { action: 'create_health_record', ...data }
})

// 新调用方式（使用适配器）
import { smartCloudCall } from '@/utils/cloud-adapter'
await smartCloudCall('create_health_record', data)
```

## 🚀 快速开始

```bash
# 1. 生成云函数框架
cd /Users/kaka/Documents/Sync/Windsurf/鹅数通
node scripts/refactor-cloud-functions.js

# 2. 查看生成的文件
ls -la cloudfunctions/health-records/
ls -la cloudfunctions/health-treatment/

# 3. 开始迁移第一个action
# 编辑 cloudfunctions/health-records/actions/create_health_record.js

# 4. 本地测试
# 使用开发者工具测试云函数

# 5. 部署到云端
# 右键云函数目录 -> 上传并部署
```

## 📊 进度跟踪

| 模块 | Action数 | 状态 | 进度 |
|------|---------|------|------|
| health-records | 15 | 🔄 进行中 | 0% |
| health-treatment | 20 | ⏳ 待开始 | 0% |
| health-death | 12 | ⏳ 待开始 | 0% |
| health-abnormal | 10 | ✅ 已存在 | 50% |
| health-prevention | 10 | ✅ 已存在 | 50% |
| health-overview | 14 | ✅ 已存在 | 0% |

---

**执行人**：开发团队  
**审核人**：技术负责人  
**最后更新**：2025-11-23
