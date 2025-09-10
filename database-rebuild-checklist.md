# ✅ 数据库重建执行清单

## 🎯 执行概览
- **总集合数**：35个
- **总预计时间**：第一天2-3小时，完整部署2周
- **安全等级**：高（涉及数据重建）

---

## 📋 **阶段一：准备工作**

### ☑️ **第1步：数据备份**
- [ ] 导出现有重要数据（用户数据、生产记录、健康记录）
- [ ] 保存备份到本地安全位置
- [ ] 记录当前集合数量：23个
- [ ] 确认备份文件完整性

### ☑️ **第2步：清理现有集合**
在微信云开发控制台 → 数据库管理中删除以下23个集合：

**现有集合清理清单：**
- [ ] admin_logs
- [ ] ai_cache  
- [ ] ai_diagnosis_records
- [ ] ai_usage
- [ ] approval_logs
- [ ] cleanup_logs
- [ ] cure_records
- [ ] death_records
- [ ] dynamic_file_records
- [ ] employee_invites
- [ ] entry_records
- [ ] exit_records
- [ ] file_records
- [ ] followup_records
- [ ] health_records
- [ ] inventory_logs
- [ ] material_records
- [ ] materials
- [ ] notifications
- [ ] storage_statistics
- [ ] user_notification_settings
- [ ] user_notifications
- [ ] users

---

## 📋 **阶段二：P1优先级集合创建（核心系统）**

### ☑️ **第3步：创建P1集合（8个）**

#### 用户权限系统
- [ ] `users` - 用户信息
- [ ] `roles` - 角色定义  
- [ ] `permissions` - 权限配置

#### 生产核心
- [ ] `production_batches` - 生产批次
- [ ] `entry_records` - 入栏记录
- [ ] `exit_records` - 出栏记录

#### 健康核心  
- [ ] `health_records` - 健康记录
- [ ] `ai_diagnosis_records` - AI诊断记录

### ☑️ **第4步：P1权限配置**

#### 🟠 仅创建者可读写（1个）
- [ ] `users` → 选择 "仅创建者可读写"

#### 🔵 所有用户可读（1个）  
- [ ] `roles` → 选择 "所有用户可读"

#### 🔴 所有用户不可读写（1个）
- [ ] `permissions` → 选择 "所有用户不可读写"

#### 🟢 所有用户可读，仅创建者可读写（5个）
- [ ] `production_batches` → 选择 "所有用户可读，仅创建者可读写"
- [ ] `entry_records` → 选择 "所有用户可读，仅创建者可读写"  
- [ ] `exit_records` → 选择 "所有用户可读，仅创建者可读写"
- [ ] `health_records` → 选择 "所有用户可读，仅创建者可读写"
- [ ] `ai_diagnosis_records` → 选择 "所有用户可读，仅创建者可读写"

### ☑️ **第5步：P1核心索引创建**

#### `users` 集合索引
- [ ] `{"fields": ["_openid"], "unique": true}`
- [ ] `{"fields": ["role", "status"]}`  
- [ ] `{"fields": ["createTime"], "order": "desc"}`

#### `roles` 集合索引
- [ ] `{"fields": ["roleCode"], "unique": true}`
- [ ] `{"fields": ["isActive", "level"]}`
- [ ] `{"fields": ["createTime"], "order": "desc"}`

#### `permissions` 集合索引  
- [ ] `{"fields": ["module", "action"], "unique": true}`
- [ ] `{"fields": ["module", "isActive"]}`

#### `production_batches` 集合索引
- [ ] `{"fields": ["_openid", "createTime"], "order": "desc"}`
- [ ] `{"fields": ["batchNumber"], "unique": true}`
- [ ] `{"fields": ["status", "createTime"], "order": "desc"}`

#### `entry_records` 集合索引
- [ ] `{"fields": ["_openid", "createTime"], "order": "desc"}`
- [ ] `{"fields": ["batchNumber", "createTime"], "order": "desc"}`
- [ ] `{"fields": ["status", "createTime"], "order": "desc"}`

#### `exit_records` 集合索引
- [ ] `{"fields": ["_openid", "createTime"], "order": "desc"}`
- [ ] `{"fields": ["batchNumber", "createTime"], "order": "desc"}`
- [ ] `{"fields": ["exitReason", "createTime"], "order": "desc"}`

#### `health_records` 集合索引
- [ ] `{"fields": ["_openid", "createTime"], "order": "desc"}`
- [ ] `{"fields": ["batchNumber", "result"]}`
- [ ] `{"fields": ["status", "createTime"], "order": "desc"}`

#### `ai_diagnosis_records` 集合索引  
- [ ] `{"fields": ["_openid", "createTime"], "order": "desc"}`
- [ ] `{"fields": ["healthRecordId", "createTime"]}`
- [ ] `{"fields": ["confidence", "status"]}`

### ☑️ **第6步：P1基础数据初始化**

#### 创建基础角色数据 (roles集合)
手动添加4条记录：

**super_admin角色：**
```json
{
  "roleCode": "super_admin",
  "roleName": "超级管理员", 
  "roleDescription": "系统超级管理员，拥有所有权限",
  "level": 1,
  "isActive": true,
  "permissions": ["*"],
  "createTime": "2024-01-01T00:00:00.000Z"
}
```
- [ ] 已添加 super_admin 角色

**manager角色：**
```json
{
  "roleCode": "manager",
  "roleName": "经理",
  "roleDescription": "鹅场经理，负责整体运营管理", 
  "level": 2,
  "isActive": true,
  "permissions": ["production.*", "health.*", "finance.read", "user.manage"],
  "createTime": "2024-01-01T00:00:00.000Z"
}
```
- [ ] 已添加 manager 角色

**employee角色：**
```json
{
  "roleCode": "employee",
  "roleName": "员工",
  "roleDescription": "普通员工，负责日常操作和数据录入",
  "level": 3, 
  "isActive": true,
  "permissions": ["production.basic", "health.basic", "ai_diagnosis.*"],
  "createTime": "2024-01-01T00:00:00.000Z"
}
```
- [ ] 已添加 employee 角色

**veterinarian角色：**
```json
{
  "roleCode": "veterinarian", 
  "roleName": "兽医",
  "roleDescription": "兽医，负责动物健康诊疗和AI诊断验证",
  "level": 3,
  "isActive": true,
  "permissions": ["health.*", "ai_diagnosis.*", "production.read"],
  "createTime": "2024-01-01T00:00:00.000Z" 
}
```
- [ ] 已添加 veterinarian 角色

### ☑️ **第7步：P1功能验证**
- [ ] 测试用户登录功能
- [ ] 验证角色权限配置  
- [ ] 测试基础生产记录创建
- [ ] 测试健康记录创建
- [ ] 确认索引查询性能

---

## 📋 **阶段三：P2优先级集合创建（重要业务）**

### ☑️ **第8步：创建P2集合（11个）**

#### 健康管理扩展
- [ ] `prevention_records` - 预防记录
- [ ] `treatment_records` - 治疗记录  
- [ ] `vaccine_plans` - 疫苗计划
- [ ] `health_alerts` - 健康预警
- [ ] `death_records` - 死亡记录

#### 生产管理扩展
- [ ] `material_records` - 物料记录
- [ ] `materials` - 物料库存
- [ ] `inventory_logs` - 库存日志

#### 系统功能
- [ ] `employee_invites` - 员工邀请
- [ ] `notifications` - 通知
- [ ] `user_notifications` - 用户通知
- [ ] `system_configs` - 系统配置

### ☑️ **第9步：P2权限配置**

#### 🔵 所有用户可读（3个）
- [ ] `inventory_logs` → 选择 "所有用户可读"
- [ ] `health_alerts` → 选择 "所有用户可读"  
- [ ] `notifications` → 选择 "所有用户可读"

#### 🟠 仅创建者可读写（1个）
- [ ] `user_notifications` → 选择 "仅创建者可读写"

#### 🔴 所有用户不可读写（1个）  
- [ ] `system_configs` → 选择 "所有用户不可读写"

#### 🟢 所有用户可读，仅创建者可读写（6个）
- [ ] `prevention_records` → 选择 "所有用户可读，仅创建者可读写"
- [ ] `treatment_records` → 选择 "所有用户可读，仅创建者可读写"
- [ ] `vaccine_plans` → 选择 "所有用户可读，仅创建者可读写"
- [ ] `death_records` → 选择 "所有用户可读，仅创建者可读写"
- [ ] `material_records` → 选择 "所有用户可读，仅创建者可读写"
- [ ] `materials` → 选择 "所有用户可读，仅创建者可读写"
- [ ] `employee_invites` → 选择 "所有用户可读，仅创建者可读写"

### ☑️ **第10步：P2核心索引创建**

#### `prevention_records` 集合索引
- [ ] `{"fields": ["_openid", "createTime"], "order": "desc"}`
- [ ] `{"fields": ["batchId", "preventionType", "executionDate"]}`
- [ ] `{"fields": ["preventionType", "executionDate"], "order": "desc"}`

#### `treatment_records` 集合索引
- [ ] `{"fields": ["_openid", "createTime"], "order": "desc"}`  
- [ ] `{"fields": ["healthRecordId", "treatmentDate"], "order": "desc"}`
- [ ] `{"fields": ["batchId", "outcome.status"]}`

#### `health_alerts` 集合索引
- [ ] `{"fields": ["status", "severity", "createTime"], "order": "desc"}`
- [ ] `{"fields": ["alertType", "trigger.batchId"]}`
- [ ] `{"fields": ["severity", "createTime"], "order": "desc"}`

#### 其他P2集合基础索引
- [ ] `vaccine_plans`: `{"fields": ["_openid", "createTime"], "order": "desc"}`
- [ ] `death_records`: `{"fields": ["_openid", "createTime"], "order": "desc"}`  
- [ ] `material_records`: `{"fields": ["_openid", "createTime"], "order": "desc"}`
- [ ] `materials`: `{"fields": ["materialType", "quantity"]}`
- [ ] `employee_invites`: `{"fields": ["code"], "unique": true}`
- [ ] `notifications`: `{"fields": ["type", "createTime"], "order": "desc"}`
- [ ] `user_notifications`: `{"fields": ["_openid", "createTime"], "order": "desc"}`
- [ ] `system_configs`: `{"fields": ["category", "key"], "unique": true}`

### ☑️ **第11步：P2功能验证**
- [ ] 测试健康管理完整流程
- [ ] 验证物料管理功能
- [ ] 测试通知系统
- [ ] 验证员工邀请功能

---

## 📋 **阶段四：P3优先级集合创建（完善功能）**

### ☑️ **第12步：创建P3集合（16个）**

#### 财务管理
- [ ] `cost_records` - 成本记录
- [ ] `revenue_records` - 收入记录
- [ ] `financial_summaries` - 财务汇总  
- [ ] `financial_reports` - 财务报表

#### AI和文件管理
- [ ] `ai_cache` - AI缓存
- [ ] `ai_usage` - AI使用统计
- [ ] `file_records` - 文件记录
- [ ] `dynamic_file_records` - 动态文件记录
- [ ] `storage_statistics` - 存储统计

#### 系统管理
- [ ] `admin_logs` - 管理日志
- [ ] `approval_logs` - 审批日志  
- [ ] `cleanup_logs` - 清理日志

#### 其他功能
- [ ] `user_notification_settings` - 通知设置
- [ ] `followup_records` - 跟进记录
- [ ] `cure_records` - 治愈记录

### ☑️ **第13步：P3权限配置**

#### 🔴 所有用户不可读写（8个）
- [ ] `cost_records` → 选择 "所有用户不可读写"
- [ ] `revenue_records` → 选择 "所有用户不可读写"
- [ ] `financial_summaries` → 选择 "所有用户不可读写"
- [ ] `financial_reports` → 选择 "所有用户不可读写"
- [ ] `ai_cache` → 选择 "所有用户不可读写" 
- [ ] `ai_usage` → 选择 "所有用户不可读写"
- [ ] `admin_logs` → 选择 "所有用户不可读写"
- [ ] `cleanup_logs` → 选择 "所有用户不可读写"

#### 🔵 所有用户可读（1个）
- [ ] `storage_statistics` → 选择 "所有用户可读"

#### 🟠 仅创建者可读写（1个）
- [ ] `user_notification_settings` → 选择 "仅创建者可读写"

#### 🟢 所有用户可读，仅创建者可读写（6个）
- [ ] `file_records` → 选择 "所有用户可读，仅创建者可读写"
- [ ] `dynamic_file_records` → 选择 "所有用户可读，仅创建者可读写"
- [ ] `approval_logs` → 选择 "所有用户可读，仅创建者可读写"
- [ ] `followup_records` → 选择 "所有用户可读，仅创建者可读写"
- [ ] `cure_records` → 选择 "所有用户可读，仅创建者可读写"

### ☑️ **第14步：P3索引创建**

#### 财务相关索引
- [ ] `cost_records`: `{"fields": ["costType", "createTime"], "order": "desc"}`
- [ ] `revenue_records`: `{"fields": ["revenueType", "createTime"], "order": "desc"}`
- [ ] `financial_summaries`: `{"fields": ["period", "periodType"], "unique": true}`
- [ ] `financial_reports`: `{"fields": ["reportType", "generateTime"], "order": "desc"}`

#### 其他P3集合索引  
- [ ] `ai_cache`: `{"fields": ["cacheKey"], "unique": true}`
- [ ] `ai_usage`: `{"fields": ["_openid", "createTime"], "order": "desc"}`
- [ ] `file_records`: `{"fields": ["_openid", "createTime"], "order": "desc"}`
- [ ] `dynamic_file_records`: `{"fields": ["_openid", "createTime"], "order": "desc"}`
- [ ] `storage_statistics`: `{"fields": ["date"], "order": "desc"}`
- [ ] `admin_logs`: `{"fields": ["action", "createTime"], "order": "desc"}`
- [ ] `approval_logs`: `{"fields": ["_openid", "createTime"], "order": "desc"}`
- [ ] `cleanup_logs`: `{"fields": ["createTime"], "order": "desc"}`
- [ ] `user_notification_settings`: `{"fields": ["_openid"], "unique": true}`
- [ ] `followup_records`: `{"fields": ["healthRecordId", "createTime"], "order": "desc"}`
- [ ] `cure_records`: `{"fields": ["healthRecordId", "createTime"], "order": "desc"}`

---

## 📋 **阶段五：最终验证和优化**

### ☑️ **第15步：完整性验证**
- [ ] 验证所有35个集合已创建
- [ ] 检查所有权限配置正确
- [ ] 确认所有核心索引已创建
- [ ] 测试跨集合数据关联

### ☑️ **第16步：功能测试**
- [ ] 用户注册登录流程
- [ ] 生产管理完整流程
- [ ] 健康管理完整流程  
- [ ] AI诊断功能
- [ ] 通知系统
- [ ] 权限控制验证

### ☑️ **第17步：性能优化**
- [ ] 检查查询性能
- [ ] 监控索引使用情况
- [ ] 调整索引配置（如需要）
- [ ] 数据库连接测试

### ☑️ **第18步：文档更新**
- [ ] 更新数据库设计文档
- [ ] 更新API接口文档
- [ ] 创建运维操作手册
- [ ] 备份新的数据库架构

---

## 📊 **验收标准**

### ✅ **完成标准**
- [ ] 35个集合全部创建成功
- [ ] 权限配置100%正确
- [ ] 核心索引全部创建
- [ ] 基础数据初始化完成
- [ ] 所有核心功能测试通过

### ⚠️ **质量检查**
- [ ] 无权限安全漏洞
- [ ] 查询性能满足要求
- [ ] 数据完整性约束正确
- [ ] 错误处理机制完善

### 📈 **性能指标**  
- [ ] 用户查询响应时间 < 500ms
- [ ] 批量数据操作成功率 > 99%
- [ ] 索引命中率 > 90%
- [ ] 并发用户支持 > 100

---

## 🚨 **应急处理**

### 回滚预案
1. **数据恢复**：使用第1步的备份数据
2. **集合重建**：从任何阶段重新开始
3. **权限重置**：重新配置权限规则
4. **索引重建**：删除并重新创建索引

### 常见问题
1. **集合创建失败**：检查环境权限和配额
2. **权限配置错误**：立即修正，防止安全漏洞
3. **索引创建慢**：分批创建，避免超时
4. **数据导入失败**：检查数据格式和字段匹配

---

**📅 建议执行时间：** 
- **P1阶段**：立即执行（2-3小时）
- **P2阶段**：第一周完成
- **P3阶段**：第二周完成  
- **验收优化**：第三周完成

**👥 建议执行人员：**
- **主要执行**：系统管理员
- **协助验证**：业务负责人
- **技术支持**：开发团队

祝您重建顺利！🎉
