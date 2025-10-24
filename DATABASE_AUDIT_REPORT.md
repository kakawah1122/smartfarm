# 数据库集合审计报告

## 审计时间
2025年10月24日

---

## ✅ 现有数据库集合（40个）

根据云开发控制台截图，当前数据库包含以下40个集合：

### 用户管理模块（4个）
1. ✅ wx_users
2. ✅ wx_user_invites
3. ✅ user_notifications
4. ✅ user_notification_settings

### 生产管理模块（6个）
5. ✅ prod_batch_entries
6. ✅ prod_batch_exits
7. ✅ prod_materials
8. ✅ prod_material_records
9. ✅ prod_inventory_logs
10. ✅ production_batches

### 健康管理模块（9个）
11. ✅ health_records
12. ✅ health_prevention_records
13. ✅ health_treatment_records
14. ✅ health_ai_diagnosis
15. ✅ health_cure_records
16. ✅ health_death_records
17. ✅ health_followup_records
18. ✅ health_alerts
19. ✅ health_vaccine_plans

### 财务管理模块（4个）
20. ✅ finance_cost_records
21. ✅ finance_revenue_records
22. ✅ finance_reports
23. ✅ finance_summaries

### 任务管理模块（4个）
24. ✅ task_batch_schedules
25. ✅ task_completions
26. ✅ task_records
27. ✅ task_templates

### 系统管理模块（11个）
28. ✅ sys_audit_logs
29. ✅ sys_ai_cache
30. ✅ sys_ai_usage
31. ✅ sys_approval_logs
32. ✅ sys_cleanup_logs
33. ✅ sys_configurations
34. ✅ sys_overview_stats
35. ✅ sys_notifications
36. ✅ sys_permissions
37. ✅ sys_roles
38. ✅ sys_storage_statistics

### 文件管理模块（2个）
39. ✅ file_dynamic_records
40. ✅ file_static_records

---

## ⚠️ 代码中发现的问题

### 问题1：仍在使用旧集合名称

以下云函数中硬编码了旧的集合名称，需要更新：

#### 1. cloudfunctions/ai-diagnosis/index.js
```javascript
// ❌ 使用旧集合名称
db.collection('ai_diagnosis_history')  // 6处
db.collection('ai_diagnosis_tasks')    // 1处
```
**建议**：统一使用 `health_ai_diagnosis`

#### 2. cloudfunctions/process-ai-diagnosis/index.js
```javascript
// ❌ 使用旧集合名称
db.collection('ai_diagnosis_tasks')    // 4处
```
**建议**：统一使用 `health_ai_diagnosis`

#### 3. cloudfunctions/user-management/index.js
```javascript
// ❌ 使用旧集合名称
db.collection('audit_logs')            // 2处
```
**建议**：统一使用 `sys_audit_logs`

---

## 📋 配置文件与实际对比

### DATABASE_CONFIG_GUIDE.md
- ✅ 定义了40个集合
- ✅ 与实际数据库完全一致
- ✅ 已删除兼容层定义

### shared-config/collections.js
- ✅ 定义了40个标准集合
- ✅ 已删除兼容层定义
- ⚠️ 但代码中还有3个云函数在使用旧名称

### cloudfunctions/*/collections.js
- ✅ health-management/collections.js：40个集合
- ✅ breeding-todo/collections.js：40个集合

---

## 🔧 必须立即修复的问题

### 1. ai-diagnosis 云函数（高优先级）
**文件**：`cloudfunctions/ai-diagnosis/index.js`

**需要修改**：
- 将所有 `ai_diagnosis_history` 替换为 `health_ai_diagnosis`
- 将所有 `ai_diagnosis_tasks` 替换为 `health_ai_diagnosis`
- 引入 collections.js 配置文件

**影响**：AI诊断功能，使用频繁

### 2. process-ai-diagnosis 云函数（高优先级）
**文件**：`cloudfunctions/process-ai-diagnosis/index.js`

**需要修改**：
- 将所有 `ai_diagnosis_tasks` 替换为 `health_ai_diagnosis`
- 引入 collections.js 配置文件

**影响**：AI诊断后台处理，定时触发

### 3. user-management 云函数（中优先级）
**文件**：`cloudfunctions/user-management/index.js`

**需要修改**：
- 将所有 `audit_logs` 替换为 `sys_audit_logs`
- 引入 collections.js 配置文件

**影响**：用户审计日志记录

---

## 📊 统计数据

### 集合名称使用情况
| 方式 | 云函数数量 | 使用次数 | 状态 |
|------|----------|---------|------|
| 使用COLLECTIONS常量 | 2个 | 约20处 | ✅ 符合规范 |
| 硬编码集合名称 | 所有 | 约250处 | ⚠️ 需要规范化 |
| 使用旧集合名称 | 3个 | 13处 | ❌ 必须修复 |

### 云函数规范化程度
- ✅ 完全规范：2个（health-management, breeding-todo）
- ⚠️ 部分规范：0个
- ❌ 未规范：22个（还在硬编码集合名称）

---

## 🎯 推荐行动计划

### 立即执行（必须）
1. **修复3个云函数的旧集合名称**
   - ai-diagnosis.js：7处修改
   - process-ai-diagnosis.js：4处修改
   - user-management.js：2处修改

### 短期优化（建议）
2. **所有云函数引入collections.js**
   - 统一使用COLLECTIONS常量
   - 避免硬编码集合名称
   - 提升可维护性

### 长期规划（可选）
3. **建立代码规范检查**
   - ESLint规则：禁止硬编码集合名称
   - Git钩子：提交前检查
   - CI/CD：自动化验证

---

## ✅ 验证清单

- [x] 实际数据库有40个集合
- [x] DATABASE_CONFIG_GUIDE.md定义40个集合
- [x] shared-config/collections.js定义40个集合
- [x] 所有集合命名符合规范
- [ ] ❌ 代码中还有13处使用旧集合名称
- [ ] ⚠️ 大部分云函数还在硬编码集合名称

---

## 📝 结论

**数据库集合配置：完全正确 ✅**
- 40个集合与实际数据库完全一致
- 集合命名完全符合规范
- 配置文档准确无误

**代码使用情况：需要修复 ⚠️**
- 3个云函数使用旧集合名称（必须修复）
- 大部分云函数硬编码集合名称（建议优化）

**推荐：先修复3个云函数的旧名称问题，确保功能正常运行。**

---

**报告生成时间**：2025年10月24日  
**审计范围**：数据库集合定义、代码使用情况、配置文档  
**下一步**：修复3个云函数中的旧集合名称引用

