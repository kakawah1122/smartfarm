# 数据库集合配置指引

## 概述

本文档提供鹅数通小程序数据库集合的完整配置指引，包括42个集合的详细说明、创建步骤和权限配置建议。

## 集合命名规范

- **格式**：`模块前缀_功能描述`（小写字母+下划线）
- **模块前缀**：
  - `wx_` 或 `user_`：用户管理模块
  - `prod_`：生产管理模块
  - `health_`：健康管理模块
  - `finance_`：财务管理模块
  - `task_`：任务管理模块
  - `sys_`：系统管理模块
  - `file_`：文件管理模块

## 一、用户管理模块（4个集合）

### 1. wx_users
- **用途**：存储微信用户基本信息和权限
- **关键字段**：
  - `_openid`：微信openid（自动添加）
  - `nickname`：用户昵称
  - `avatarUrl`：头像URL
  - `phone`：手机号
  - `farmName`：养殖场名称
  - `role`：角色（super_admin/manager/employee/veterinarian）
  - `permissions`：权限数组
  - `isActive`：是否激活
  - `createTime`：创建时间
  - `lastLoginTime`：最后登录时间

### 2. wx_user_invites
- **用途**：存储用户邀请码信息
- **关键字段**：
  - `inviteCode`：6位邀请码
  - `creatorOpenid`：创建者openid
  - `farmId`：养殖场ID
  - `role`：授予的角色
  - `permissions`：授予的权限
  - `status`：状态（pending/used/expired）
  - `expiresAt`：过期时间
  - `usedBy`：使用者openid
  - `usedAt`：使用时间

### 3. user_notifications
- **用途**：存储用户通知消息
- **关键字段**：
  - `userId`：用户openid
  - `title`：通知标题
  - `content`：通知内容
  - `type`：通知类型
  - `read`：是否已读
  - `createTime`：创建时间

### 4. user_notification_settings
- **用途**：存储用户通知偏好设置
- **关键字段**：
  - `userId`：用户openid
  - `enableHealth`：健康提醒开关
  - `enableTask`：任务提醒开关
  - `enableFinance`：财务提醒开关

## 二、生产管理模块（6个集合）

### 5. prod_batch_entries
- **用途**：入栏记录
- **关键字段**：
  - `batchNumber`：批次号
  - `farmId`：养殖场ID
  - `quantity`：数量
  - `entryDate`：入栏日期
  - `source`：来源
  - `breed`：品种
  - `userId`：操作用户

### 6. prod_batch_exits
- **用途**：出栏记录
- **关键字段**：
  - `batchNumber`：批次号
  - `farmId`：养殖场ID
  - `quantity`：数量
  - `exitDate`：出栏日期
  - `exitNumber`：出栏编号
  - `customer`：客户
  - `price`：单价
  - `totalAmount`：总金额
  - `userId`：操作用户

### 7. prod_materials
- **用途**：物料库存
- **关键字段**：
  - `farmId`：养殖场ID
  - `materialName`：物料名称
  - `category`：类别（feed/medicine/vaccine）
  - `currentStock`：当前库存
  - `unit`：单位
  - `safetyStock`：安全库存

### 8. prod_material_records
- **用途**：物料出入库记录
- **关键字段**：
  - `farmId`：养殖场ID
  - `materialId`：物料ID
  - `type`：类型（in/out）
  - `quantity`：数量
  - `relatedBatch`：关联批次
  - `operateDate`：操作日期
  - `userId`：操作用户

### 9. prod_inventory_logs
- **用途**：库存变动日志
- **关键字段**：
  - `farmId`：养殖场ID
  - `materialId`：物料ID
  - `beforeStock`：变动前库存
  - `afterStock`：变动后库存
  - `changeAmount`：变动数量
  - `reason`：变动原因
  - `createTime`：创建时间

### 10. production_batches
- **用途**：生产批次汇总信息
- **关键字段**：
  - `batchNumber`：批次号
  - `farmId`：养殖场ID
  - `status`：状态（active/completed/terminated）
  - `startDate`：开始日期
  - `endDate`：结束日期
  - `initialQuantity`：初始数量
  - `currentQuantity`：当前数量
  - `survivalRate`：存活率

## 三、健康管理模块（9个集合）

### 11. health_records
- **用途**：健康巡查记录
- **关键字段**：
  - `batchId`：批次ID
  - `farmId`：养殖场ID
  - `checkDate`：检查日期
  - `normalCount`：正常数量
  - `abnormalCount`：异常数量
  - `symptoms`：症状描述
  - `images`：照片数组
  - `userId`：操作用户

### 12. health_prevention_records
- **用途**：疫苗接种和消毒记录
- **关键字段**：
  - `batchId`：批次ID
  - `farmId`：养殖场ID
  - `type`：类型（vaccine/disinfection）
  - `preventionDate`：预防日期
  - `vaccineName`：疫苗名称（疫苗接种时）
  - `disinfectantName`：消毒剂名称（消毒时）
  - `method`：方法
  - `userId`：操作用户

### 13. health_treatment_records
- **用途**：治疗记录
- **关键字段**：
  - `batchId`：批次ID
  - `farmId`：养殖场ID
  - `treatmentDate`：治疗日期
  - `diagnosis`：诊断结果
  - `medicine`：用药
  - `dosage`：剂量
  - `affectedCount`：治疗数量
  - `userId`：操作用户

### 14. health_ai_diagnosis
- **用途**：AI智能诊断结果
- **关键字段**：
  - `farmId`：养殖场ID
  - `batchId`：批次ID
  - `symptoms`：症状描述
  - `images`：诊断图片
  - `diagnosis`：诊断结果
  - `suggestions`：建议措施
  - `confidence`：置信度
  - `model`：使用的AI模型
  - `createTime`：创建时间

### 15. health_cure_records
- **用途**：康复记录
- **关键字段**：
  - `treatmentId`：关联治疗记录ID
  - `batchId`：批次ID
  - `farmId`：养殖场ID
  - `cureDate`：康复日期
  - `curedCount`：康复数量
  - `userId`：操作用户

### 16. health_death_records
- **用途**：死亡记录
- **关键字段**：
  - `batchId`：批次ID
  - `farmId`：养殖场ID
  - `deathDate`：死亡日期
  - `deathCount`：死亡数量
  - `cause`：死因
  - `disposal`：处理方式
  - `userId`：操作用户

### 17. health_followup_records
- **用途**：随访记录
- **关键字段**：
  - `relatedRecordId`：关联记录ID
  - `batchId`：批次ID
  - `followupDate`：随访日期
  - `status`：状态
  - `notes`：备注
  - `userId`：操作用户

### 18. health_alerts
- **用途**：健康预警
- **关键字段**：
  - `farmId`：养殖场ID
  - `batchId`：批次ID
  - `alertType`：预警类型
  - `severity`：严重程度
  - `message`：预警消息
  - `status`：状态（pending/handled/ignored）
  - `createTime`：创建时间

### 19. health_vaccine_plans
- **用途**：疫苗接种计划
- **关键字段**：
  - `batchId`：批次ID
  - `farmId`：养殖场ID
  - `vaccineName`：疫苗名称
  - `plannedDate`：计划日期
  - `completed`：是否完成
  - `completedDate`：完成日期

## 四、财务管理模块（4个集合）

### 20. finance_cost_records
- **用途**：成本记录
- **关键字段**：
  - `farmId`：养殖场ID
  - `batchId`：批次ID
  - `category`：类别（feed/labor/medicine/other）
  - `amount`：金额
  - `costDate`：发生日期
  - `description`：描述
  - `userId`：操作用户

### 21. finance_revenue_records
- **用途**：收入记录
- **关键字段**：
  - `farmId`：养殖场ID
  - `batchId`：批次ID
  - `amount`：金额
  - `revenueDate`：收入日期
  - `source`：来源
  - `description`：描述
  - `userId`：操作用户

### 22. finance_reports
- **用途**：财务报表
- **关键字段**：
  - `farmId`：养殖场ID
  - `reportType`：报表类型
  - `period`：期间
  - `totalCost`：总成本
  - `totalRevenue`：总收入
  - `profit`：利润
  - `createTime`：创建时间

### 23. finance_summaries
- **用途**：财务汇总
- **关键字段**：
  - `farmId`：养殖场ID
  - `month`：月份
  - `totalCost`：总成本
  - `totalRevenue`：总收入
  - `netProfit`：净利润
  - `profitMargin`：利润率

## 五、任务管理模块（4个集合）

### 24. task_batch_schedules
- **用途**：批次任务计划
- **关键字段**：
  - `batchId`：批次ID
  - `farmId`：养殖场ID
  - `taskType`：任务类型
  - `targetDate`：目标日期
  - `completed`：是否完成
  - `completedDate`：完成日期

### 25. task_completions
- **用途**：任务完成记录
- **关键字段**：
  - `scheduleId`：计划任务ID
  - `batchId`：批次ID
  - `completedDate`：完成日期
  - `notes`：备注
  - `userId`：操作用户

### 26. task_records
- **用途**：任务操作记录
- **关键字段**：
  - `farmId`：养殖场ID
  - `taskType`：任务类型
  - `taskDate`：任务日期
  - `status`：状态
  - `userId`：操作用户

### 27. task_templates
- **用途**：任务模板
- **关键字段**：
  - `farmId`：养殖场ID
  - `taskType`：任务类型
  - `templateName`：模板名称
  - `schedule`：执行计划
  - `isActive`：是否启用

## 六、系统管理模块（11个集合）

### 28. sys_audit_logs
- **用途**：系统操作审计日志
- **关键字段**：
  - `userId`：用户openid
  - `action`：操作类型
  - `module`：模块
  - `details`：详情
  - `ipAddress`：IP地址
  - `createTime`：创建时间

### 29. sys_ai_cache
- **用途**：AI缓存
- **关键字段**：
  - `cacheKey`：缓存键
  - `cacheValue`：缓存值
  - `expiresAt`：过期时间
  - `createTime`：创建时间

### 30. sys_ai_usage
- **用途**：AI使用统计
- **关键字段**：
  - `userId`：用户openid
  - `model`：AI模型
  - `promptTokens`：输入token数
  - `completionTokens`：输出token数
  - `totalCost`：总成本
  - `createTime`：创建时间

### 31. sys_approval_logs
- **用途**：审批日志
- **关键字段**：
  - `requestId`：申请ID
  - `approverOpenid`：审批人openid
  - `action`：审批动作（approve/reject）
  - `reason`：原因
  - `createTime`：创建时间

### 32. sys_cleanup_logs
- **用途**：数据清理日志
- **关键字段**：
  - `collectionName`：集合名称
  - `cleanupType`：清理类型
  - `deletedCount`：删除数量
  - `createTime`：创建时间

### 33. sys_configurations
- **用途**：系统配置
- **关键字段**：
  - `configKey`：配置键
  - `configValue`：配置值
  - `description`：描述
  - `updateTime`：更新时间

### 34. sys_overview_stats
- **用途**：系统概览统计
- **关键字段**：
  - `farmId`：养殖场ID
  - `statDate`：统计日期
  - `totalBatches`：总批次数
  - `activeBatches`：活跃批次数
  - `totalStock`：总存栏
  - `healthRate`：健康率

### 35. sys_notifications
- **用途**：系统通知
- **关键字段**：
  - `notificationType`：通知类型
  - `targetUsers`：目标用户数组
  - `title`：标题
  - `content`：内容
  - `createTime`：创建时间

### 36. sys_permissions
- **用途**：权限定义
- **关键字段**：
  - `permissionCode`：权限代码
  - `permissionName`：权限名称
  - `module`：所属模块
  - `description`：描述

### 37. sys_roles
- **用途**：角色定义
- **关键字段**：
  - `roleCode`：角色代码
  - `roleName`：角色名称
  - `permissions`：权限数组
  - `description`：描述

### 38. sys_storage_statistics
- **用途**：存储统计
- **关键字段**：
  - `farmId`：养殖场ID
  - `totalFiles`：总文件数
  - `totalSize`：总大小
  - `statDate`：统计日期

## 七、文件管理模块（2个集合）

### 39. file_dynamic_records
- **用途**：动态文件记录
- **关键字段**：
  - `fileId`：文件ID
  - `fileName`：文件名
  - `fileType`：文件类型
  - `fileSize`：文件大小
  - `relatedModule`：关联模块
  - `relatedId`：关联记录ID
  - `uploadTime`：上传时间
  - `userId`：上传用户

### 40. file_static_records
- **用途**：静态文件记录
- **关键字段**：
  - `fileId`：文件ID
  - `fileName`：文件名
  - `fileType`：文件类型
  - `fileSize`：文件大小
  - `category`：分类
  - `uploadTime`：上传时间

## 八、兼容层集合（3个，待迁移）

### 41. ai_diagnosis_tasks
- **用途**：AI诊断任务（旧版）
- **状态**：兼容现有数据，推荐迁移至 `health_ai_diagnosis`
- **关键字段**：与 health_ai_diagnosis 类似

### 42. ai_diagnosis_history
- **用途**：AI诊断历史（旧版）
- **状态**：兼容现有数据，推荐迁移至 `health_ai_diagnosis`

### 43. audit_logs
- **用途**：审计日志（旧版）
- **状态**：兼容现有数据，推荐统一使用 `sys_audit_logs`

---

## 手动创建步骤

### 在微信云开发控制台创建集合：

1. 登录[微信云开发控制台](https://console.cloud.tencent.com/)
2. 选择对应的环境
3. 进入"数据库"模块
4. 点击"添加集合"
5. 按照上述集合名称逐个创建

### 权限配置建议：

- **用户集合**（wx_users, wx_user_invites）：
  - 读：仅创建者及管理员
  - 写：仅管理员

- **生产/健康/财务集合**：
  - 读：仅创建者及其养殖场成员
  - 写：仅创建者及其养殖场成员

- **系统集合**：
  - 读/写：仅云函数

### 索引配置：

重要集合建议创建索引以提升查询性能，详见 `DATABASE_INDEX.md`。

---

## 数据迁移说明（可选）

如果需要将旧集合数据迁移到规范集合：

1. **备份数据**：
   ```bash
   # 在云开发控制台导出数据
   ```

2. **数据转换**：
   - 字段名称映射
   - 数据格式调整

3. **导入新集合**：
   - 验证数据完整性
   - 更新云函数引用

4. **切换使用**：
   - 更新 `collections.js` 引用
   - 重新部署云函数

---

## 维护建议

1. **定期备份**：每周定期导出重要数据
2. **清理过期数据**：设置定时任务清理过期记录
3. **监控存储**：关注数据库容量和性能
4. **审计日志**：定期检查sys_audit_logs，发现异常操作

---

## 相关文档

- [DATABASE_INDEX.md](./DATABASE_INDEX.md) - 数据库索引配置指引
- [shared-config/collections.js](./shared-config/collections.js) - 统一集合配置文件
- [deploy-functions.md](./deploy-functions.md) - 云函数部署指引

