# 🗄️ 鹅场管理系统数据库完整创建表格

## 📋 **P1优先级 - 核心系统集合（8个）- 立即创建**

| 集合名称 | 功能说明 | 权限设置 | 索引 |
|---------|---------|---------|------|
| `users` | 用户基础信息存储 | 🟠 仅创建者可读写 | `{"fields": ["_openid"], "unique": true}`<br>`{"fields": ["role", "status"]}`<br>`{"fields": ["createTime"], "order": "desc"}` |
| `roles` | 角色定义和权限模板 | 🔵 所有用户可读 | `{"fields": ["roleCode"], "unique": true}`<br>`{"fields": ["isActive", "level"]}`<br>`{"fields": ["createTime"], "order": "desc"}` |
| `permissions` | 权限配置规则 | 🔴 所有用户不可读写 | `{"fields": ["module", "action"], "unique": true}`<br>`{"fields": ["module", "isActive"]}`<br>`{"fields": ["resource", "isActive"]}` |
| `production_batches` | 生产批次管理核心 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["batchNumber"], "unique": true}`<br>`{"fields": ["status", "createTime"], "order": "desc"}` |
| `entry_records` | 入栏记录数据 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["batchNumber", "createTime"], "order": "desc"}`<br>`{"fields": ["status", "createTime"], "order": "desc"}` |
| `exit_records` | 出栏记录数据 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["batchNumber", "createTime"], "order": "desc"}`<br>`{"fields": ["exitReason", "createTime"], "order": "desc"}` |
| `health_records` | 健康状态记录 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["batchNumber", "result"]}`<br>`{"fields": ["status", "createTime"], "order": "desc"}` |
| `ai_diagnosis_records` | AI诊断结果记录 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["healthRecordId", "createTime"]}`<br>`{"fields": ["confidence", "status"]}` |

---

## 📋 **P2优先级 - 重要业务集合（11个）- 本周创建**

| 集合名称 | 功能说明 | 权限设置 | 索引 |
|---------|---------|---------|------|
| `prevention_records` | 预防措施记录（疫苗消毒） | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["batchId", "preventionType", "executionDate"]}`<br>`{"fields": ["preventionType", "executionDate"], "order": "desc"}` |
| `treatment_records` | 治疗过程记录 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["healthRecordId", "treatmentDate"], "order": "desc"}`<br>`{"fields": ["batchId", "outcome.status"]}` |
| `vaccine_plans` | 疫苗接种计划 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["status", "schedule.firstDose.date"]}`<br>`{"fields": ["targetBatches.batchId", "status"]}` |
| `health_alerts` | 健康预警系统 | 🔵 所有用户可读 | `{"fields": ["status", "severity", "createTime"], "order": "desc"}`<br>`{"fields": ["alertType", "trigger.batchId"]}`<br>`{"fields": ["severity", "createTime"], "order": "desc"}` |
| `death_records` | 死亡记录统计 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["batchNumber", "deathDate"], "order": "desc"}`<br>`{"fields": ["deathReason", "createTime"]}` |
| `material_records` | 物料使用记录 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["materialType", "createTime"], "order": "desc"}`<br>`{"fields": ["batchNumber", "materialType"]}` |
| `materials` | 物料库存管理 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["materialType", "quantity"]}`<br>`{"fields": ["supplier", "materialType"]}`<br>`{"fields": ["expiryDate"], "order": "asc"}` |
| `inventory_logs` | 库存变动日志 | 🔵 所有用户可读 | `{"fields": ["recordId", "createTime"], "order": "desc"}`<br>`{"fields": ["type", "createTime"], "order": "desc"}`<br>`{"fields": ["batchNumber", "type"]}` |
| `employee_invites` | 员工邀请管理 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["code"], "unique": true}`<br>`{"fields": ["role", "status"]}`<br>`{"fields": ["expiryTime"], "order": "asc"}` |
| `notifications` | 全局通知管理 | 🔵 所有用户可读 | `{"fields": ["type", "createTime"], "order": "desc"}`<br>`{"fields": ["priority", "createTime"], "order": "desc"}`<br>`{"fields": ["expiryTime"], "order": "asc"}` |
| `user_notifications` | 用户通知状态 | 🟠 仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["_openid", "status"]}`<br>`{"fields": ["notificationId", "_openid"]}` |
| `system_configs` | 系统配置参数 | 🔴 所有用户不可读写 | `{"fields": ["category", "key"], "unique": true}`<br>`{"fields": ["category", "isEditable"]}`<br>`{"fields": ["updateTime"], "order": "desc"}` |

---

## 📋 **P3优先级 - 完善功能集合（16个）- 计划创建**

| 集合名称 | 功能说明 | 权限设置 | 索引 |
|---------|---------|---------|------|
| `cost_records` | 成本费用记录 | 🔴 所有用户不可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["costType", "paymentDate"], "order": "desc"}`<br>`{"fields": ["status", "paymentDate"], "order": "desc"}` |
| `revenue_records` | 收入营收记录 | 🔴 所有用户不可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["revenueType", "receivedDate"], "order": "desc"}`<br>`{"fields": ["status", "receivedDate"], "order": "desc"}` |
| `financial_summaries` | 财务汇总报表 | 🔴 所有用户不可读写 | `{"fields": ["period", "periodType"], "unique": true}`<br>`{"fields": ["periodType", "periodStart"], "order": "desc"}`<br>`{"fields": ["generatedTime"], "order": "desc"}` |
| `financial_reports` | 财务分析报告 | 🔴 所有用户不可读写 | `{"fields": ["reportType", "generateTime"], "order": "desc"}`<br>`{"fields": ["dateRange.start", "dateRange.end"]}`<br>`{"fields": ["generatedBy", "generateTime"], "order": "desc"}` |
| `ai_cache` | AI诊断缓存数据 | 🔴 所有用户不可读写 | `{"fields": ["cacheKey"], "unique": true}`<br>`{"fields": ["expireTime"], "order": "asc"}`<br>`{"fields": ["createTime"], "order": "desc"}` |
| `ai_usage` | AI使用统计分析 | 🔴 所有用户不可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["model", "createTime"], "order": "desc"}`<br>`{"fields": ["cost", "createTime"]}` |
| `file_records` | 静态文件记录 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["fileType", "createTime"]}`<br>`{"fields": ["fileName"], "unique": true}` |
| `dynamic_file_records` | 动态文件管理 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["relatedId", "fileType"]}`<br>`{"fields": ["status", "createTime"]}` |
| `storage_statistics` | 存储空间统计 | 🔵 所有用户可读 | `{"fields": ["date"], "order": "desc"}`<br>`{"fields": ["fileType", "date"]}`<br>`{"fields": ["totalSize", "date"]}` |
| `admin_logs` | 管理操作日志 | 🔴 所有用户不可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["action", "createTime"], "order": "desc"}`<br>`{"fields": ["targetType", "targetId"]}` |
| `approval_logs` | 审批流程日志 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["approvalType", "status"]}`<br>`{"fields": ["targetId", "approvalType"]}` |
| `cleanup_logs` | 数据清理日志 | 🔴 所有用户不可读写 | `{"fields": ["createTime"], "order": "desc"}`<br>`{"fields": ["cleanupType", "createTime"]}`<br>`{"fields": ["status", "createTime"]}` |
| `user_notification_settings` | 用户通知偏好设置 | 🟠 仅创建者可读写 | `{"fields": ["_openid"], "unique": true}`<br>`{"fields": ["_openid", "updateTime"]}`<br>`{"fields": ["notificationType", "_openid"]}` |
| `followup_records` | 健康跟进记录 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["healthRecordId", "createTime"], "order": "desc"}`<br>`{"fields": ["relatedRecordType", "createTime"]}` |
| `cure_records` | 治愈康复记录 | 🟢 所有用户可读，仅创建者可读写 | `{"fields": ["_openid", "createTime"], "order": "desc"}`<br>`{"fields": ["healthRecordId", "createTime"], "order": "desc"}`<br>`{"fields": ["recoveryRate", "createTime"]}` |

---

## 🔐 **权限设置图例**

| 权限标记 | 控制台选项 | 适用场景 |
|---------|-----------|----------|
| 🔴 所有用户不可读写 | 选择第4个选项 | 敏感数据（财务、AI、系统日志） |
| 🔵 所有用户可读 | 选择第3个选项 | 公共数据（角色、通知、预警） |
| 🟢 所有用户可读，仅创建者可读写 | 选择第1个选项 | 业务协作数据（生产、健康记录） |
| 🟠 仅创建者可读写 | 选择第2个选项 | 个人私有数据（用户信息、通知设置） |

---

## 📊 **索引创建说明**

### **索引格式说明**
- `{"fields": ["字段名"], "unique": true}` - 唯一索引
- `{"fields": ["字段名"], "order": "desc"}` - 降序排序索引  
- `{"fields": ["字段1", "字段2"]}` - 复合索引

### **索引创建步骤**
1. 选择集合 → 点击"索引管理"
2. 点击"添加索引"
3. 复制粘贴对应的索引配置
4. 点击"确定"创建

---

## ⚡ **快速执行建议**

### **第一天执行（P1优先级）**
1. **创建8个P1集合** - 直接按表格创建
2. **配置P1权限** - 按权限图例设置
3. **创建P1索引** - 复制粘贴索引配置
4. **测试核心功能** - 验证用户、生产、健康模块

### **第二天执行（P2优先级）** 
1. **创建12个P2集合** - 完善业务功能
2. **配置P2权限** - 注意敏感数据权限
3. **创建P2索引** - 优化查询性能

### **第三天执行（P3优先级）**
1. **创建16个P3集合** - 完整系统功能
2. **配置P3权限** - 严格控制财务和AI数据
3. **创建P3索引** - 全面优化性能

---

**总计：35个集合，完整的鹅场管理系统数据库架构！** 🎉
