# 🗄️ 鹅场管理系统数据库完整重建指南

## 📋 项目数据库架构概述

### 🎯 设计原则
- **模块化设计**：按业务模块划分集合
- **权限分级**：基于角色的精细化权限控制
- **性能优化**：合理的索引设计保证查询效率
- **扩展性强**：支持未来业务扩展

### 📊 业务模块分析
```
鹅场管理系统 (35个集合)
├── 👥 用户管理模块 (4个集合)
├── 🏭 生产管理模块 (6个集合)  
├── 🏥 健康管理模块 (9个集合)
├── 💰 财务管理模块 (4个集合)
├── 🔔 通知系统模块 (3个集合)
├── 📁 文件管理模块 (2个集合)
├── 🤖 AI功能模块 (3个集合)
└── ⚙️ 系统管理模块 (4个集合)
```

## 📝 完整数据库集合清单

### 👥 **用户管理模块 (4个集合)**

| 集合名称 | 功能描述 | 权限等级 | 优先级 |
|---------|---------|---------|--------|
| `users` | 用户基础信息 | 🟠 仅创建者可读写 | P1 |
| `roles` | 角色定义 | 🔵 所有用户可读 | P1 |
| `permissions` | 权限配置 | 🔴 所有用户不可读写 | P1 |
| `employee_invites` | 员工邀请码 | 🟢 所有用户可读，仅创建者可读写 | P2 |

### 🏭 **生产管理模块 (6个集合)**

| 集合名称 | 功能描述 | 权限等级 | 优先级 |
|---------|---------|---------|--------|
| `production_batches` | 生产批次管理 | 🟢 所有用户可读，仅创建者可读写 | P1 |
| `entry_records` | 入栏记录 | 🟢 所有用户可读，仅创建者可读写 | P1 |
| `exit_records` | 出栏记录 | 🟢 所有用户可读，仅创建者可读写 | P1 |
| `material_records` | 物料使用记录 | 🟢 所有用户可读，仅创建者可读写 | P2 |
| `materials` | 物料库存管理 | 🟢 所有用户可读，仅创建者可读写 | P2 |
| `inventory_logs` | 库存变动日志 | 🔵 所有用户可读 | P2 |

### 🏥 **健康管理模块 (9个集合)**

| 集合名称 | 功能描述 | 权限等级 | 优先级 |
|---------|---------|---------|--------|
| `health_records` | 健康记录 | 🟢 所有用户可读，仅创建者可读写 | P1 |
| `ai_diagnosis_records` | AI诊断记录 | 🟢 所有用户可读，仅创建者可读写 | P1 |
| `prevention_records` | 预防记录(疫苗消毒) | 🟢 所有用户可读，仅创建者可读写 | P2 |
| `treatment_records` | 治疗记录 | 🟢 所有用户可读，仅创建者可读写 | P2 |
| `vaccine_plans` | 疫苗计划 | 🟢 所有用户可读，仅创建者可读写 | P2 |
| `health_alerts` | 健康预警 | 🔵 所有用户可读 | P2 |
| `death_records` | 死亡记录 | 🟢 所有用户可读，仅创建者可读写 | P2 |
| `followup_records` | 跟进记录 | 🟢 所有用户可读，仅创建者可读写 | P3 |
| `cure_records` | 治愈记录 | 🟢 所有用户可读，仅创建者可读写 | P3 |

### 💰 **财务管理模块 (4个集合)**

| 集合名称 | 功能描述 | 权限等级 | 优先级 |
|---------|---------|---------|--------|
| `cost_records` | 成本记录 | 🔴 所有用户不可读写 | P3 |
| `revenue_records` | 收入记录 | 🔴 所有用户不可读写 | P3 |
| `financial_summaries` | 财务汇总 | 🔴 所有用户不可读写 | P3 |
| `financial_reports` | 财务报表 | 🔴 所有用户不可读写 | P3 |

### 🔔 **通知系统模块 (3个集合)**

| 集合名称 | 功能描述 | 权限等级 | 优先级 |
|---------|---------|---------|--------|
| `notifications` | 全局通知 | 🔵 所有用户可读 | P2 |
| `user_notifications` | 用户通知状态 | 🟠 仅创建者可读写 | P2 |
| `user_notification_settings` | 用户通知设置 | 🟠 仅创建者可读写 | P3 |

### 📁 **文件管理模块 (2个集合)**

| 集合名称 | 功能描述 | 权限等级 | 优先级 |
|---------|---------|---------|--------|
| `file_records` | 静态文件记录 | 🟢 所有用户可读，仅创建者可读写 | P3 |
| `dynamic_file_records` | 动态文件记录 | 🟢 所有用户可读，仅创建者可读写 | P3 |

### 🤖 **AI功能模块 (3个集合)**

| 集合名称 | 功能描述 | 权限等级 | 优先级 |
|---------|---------|---------|--------|
| `ai_cache` | AI诊断缓存 | 🔴 所有用户不可读写 | P3 |
| `ai_usage` | AI使用统计 | 🔴 所有用户不可读写 | P3 |
| `storage_statistics` | 存储统计 | 🔵 所有用户可读 | P3 |

### ⚙️ **系统管理模块 (4个集合)**

| 集合名称 | 功能描述 | 权限等级 | 优先级 |
|---------|---------|---------|--------|
| `system_configs` | 系统配置 | 🔴 所有用户不可读写 | P2 |
| `admin_logs` | 管理操作日志 | 🔴 所有用户不可读写 | P3 |
| `approval_logs` | 审批流程日志 | 🟢 所有用户可读，仅创建者可读写 | P3 |
| `cleanup_logs` | 数据清理日志 | 🔴 所有用户不可读写 | P3 |

---

## 🔐 权限配置详细方案

### 权限等级图例
- 🔴 **所有用户不可读写** - 敏感系统数据，仅云函数访问
- 🔵 **所有用户可读** - 公共参考数据，系统生成
- 🟢 **所有用户可读，仅创建者可读写** - 业务数据，协作共享
- 🟠 **仅创建者可读写** - 个人私有数据

### 按权限等级分组配置

#### 🔴 **敏感数据集合 (9个) - "所有用户不可读写"**
```
permissions, cost_records, revenue_records, financial_summaries, 
financial_reports, ai_cache, ai_usage, system_configs, admin_logs, cleanup_logs
```

#### 🔵 **公共数据集合 (4个) - "所有用户可读"**
```
roles, inventory_logs, health_alerts, notifications, storage_statistics
```

#### 🟢 **协作数据集合 (19个) - "所有用户可读，仅创建者可读写"**
```
production_batches, entry_records, exit_records, material_records, materials,
health_records, ai_diagnosis_records, prevention_records, treatment_records,
vaccine_plans, death_records, followup_records, cure_records, employee_invites,
file_records, dynamic_file_records, approval_logs
```

#### 🟠 **私有数据集合 (3个) - "仅创建者可读写"**
```
users, user_notifications, user_notification_settings
```

---

## 📊 索引配置方案

### 通用索引原则
1. **用户数据索引**：`{"fields": ["_openid", "createTime"], "order": "desc"}`
2. **状态查询索引**：`{"fields": ["status", "createTime"], "order": "desc"}`
3. **软删除索引**：`{"fields": ["isDeleted", "createTime"]}`
4. **业务主键索引**：唯一性约束字段

### P1优先级集合索引 (核心业务)

#### `users` - 用户信息
```json
[
  {"fields": ["_openid"], "unique": true},
  {"fields": ["role", "status"]},
  {"fields": ["phone"], "unique": true},
  {"fields": ["createTime"], "order": "desc"}
]
```

#### `roles` - 角色定义
```json
[
  {"fields": ["roleCode"], "unique": true},
  {"fields": ["isActive", "level"]},
  {"fields": ["createTime"], "order": "desc"}
]
```

#### `permissions` - 权限配置
```json
[
  {"fields": ["module", "action"], "unique": true},
  {"fields": ["module", "isActive"]},
  {"fields": ["resource", "isActive"]}
]
```

#### `production_batches` - 生产批次
```json
[
  {"fields": ["_openid", "createTime"], "order": "desc"},
  {"fields": ["batchNumber"], "unique": true},
  {"fields": ["status", "createTime"], "order": "desc"},
  {"fields": ["expectedStartDate", "expectedEndDate"]},
  {"fields": ["isDeleted", "status"]}
]
```

#### `entry_records` - 入栏记录
```json
[
  {"fields": ["_openid", "createTime"], "order": "desc"},
  {"fields": ["batchNumber", "createTime"], "order": "desc"},
  {"fields": ["status", "createTime"], "order": "desc"},
  {"fields": ["quantity", "createTime"]},
  {"fields": ["isDeleted", "createTime"]}
]
```

#### `exit_records` - 出栏记录
```json
[
  {"fields": ["_openid", "createTime"], "order": "desc"},
  {"fields": ["batchNumber", "createTime"], "order": "desc"},
  {"fields": ["exitReason", "createTime"], "order": "desc"},
  {"fields": ["quantity", "totalRevenue"]},
  {"fields": ["isDeleted", "createTime"]}
]
```

#### `health_records` - 健康记录
```json
[
  {"fields": ["_openid", "createTime"], "order": "desc"},
  {"fields": ["batchNumber", "result"]},
  {"fields": ["diagnosisDisease", "severity"]},
  {"fields": ["status", "createTime"], "order": "desc"},
  {"fields": ["affectedCount", "createTime"]},
  {"fields": ["isDeleted", "result"]}
]
```

#### `ai_diagnosis_records` - AI诊断记录
```json
[
  {"fields": ["_openid", "createTime"], "order": "desc"},
  {"fields": ["healthRecordId", "createTime"]},
  {"fields": ["confidence", "status"]},
  {"fields": ["diagnosisResult", "confidence"], "order": "desc"},
  {"fields": ["isDeleted", "status"]}
]
```

### P2优先级集合索引 (重要业务)

#### `prevention_records` - 预防记录
```json
[
  {"fields": ["_openid", "createTime"], "order": "desc"},
  {"fields": ["batchId", "preventionType", "executionDate"]},
  {"fields": ["preventionType", "executionDate"], "order": "desc"},
  {"fields": ["effectiveness", "preventionType"]},
  {"fields": ["isDeleted", "createTime"]}
]
```

#### `treatment_records` - 治疗记录
```json
[
  {"fields": ["_openid", "createTime"], "order": "desc"},
  {"fields": ["healthRecordId", "treatmentDate"], "order": "desc"},
  {"fields": ["batchId", "outcome.status"]},
  {"fields": ["diagnosis", "treatmentType"]},
  {"fields": ["isDeleted", "treatmentDate"]}
]
```

#### `health_alerts` - 健康预警
```json
[
  {"fields": ["status", "severity", "createTime"], "order": "desc"},
  {"fields": ["alertType", "trigger.batchId"]},
  {"fields": ["severity", "createTime"], "order": "desc"},
  {"fields": ["handling.acknowledgedBy", "status"]}
]
```

### P3优先级集合索引 (财务和系统)

#### 财务相关集合
```json
// cost_records, revenue_records
[
  {"fields": ["_openid", "createTime"], "order": "desc"},
  {"fields": ["costType/revenueType", "createTime"], "order": "desc"},
  {"fields": ["amount", "createTime"], "order": "desc"},
  {"fields": ["status", "createTime"], "order": "desc"}
]

// financial_summaries
[
  {"fields": ["period", "periodType"], "unique": true},
  {"fields": ["periodType", "periodStart"], "order": "desc"},
  {"fields": ["generatedTime"], "order": "desc"}
]
```

---

## 🚀 完整执行指南

### **第一阶段：数据库清理与准备**

#### 1. 清空现有数据库
1. 登录微信云开发控制台
2. 进入数据库管理
3. 逐个删除现有的23个集合（请先备份重要数据）

#### 2. 环境检查
- 确认云开发环境正常
- 检查云函数权限
- 确认存储空间充足

### **第二阶段：按优先级创建集合**

#### P1 优先级 - 核心业务集合 (8个)
**立即创建，系统运行基础**

1. **用户权限系统**：
   ```
   users → roles → permissions
   ```

2. **生产核心**：
   ```
   production_batches → entry_records → exit_records
   ```

3. **健康核心**：
   ```
   health_records → ai_diagnosis_records
   ```

**创建步骤**：
1. 在控制台点击"添加集合"
2. 依次输入集合名称并创建
3. 立即设置权限（按权限等级表配置）
4. 创建核心索引（用户查询、时间排序）

#### P2 优先级 - 重要业务集合 (11个)  
**本周内创建，完善业务功能**

**健康管理扩展**：
```
prevention_records → treatment_records → vaccine_plans → health_alerts → death_records
```

**生产管理扩展**：
```
material_records → materials → inventory_logs
```

**系统功能**：
```
employee_invites → notifications → user_notifications → system_configs
```

#### P3 优先级 - 辅助功能集合 (16个)
**计划内创建，完善系统功能**

**财务模块**：
```
cost_records → revenue_records → financial_summaries → financial_reports
```

**AI和文件**：
```
ai_cache → ai_usage → file_records → dynamic_file_records
```

**系统管理**：
```
admin_logs → approval_logs → cleanup_logs → user_notification_settings → storage_statistics
```

**其他健康功能**：
```
followup_records → cure_records
```

### **第三阶段：权限配置**

#### 批量权限配置策略
1. **先配置🔴敏感集合**（9个）：选择"所有用户不可读写"
2. **再配置🟢协作集合**（19个）：选择"所有用户可读，仅创建者可读写"  
3. **然后配置🟠私有集合**（3个）：选择"仅创建者可读写"
4. **最后配置🔵公共集合**（4个）：选择"所有用户可读"

**注意事项**：
- permissions集合绝对不能设为可读
- 财务相关集合需要严格的权限控制
- AI功能集合涉及成本，需要限制访问

### **第四阶段：索引优化**

#### 索引创建优先级
1. **P1集合索引**：影响核心功能，立即创建
2. **高频查询索引**：用户数据、时间排序、状态筛选
3. **业务主键索引**：唯一性约束，数据完整性
4. **P2/P3集合索引**：按使用频率分批创建

#### 索引创建步骤
1. 选择集合 → 索引管理
2. 点击"添加索引"
3. 根据配置逐个创建
4. 验证索引效果

### **第五阶段：数据初始化**

#### 基础数据准备
1. **角色数据**：创建4个基础角色
2. **权限数据**：配置基础权限规则
3. **系统配置**：设置关键参数
4. **测试数据**：少量测试记录

#### 数据验证
1. **权限测试**：验证各角色访问权限
2. **索引测试**：检查查询性能
3. **业务流程测试**：端到端功能验证
4. **数据完整性检查**：关联数据一致性

---

## ⏰ 实施时间规划

### **第一天（2-3小时）**
- 数据备份和清理
- P1集合创建和权限配置
- 核心索引创建
- 基础功能验证

### **第一周**
- P2集合创建和配置
- 完整索引配置
- 业务功能测试

### **第二周**  
- P3集合创建和配置
- 系统优化调试
- 性能测试和优化
- 文档更新

---

## ⚠️ 重要注意事项

### 安全要点
1. **数据备份**：删除前必须备份现有重要数据
2. **权限严控**：🔴标记集合绝对不能设错权限
3. **分步部署**：按优先级分批，降低风险
4. **及时测试**：每个阶段完成后立即验证

### 性能优化
1. **索引策略**：先创建高频查询索引
2. **查询优化**：使用复合索引提升效率
3. **数据分页**：大数据量查询分页处理
4. **监控指标**：定期检查数据库性能

### 业务连续性
1. **渐进部署**：保证核心功能不中断
2. **回滚方案**：准备数据恢复策略
3. **用户通知**：提前告知系统升级
4. **功能验证**：每个模块上线前充分测试

---

这个完整的重建指南将帮您建立一个规范、高效、安全的数据库架构，为鹅场管理系统提供坚实的数据基础。
