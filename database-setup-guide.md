# 🚀 数据库集合自动化设置指南

## 📋 概述

本指南提供了混合自动化方案来设置鹅场管理系统的数据库集合：
- **自动化部分**：集合创建、初始数据插入
- **手动操作**：权限配置、索引创建

## 🤖 第一步：自动创建集合和数据

### 1. 部署云函数

```bash
# 在项目根目录执行
cd cloudfunctions/setup-database-collections
npm install
cd ../..

# 上传云函数
# 在微信开发者工具中右键点击 setup-database-collections 文件夹
# 选择"上传并部署：云端安装依赖"
```

### 2. 执行自动创建脚本

#### 第一优先级集合（权限系统核心）
```javascript
// 在云函数测试中执行
{
  "action": "create_collections",
  "priority": "priority1"
}

// 预期创建集合：
// - roles（包含4个默认角色）
// - permissions（包含基础权限配置）
// - production_batches（空集合）
```

#### 第二优先级集合（健康管理）
```javascript
{
  "action": "create_collections", 
  "priority": "priority2"
}

// 预期创建集合：
// - prevention_records
// - treatment_records  
// - health_alerts
```

#### 第三优先级集合（财务和系统管理）
```javascript
{
  "action": "create_collections",
  "priority": "priority3"
}

// 预期创建集合：
// - cost_records, revenue_records, financial_summaries, financial_reports
// - vaccine_plans, system_configs
```

### 3. 检查创建结果

```javascript
{
  "action": "check_collections"
}

// 返回所有集合的创建状态和记录数量
```

## 🔐 第二步：手动配置权限（必须手动操作）

### 权限配置清单

| 集合名称 | 权限设置 | 控制台操作 |
|---------|---------|-----------|
| **roles** | 🔵 所有用户可读 | 选择第3个选项 |
| **permissions** | 🔴 所有用户不可读写 | 选择第4个选项 |
| **production_batches** | 🟢 所有用户可读，仅创建者可读写 | 选择第1个选项 |
| **prevention_records** | 🟢 所有用户可读，仅创建者可读写 | 选择第1个选项 |
| **treatment_records** | 🟢 所有用户可读，仅创建者可读写 | 选择第1个选项 |
| **health_alerts** | 🔵 所有用户可读 | 选择第3个选项 |
| **cost_records** | 🔴 所有用户不可读写 | 选择第4个选项 |
| **revenue_records** | 🔴 所有用户不可读写 | 选择第4个选项 |
| **financial_summaries** | 🔴 所有用户不可读写 | 选择第4个选项 |
| **financial_reports** | 🔴 所有用户不可读写 | 选择第4个选项 |
| **vaccine_plans** | 🟢 所有用户可读，仅创建者可读写 | 选择第1个选项 |
| **system_configs** | 🔴 所有用户不可读写 | 选择第4个选项 |

### 操作步骤

1. **登录微信云开发控制台**
2. **选择对应环境**
3. **进入数据库管理**
4. **对每个集合进行权限设置**：
   - 点击集合名称
   - 切换到"数据权限"标签
   - 根据上表选择对应的权限选项
   - 点击"确定"保存

## 📊 第三步：创建数据库索引

### 自动获取索引配置

```javascript
{
  "action": "setup_indexes",
  "priority": "priority1"  // 或 priority2, priority3
}

// 返回详细的索引创建指南
```

### 手动创建索引步骤

1. **进入集合的"索引管理"**
2. **点击"添加索引"**
3. **根据配置逐个创建**

#### 关键索引配置（复制使用）

**roles 集合**
```json
[
  {"fields": ["roleCode"], "unique": true},
  {"fields": ["isActive", "level"]},
  {"fields": ["createTime"], "order": "desc"}
]
```

**production_batches 集合**
```json
[
  {"fields": ["_openid", "createTime"], "order": "desc"},
  {"fields": ["batchNumber"], "unique": true}, 
  {"fields": ["status", "createTime"], "order": "desc"}
]
```

**health_alerts 集合**
```json
[
  {"fields": ["status", "severity", "createTime"], "order": "desc"},
  {"fields": ["alertType", "trigger.batchId"]},
  {"fields": ["severity", "createTime"], "order": "desc"}
]
```

## 🔍 第四步：验证设置

### 执行完整验证

```javascript
{
  "action": "full_setup",
  "priority": "priority1"
}

// 执行创建 + 索引配置信息 + 状态检查
```

### 手动验证清单

- [ ] 所有集合都已创建
- [ ] 权限配置正确（可以测试读写操作）
- [ ] 索引已创建（查看索引管理页面）
- [ ] 初始数据正确（查看集合数据）

## ⚠️ 重要注意事项

### 安全相关
1. **🔴 标记的集合包含敏感数据**，确保权限设置为"所有用户不可读写"
2. **财务相关集合需要额外的云函数权限验证**
3. **permissions 集合绝对不能设置为可读**，避免权限信息泄露
4. **使用现有的 admin_logs 替代 audit_logs**，避免功能重复

### 性能相关  
1. **优先创建高频使用集合的索引**
2. **复合索引比单字段索引更高效**
3. **定期监控索引使用情况**

### 业务相关
1. **roles 集合的初始数据包含了4个基础角色**
2. **system_configs 包含了关键系统参数**
3. **权限系统依赖 roles 和 permissions 集合**
4. **操作日志使用现有的 admin_logs 集合**

## 🚀 快速执行脚本

### 完整自动化脚本（除权限配置外）

```javascript
// 第一次执行 - 创建核心集合
{
  "action": "full_setup",
  "priority": "priority1"
}

// 第二次执行 - 创建健康管理集合  
{
  "action": "full_setup",
  "priority": "priority2"
}

// 第三次执行 - 创建财务和系统集合
{
  "action": "full_setup", 
  "priority": "priority3"
}

// 最终检查
{
  "action": "check_collections"
}
```

### 权限配置批量操作

虽然权限必须手动设置，但可以按类别批量操作：

1. **先设置所有 🔴 集合**（6个集合设置为"所有用户不可读写"）
2. **再设置所有 🟢 集合**（4个集合设置为"所有用户可读，仅创建者可读写"）
3. **最后设置 🔵 集合**（2个集合设置为"所有用户可读"）

这样比逐个设置效率更高！

## 📞 问题排查

如果遇到问题，可以：
1. 查看云函数日志
2. 检查集合权限设置
3. 验证索引是否正确创建
4. 测试数据读写功能

---

**预计总耗时**：
- 自动化部分：8分钟
- 权限配置：12分钟  
- 索引创建：18分钟
- 验证测试：8分钟
- **总计：约46分钟**
