# 数据库集合配置指南

## 📋 使用说明

本指南提供鹅数通小程序数据库集合的**一站式配置方案**，按照微信云开发控制台的实际操作流程，将权限配置和索引配置整合在一起。

### 配置流程
1. 登录[微信云开发控制台](https://console.cloud.tencent.com/)
2. 选择对应的环境 → 进入"数据库"模块
3. 按照本指南，逐个创建集合并配置权限和索引

---

## 一、用户管理模块（4个集合）

### 1. wx_users
**用途**：存储微信用户基本信息和权限

#### 📝 创建集合
- **集合名称**：`wx_users`
- **权限类型**：选择"仅创建者可读写"
  - 用户个人信息敏感，只允许用户本人和管理员访问

#### 📊 添加索引

**索引1：openid索引（系统自动创建）**
- 索引名称：`_openid_`
- 索引属性：非唯一
- 索引字段：
  - 字段：`_openid`，排序：升序

**索引2：养殖场索引**
- 索引名称：`farmId_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序

**索引3：手机号索引**
- 索引名称：`phone_1`
- 索引属性：唯一
- 索引字段：
  - 字段：`phone`，排序：升序

**索引4：角色和状态索引**
- 索引名称：`role_1_isActive_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`role`，排序：升序
  - 字段：`isActive`，排序：升序

#### 🔑 关键字段
- `_openid`：微信openid（自动添加）
- `nickname`：用户昵称
- `avatarUrl`：头像URL
- `phone`：手机号
- `farmId`：养殖场ID
- `farmName`：养殖场名称
- `role`：角色（super_admin/manager/employee/veterinarian）
- `permissions`：权限数组
- `isActive`：是否激活
- `createTime`：创建时间
- `lastLoginTime`：最后登录时间

---

### 2. wx_user_invites
**用途**：存储用户邀请码信息

#### 📝 创建集合
- **集合名称**：`wx_user_invites`
- **权限类型**：选择"仅创建者可读写"
  - 邀请码管理需要权限控制

#### 📊 添加索引

**索引1：邀请码索引**
- 索引名称：`inviteCode_1`
- 索引属性：唯一
- 索引字段：
  - 字段：`inviteCode`，排序：升序

**索引2：创建者和状态索引**
- 索引名称：`creatorOpenid_1_status_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`creatorOpenid`，排序：升序
  - 字段：`status`，排序：升序

**索引3：过期时间索引**
- 索引名称：`expiresAt_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`expiresAt`，排序：升序

#### 🔑 关键字段
- `inviteCode`：6位邀请码
- `creatorOpenid`：创建者openid
- `farmId`：养殖场ID
- `role`：授予的角色
- `permissions`：授予的权限
- `status`：状态（pending/used/expired）
- `expiresAt`：过期时间
- `usedBy`：使用者openid
- `usedAt`：使用时间
- `createTime`：创建时间

---

### 3. user_notifications
**用途**：存储用户通知消息

#### 📝 创建集合
- **集合名称**：`user_notifications`
- **权限类型**：选择"仅创建者可读写"
  - 用户只能查看自己的通知

#### 📊 添加索引

**索引1：用户和时间索引**
- 索引名称：`userId_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`userId`，排序：升序
  - 字段：`createTime`，排序：降序

**索引2：已读状态索引**
- 索引名称：`userId_1_read_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`userId`，排序：升序
  - 字段：`read`，排序：升序

#### 🔑 关键字段
- `userId`：用户openid
- `title`：通知标题
- `content`：通知内容
- `type`：通知类型
- `read`：是否已读
- `createTime`：创建时间

---

### 4. user_notification_settings
**用途**：存储用户通知偏好设置

#### 📝 创建集合
- **集合名称**：`user_notification_settings`
- **权限类型**：选择"仅创建者可读写"

#### 📊 添加索引

**索引1：用户ID索引**
- 索引名称：`userId_1`
- 索引属性：唯一
- 索引字段：
  - 字段：`userId`，排序：升序

#### 🔑 关键字段
- `userId`：用户openid
- `enableHealth`：健康提醒开关
- `enableTask`：任务提醒开关
- `enableFinance`：财务提醒开关
- `updateTime`：更新时间

---

## 二、生产管理模块（6个集合）

### 5. prod_batch_entries
**用途**：入栏记录

#### 📝 创建集合
- **集合名称**：`prod_batch_entries`
- **权限类型**：选择"所有用户可读、创建者可读写"
  - 养殖场成员可查看所有入栏记录，只能修改自己创建的记录

#### 📊 添加索引

**索引1：养殖场和批次号索引**
- 索引名称：`farmId_1_batchNumber_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`batchNumber`，排序：升序

**索引2：入栏日期索引**
- 索引名称：`entryDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`entryDate`，排序：降序

**索引3：批次号索引**
- 索引名称：`batchNumber_1`
- 索引属性：唯一
- 索引字段：
  - 字段：`batchNumber`，排序：升序

#### 🔑 关键字段
- `batchNumber`：批次号
- `farmId`：养殖场ID
- `quantity`：数量
- `entryDate`：入栏日期
- `source`：来源
- `breed`：品种
- `age`：日龄
- `weight`：重量
- `userId`：操作用户
- `createTime`：创建时间

---

### 6. prod_batch_exits
**用途**：出栏记录

#### 📝 创建集合
- **集合名称**：`prod_batch_exits`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：养殖场和批次号索引**
- 索引名称：`farmId_1_batchNumber_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`batchNumber`，排序：升序

**索引2：出栏日期索引**
- 索引名称：`exitDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`exitDate`，排序：降序

**索引3：出栏编号索引**
- 索引名称：`exitNumber_1`
- 索引属性：唯一
- 索引字段：
  - 字段：`exitNumber`，排序：升序

#### 🔑 关键字段
- `batchNumber`：批次号
- `exitNumber`：出栏编号
- `farmId`：养殖场ID
- `quantity`：数量
- `exitDate`：出栏日期
- `customer`：客户
- `price`：单价
- `totalAmount`：总金额
- `userId`：操作用户
- `createTime`：创建时间

---

### 7. prod_materials
**用途**：物料库存

#### 📝 创建集合
- **集合名称**：`prod_materials`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：养殖场和物料名称索引**
- 索引名称：`farmId_1_materialName_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`materialName`，排序：升序

**索引2：物料类别索引**
- 索引名称：`category_1_farmId_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`category`，排序：升序
  - 字段：`farmId`，排序：升序

**索引3：低库存预警索引**
- 索引名称：`farmId_1_currentStock_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`currentStock`，排序：升序

#### 🔑 关键字段
- `farmId`：养殖场ID
- `materialName`：物料名称
- `category`：类别（feed/medicine/vaccine/equipment/other）
- `currentStock`：当前库存
- `unit`：单位
- `safetyStock`：安全库存
- `price`：单价
- `createTime`：创建时间
- `updateTime`：更新时间

---

### 8. prod_material_records
**用途**：物料出入库记录

#### 📝 创建集合
- **集合名称**：`prod_material_records`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：养殖场和操作日期索引**
- 索引名称：`farmId_1_operateDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`operateDate`，排序：降序

**索引2：物料和时间索引**
- 索引名称：`materialId_1_operateDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`materialId`，排序：升序
  - 字段：`operateDate`，排序：降序

#### 🔑 关键字段
- `farmId`：养殖场ID
- `materialId`：物料ID
- `type`：类型（in/out）
- `quantity`：数量
- `relatedBatch`：关联批次
- `operateDate`：操作日期
- `remark`：备注
- `userId`：操作用户
- `createTime`：创建时间

---

### 9. prod_inventory_logs
**用途**：库存变动日志

#### 📝 创建集合
- **集合名称**：`prod_inventory_logs`
- **权限类型**：选择"所有用户可读"
  - 日志只读，由系统自动生成

#### 📊 添加索引

**索引1：养殖场和时间索引**
- 索引名称：`farmId_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`createTime`，排序：降序

**索引2：物料ID索引**
- 索引名称：`materialId_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`materialId`，排序：升序
  - 字段：`createTime`，排序：降序

#### 🔑 关键字段
- `farmId`：养殖场ID
- `materialId`：物料ID
- `beforeStock`：变动前库存
- `afterStock`：变动后库存
- `changeAmount`：变动数量
- `reason`：变动原因
- `createTime`：创建时间

---

### 10. production_batches
**用途**：生产批次汇总信息

#### 📝 创建集合
- **集合名称**：`production_batches`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：批次号索引**
- 索引名称：`batchNumber_1`
- 索引属性：唯一
- 索引字段：
  - 字段：`batchNumber`，排序：升序

**索引2：养殖场和状态索引**
- 索引名称：`farmId_1_status_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`status`，排序：升序

**索引3：开始日期索引**
- 索引名称：`startDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`startDate`，排序：降序

#### 🔑 关键字段
- `batchNumber`：批次号
- `farmId`：养殖场ID
- `status`：状态（active/completed/terminated）
- `startDate`：开始日期
- `endDate`：结束日期
- `initialQuantity`：初始数量
- `currentQuantity`：当前数量
- `survivalRate`：存活率
- `createTime`：创建时间
- `updateTime`：更新时间

---

## 三、健康管理模块（9个集合）

### 11. health_records
**用途**：健康巡查记录

#### 📝 创建集合
- **集合名称**：`health_records`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：批次和日期索引**
- 索引名称：`batchId_1_checkDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`batchId`，排序：升序
  - 字段：`checkDate`，排序：降序

**索引2：养殖场和日期索引**
- 索引名称：`farmId_1_checkDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`checkDate`，排序：降序

**索引3：异常记录查询索引**
- 索引名称：`farmId_1_abnormalCount_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`abnormalCount`，排序：升序

#### 🔑 关键字段
- `batchId`：批次ID
- `farmId`：养殖场ID
- `checkDate`：检查日期
- `normalCount`：正常数量
- `abnormalCount`：异常数量
- `symptoms`：症状描述
- `images`：照片数组
- `userId`：操作用户
- `createTime`：创建时间

---

### 12. health_prevention_records
**用途**：疫苗接种和消毒记录

#### 📝 创建集合
- **集合名称**：`health_prevention_records`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：批次和类型索引**
- 索引名称：`batchId_1_type_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`batchId`，排序：升序
  - 字段：`type`，排序：升序

**索引2：养殖场和日期索引**
- 索引名称：`farmId_1_preventionDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`preventionDate`，排序：降序

#### 🔑 关键字段
- `batchId`：批次ID
- `farmId`：养殖场ID
- `type`：类型（vaccine/disinfection）
- `preventionDate`：预防日期
- `vaccineName`：疫苗名称（疫苗接种时）
- `disinfectantName`：消毒剂名称（消毒时）
- `method`：方法
- `dosage`：剂量
- `userId`：操作用户
- `createTime`：创建时间

---

### 13. health_treatment_records
**用途**：治疗记录

#### 📝 创建集合
- **集合名称**：`health_treatment_records`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：批次和日期索引**
- 索引名称：`batchId_1_treatmentDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`batchId`，排序：升序
  - 字段：`treatmentDate`，排序：降序

**索引2：养殖场和日期索引**
- 索引名称：`farmId_1_treatmentDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`treatmentDate`，排序：降序

#### 🔑 关键字段
- `batchId`：批次ID
- `farmId`：养殖场ID
- `treatmentDate`：治疗日期
- `diagnosis`：诊断结果
- `medicine`：用药
- `dosage`：剂量
- `affectedCount`：治疗数量
- `userId`：操作用户
- `createTime`：创建时间

---

### 14. health_ai_diagnosis
**用途**：AI智能诊断结果

#### 📝 创建集合
- **集合名称**：`health_ai_diagnosis`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：养殖场和创建时间索引**
- 索引名称：`farmId_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`createTime`，排序：降序

**索引2：批次和创建时间索引**
- 索引名称：`batchId_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`batchId`，排序：升序
  - 字段：`createTime`，排序：降序

**索引3：AI模型使用统计索引**
- 索引名称：`model_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`model`，排序：升序
  - 字段：`createTime`，排序：降序

#### 🔑 关键字段
- `farmId`：养殖场ID
- `batchId`：批次ID
- `symptoms`：症状描述
- `images`：诊断图片
- `diagnosis`：诊断结果
- `suggestions`：建议措施
- `confidence`：置信度
- `model`：使用的AI模型
- `status`：状态（pending/completed/failed）
- `createTime`：创建时间

---

### 15. health_cure_records
**用途**：康复记录

#### 📝 创建集合
- **集合名称**：`health_cure_records`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：治疗记录ID索引**
- 索引名称：`treatmentId_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`treatmentId`，排序：升序

**索引2：批次和日期索引**
- 索引名称：`batchId_1_cureDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`batchId`，排序：升序
  - 字段：`cureDate`，排序：降序

#### 🔑 关键字段
- `treatmentId`：关联治疗记录ID
- `batchId`：批次ID
- `farmId`：养殖场ID
- `cureDate`：康复日期
- `curedCount`：康复数量
- `notes`：备注
- `userId`：操作用户
- `createTime`：创建时间

---

### 16. health_death_records
**用途**：死亡记录

#### 📝 创建集合
- **集合名称**：`health_death_records`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：批次和日期索引**
- 索引名称：`batchId_1_deathDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`batchId`，排序：升序
  - 字段：`deathDate`，排序：降序

**索引2：养殖场和日期索引**
- 索引名称：`farmId_1_deathDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`deathDate`，排序：降序

#### 🔑 关键字段
- `batchId`：批次ID
- `farmId`：养殖场ID
- `deathDate`：死亡日期
- `deathCount`：死亡数量
- `cause`：死因
- `disposal`：处理方式
- `images`：照片
- `userId`：操作用户
- `createTime`：创建时间

---

### 17. health_followup_records
**用途**：随访记录

#### 📝 创建集合
- **集合名称**：`health_followup_records`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：关联记录ID索引**
- 索引名称：`relatedRecordId_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`relatedRecordId`，排序：升序

**索引2：批次和日期索引**
- 索引名称：`batchId_1_followupDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`batchId`，排序：升序
  - 字段：`followupDate`，排序：降序

#### 🔑 关键字段
- `relatedRecordId`：关联记录ID
- `batchId`：批次ID
- `followupDate`：随访日期
- `status`：状态
- `notes`：备注
- `userId`：操作用户
- `createTime`：创建时间

---

### 18. health_alerts
**用途**：健康预警

#### 📝 创建集合
- **集合名称**：`health_alerts`
- **权限类型**：选择"所有用户可读"
  - 预警信息由系统自动生成，所有养殖场成员可查看

#### 📊 添加索引

**索引1：养殖场和状态索引**
- 索引名称：`farmId_1_status_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`status`，排序：升序

**索引2：批次和时间索引**
- 索引名称：`batchId_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`batchId`，排序：升序
  - 字段：`createTime`，排序：降序

#### 🔑 关键字段
- `farmId`：养殖场ID
- `batchId`：批次ID
- `alertType`：预警类型
- `severity`：严重程度（low/medium/high）
- `message`：预警消息
- `status`：状态（pending/handled/ignored）
- `createTime`：创建时间
- `handleTime`：处理时间

---

### 19. health_vaccine_plans
**用途**：疫苗接种计划

#### 📝 创建集合
- **集合名称**：`health_vaccine_plans`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：批次和计划日期索引**
- 索引名称：`batchId_1_plannedDate_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`batchId`，排序：升序
  - 字段：`plannedDate`，排序：升序

**索引2：未完成任务索引**
- 索引名称：`farmId_1_completed_1_plannedDate_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`completed`，排序：升序
  - 字段：`plannedDate`，排序：升序

#### 🔑 关键字段
- `batchId`：批次ID
- `farmId`：养殖场ID
- `vaccineName`：疫苗名称
- `plannedDate`：计划日期
- `completed`：是否完成
- `completedDate`：完成日期
- `createTime`：创建时间

---

## 四、财务管理模块（4个集合）

### 20. finance_cost_records
**用途**：成本记录

#### 📝 创建集合
- **集合名称**：`finance_cost_records`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：养殖场和日期索引**
- 索引名称：`farmId_1_costDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`costDate`，排序：降序

**索引2：批次和类别索引**
- 索引名称：`batchId_1_category_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`batchId`，排序：升序
  - 字段：`category`，排序：升序

**索引3：类别和日期索引**
- 索引名称：`farmId_1_category_1_costDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`category`，排序：升序
  - 字段：`costDate`，排序：降序

#### 🔑 关键字段
- `farmId`：养殖场ID
- `batchId`：批次ID
- `category`：类别（feed/labor/medicine/vaccine/equipment/other）
- `amount`：金额
- `costDate`：发生日期
- `description`：描述
- `invoice`：发票照片
- `userId`：操作用户
- `createTime`：创建时间

---

### 21. finance_revenue_records
**用途**：收入记录

#### 📝 创建集合
- **集合名称**：`finance_revenue_records`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：养殖场和日期索引**
- 索引名称：`farmId_1_revenueDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`revenueDate`，排序：降序

**索引2：批次和日期索引**
- 索引名称：`batchId_1_revenueDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`batchId`，排序：升序
  - 字段：`revenueDate`，排序：降序

#### 🔑 关键字段
- `farmId`：养殖场ID
- `batchId`：批次ID
- `amount`：金额
- `revenueDate`：收入日期
- `source`：来源（sales/subsidy/other）
- `description`：描述
- `userId`：操作用户
- `createTime`：创建时间

---

### 22. finance_reports
**用途**：财务报表

#### 📝 创建集合
- **集合名称**：`finance_reports`
- **权限类型**：选择"所有用户可读"
  - 报表由系统自动生成，所有成员只读

#### 📊 添加索引

**索引1：养殖场和期间索引**
- 索引名称：`farmId_1_period_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`period`，排序：降序

**索引2：报表类型索引**
- 索引名称：`reportType_1_period_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`reportType`，排序：升序
  - 字段：`period`，排序：降序

#### 🔑 关键字段
- `farmId`：养殖场ID
- `reportType`：报表类型（daily/weekly/monthly/yearly）
- `period`：期间
- `totalCost`：总成本
- `totalRevenue`：总收入
- `profit`：利润
- `profitMargin`：利润率
- `createTime`：创建时间

---

### 23. finance_summaries
**用途**：财务汇总

#### 📝 创建集合
- **集合名称**：`finance_summaries`
- **权限类型**：选择"所有用户可读"

#### 📊 添加索引

**索引1：养殖场和月份索引**
- 索引名称：`farmId_1_month_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`month`，排序：降序

#### 🔑 关键字段
- `farmId`：养殖场ID
- `month`：月份（格式：YYYY-MM）
- `totalCost`：总成本
- `totalRevenue`：总收入
- `netProfit`：净利润
- `profitMargin`：利润率
- `createTime`：创建时间

---

## 五、任务管理模块（4个集合）

### 24. task_batch_schedules
**用途**：批次任务计划

#### 📝 创建集合
- **集合名称**：`task_batch_schedules`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：批次和目标日期索引**
- 索引名称：`batchId_1_targetDate_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`batchId`，排序：升序
  - 字段：`targetDate`，排序：升序

**索引2：养殖场和目标日期索引**
- 索引名称：`farmId_1_targetDate_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`targetDate`，排序：升序

**索引3：未完成任务索引**
- 索引名称：`farmId_1_completed_1_targetDate_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`completed`，排序：升序
  - 字段：`targetDate`，排序：升序

#### 🔑 关键字段
- `batchId`：批次ID
- `farmId`：养殖场ID
- `taskType`：任务类型
- `taskName`：任务名称
- `targetDate`：目标日期
- `completed`：是否完成
- `completedDate`：完成日期
- `createTime`：创建时间

---

### 25. task_completions
**用途**：任务完成记录

#### 📝 创建集合
- **集合名称**：`task_completions`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：计划任务ID索引**
- 索引名称：`scheduleId_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`scheduleId`，排序：升序

**索引2：批次和完成日期索引**
- 索引名称：`batchId_1_completedDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`batchId`，排序：升序
  - 字段：`completedDate`，排序：降序

#### 🔑 关键字段
- `scheduleId`：计划任务ID
- `batchId`：批次ID
- `completedDate`：完成日期
- `notes`：备注
- `images`：照片
- `userId`：操作用户
- `createTime`：创建时间

---

### 26. task_records
**用途**：任务操作记录

#### 📝 创建集合
- **集合名称**：`task_records`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：养殖场和任务日期索引**
- 索引名称：`farmId_1_taskDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`taskDate`，排序：降序

**索引2：任务类型和状态索引**
- 索引名称：`taskType_1_status_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`taskType`，排序：升序
  - 字段：`status`，排序：升序

#### 🔑 关键字段
- `farmId`：养殖场ID
- `taskType`：任务类型
- `taskDate`：任务日期
- `status`：状态（pending/completed/cancelled）
- `description`：描述
- `userId`：操作用户
- `createTime`：创建时间

---

### 27. task_templates
**用途**：任务模板

#### 📝 创建集合
- **集合名称**：`task_templates`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：养殖场和任务类型索引**
- 索引名称：`farmId_1_taskType_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`taskType`，排序：升序

**索引2：启用状态索引**
- 索引名称：`farmId_1_isActive_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`isActive`，排序：升序

#### 🔑 关键字段
- `farmId`：养殖场ID
- `taskType`：任务类型
- `templateName`：模板名称
- `schedule`：执行计划
- `isActive`：是否启用
- `createTime`：创建时间
- `updateTime`：更新时间

---

## 六、系统管理模块（11个集合）

### 28. sys_audit_logs
**用途**：系统操作审计日志

#### 📝 创建集合
- **集合名称**：`sys_audit_logs`
- **权限类型**：选择"所有用户不可读写"
  - 审计日志只能由云函数访问，用户不可见

#### 📊 添加索引

**索引1：用户和创建时间索引**
- 索引名称：`userId_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`userId`，排序：升序
  - 字段：`createTime`，排序：降序

**索引2：模块和创建时间索引**
- 索引名称：`module_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`module`，排序：升序
  - 字段：`createTime`，排序：降序

**索引3：操作类型索引**
- 索引名称：`action_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`action`，排序：升序
  - 字段：`createTime`，排序：降序

#### 🔑 关键字段
- `userId`：用户openid
- `action`：操作类型（create/update/delete/query）
- `module`：模块
- `details`：详情
- `ipAddress`：IP地址
- `createTime`：创建时间

---

### 29. sys_ai_cache
**用途**：AI缓存

#### 📝 创建集合
- **集合名称**：`sys_ai_cache`
- **权限类型**：选择"所有用户不可读写"
  - 缓存由云函数管理

#### 📊 添加索引

**索引1：缓存键索引**
- 索引名称：`cacheKey_1`
- 索引属性：唯一
- 索引字段：
  - 字段：`cacheKey`，排序：升序

**索引2：过期时间索引**
- 索引名称：`expiresAt_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`expiresAt`，排序：升序

#### 🔑 关键字段
- `cacheKey`：缓存键
- `cacheValue`：缓存值
- `expiresAt`：过期时间
- `createTime`：创建时间

---

### 30. sys_ai_usage
**用途**：AI使用统计

#### 📝 创建集合
- **集合名称**：`sys_ai_usage`
- **权限类型**：选择"所有用户不可读写"

#### 📊 添加索引

**索引1：用户和创建时间索引**
- 索引名称：`userId_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`userId`，排序：升序
  - 字段：`createTime`，排序：降序

**索引2：模型和创建时间索引**
- 索引名称：`model_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`model`，排序：升序
  - 字段：`createTime`，排序：降序

#### 🔑 关键字段
- `userId`：用户openid
- `model`：AI模型
- `promptTokens`：输入token数
- `completionTokens`：输出token数
- `totalCost`：总成本
- `createTime`：创建时间

---

### 31. sys_approval_logs
**用途**：审批日志

#### 📝 创建集合
- **集合名称**：`sys_approval_logs`
- **权限类型**：选择"所有用户可读"

#### 📊 添加索引

**索引1：申请ID索引**
- 索引名称：`requestId_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`requestId`，排序：升序

**索引2：审批人索引**
- 索引名称：`approverOpenid_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`approverOpenid`，排序：升序
  - 字段：`createTime`，排序：降序

#### 🔑 关键字段
- `requestId`：申请ID
- `approverOpenid`：审批人openid
- `action`：审批动作（approve/reject）
- `reason`：原因
- `createTime`：创建时间

---

### 32. sys_cleanup_logs
**用途**：数据清理日志

#### 📝 创建集合
- **集合名称**：`sys_cleanup_logs`
- **权限类型**：选择"所有用户不可读写"

#### 📊 添加索引

**索引1：集合名称索引**
- 索引名称：`collectionName_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`collectionName`，排序：升序
  - 字段：`createTime`，排序：降序

#### 🔑 关键字段
- `collectionName`：集合名称
- `cleanupType`：清理类型
- `deletedCount`：删除数量
- `createTime`：创建时间

---

### 33. sys_configurations
**用途**：系统配置

#### 📝 创建集合
- **集合名称**：`sys_configurations`
- **权限类型**：选择"所有用户不可读写"

#### 📊 添加索引

**索引1：配置键索引**
- 索引名称：`configKey_1`
- 索引属性：唯一
- 索引字段：
  - 字段：`configKey`，排序：升序

#### 🔑 关键字段
- `configKey`：配置键
- `configValue`：配置值
- `description`：描述
- `updateTime`：更新时间

---

### 34. sys_overview_stats
**用途**：系统概览统计

#### 📝 创建集合
- **集合名称**：`sys_overview_stats`
- **权限类型**：选择"所有用户可读"

#### 📊 添加索引

**索引1：养殖场和统计日期索引**
- 索引名称：`farmId_1_statDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`statDate`，排序：降序

#### 🔑 关键字段
- `farmId`：养殖场ID
- `statDate`：统计日期
- `totalBatches`：总批次数
- `activeBatches`：活跃批次数
- `totalStock`：总存栏
- `healthRate`：健康率
- `createTime`：创建时间

---

### 35. sys_notifications
**用途**：系统通知

#### 📝 创建集合
- **集合名称**：`sys_notifications`
- **权限类型**：选择"所有用户可读"

#### 📊 添加索引

**索引1：创建时间索引**
- 索引名称：`createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`createTime`，排序：降序

**索引2：通知类型索引**
- 索引名称：`notificationType_1_createTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`notificationType`，排序：升序
  - 字段：`createTime`，排序：降序

#### 🔑 关键字段
- `notificationType`：通知类型
- `targetUsers`：目标用户数组
- `title`：标题
- `content`：内容
- `createTime`：创建时间

---

### 36. sys_permissions
**用途**：权限定义

#### 📝 创建集合
- **集合名称**：`sys_permissions`
- **权限类型**：选择"所有用户可读"

#### 📊 添加索引

**索引1：权限代码索引**
- 索引名称：`permissionCode_1`
- 索引属性：唯一
- 索引字段：
  - 字段：`permissionCode`，排序：升序

**索引2：模块索引**
- 索引名称：`module_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`module`，排序：升序

#### 🔑 关键字段
- `permissionCode`：权限代码
- `permissionName`：权限名称
- `module`：所属模块
- `description`：描述
- `createTime`：创建时间

---

### 37. sys_roles
**用途**：角色定义

#### 📝 创建集合
- **集合名称**：`sys_roles`
- **权限类型**：选择"所有用户可读"

#### 📊 添加索引

**索引1：角色代码索引**
- 索引名称：`roleCode_1`
- 索引属性：唯一
- 索引字段：
  - 字段：`roleCode`，排序：升序

#### 🔑 关键字段
- `roleCode`：角色代码
- `roleName`：角色名称
- `permissions`：权限数组
- `description`：描述
- `createTime`：创建时间

---

### 38. sys_storage_statistics
**用途**：存储统计

#### 📝 创建集合
- **集合名称**：`sys_storage_statistics`
- **权限类型**：选择"所有用户不可读写"

#### 📊 添加索引

**索引1：养殖场和统计日期索引**
- 索引名称：`farmId_1_statDate_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`farmId`，排序：升序
  - 字段：`statDate`，排序：降序

#### 🔑 关键字段
- `farmId`：养殖场ID
- `totalFiles`：总文件数
- `totalSize`：总大小（字节）
- `statDate`：统计日期
- `createTime`：创建时间

---

## 七、文件管理模块（2个集合）

### 39. file_dynamic_records
**用途**：动态文件记录（与业务记录关联的文件）

#### 📝 创建集合
- **集合名称**：`file_dynamic_records`
- **权限类型**：选择"所有用户可读、创建者可读写"

#### 📊 添加索引

**索引1：关联模块和ID索引**
- 索引名称：`relatedModule_1_relatedId_1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`relatedModule`，排序：升序
  - 字段：`relatedId`，排序：升序

**索引2：上传用户和时间索引**
- 索引名称：`userId_1_uploadTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`userId`，排序：升序
  - 字段：`uploadTime`，排序：降序

#### 🔑 关键字段
- `fileId`：文件ID（云存储fileID）
- `fileName`：文件名
- `fileType`：文件类型（image/video/document）
- `fileSize`：文件大小（字节）
- `relatedModule`：关联模块（health/production/finance）
- `relatedId`：关联记录ID
- `uploadTime`：上传时间
- `userId`：上传用户

---

### 40. file_static_records
**用途**：静态文件记录（知识库、资料等）

#### 📝 创建集合
- **集合名称**：`file_static_records`
- **权限类型**：选择"所有用户可读"

#### 📊 添加索引

**索引1：分类和上传时间索引**
- 索引名称：`category_1_uploadTime_-1`
- 索引属性：非唯一
- 索引字段：
  - 字段：`category`，排序：升序
  - 字段：`uploadTime`，排序：降序

**索引2：文件ID索引**
- 索引名称：`fileId_1`
- 索引属性：唯一
- 索引字段：
  - 字段：`fileId`，排序：升序

#### 🔑 关键字段
- `fileId`：文件ID（云存储fileID）
- `fileName`：文件名
- `fileType`：文件类型
- `fileSize`：文件大小
- `category`：分类（knowledge/training/policy）
- `uploadTime`：上传时间

---

## 附录：权限类型说明

### 1. 所有用户可读、创建者可读写
**适用场景**：养殖场成员需要查看所有记录，但只能修改自己创建的记录
- 生产管理记录
- 健康管理记录
- 财务记录
- 任务记录

### 2. 仅创建者可读写
**适用场景**：个人敏感信息，只能本人和管理员访问
- 用户信息
- 邀请码
- 个人通知

### 3. 所有用户可读
**适用场景**：系统生成的公共信息，所有人可查看但不能修改
- 系统通知
- 统计报表
- 权限定义
- 角色定义

### 4. 所有用户不可读写
**适用场景**：系统内部数据，只能由云函数访问
- 审计日志
- AI缓存
- 系统配置
- 存储统计

### 5. 自定义安全规则
**适用场景**：复杂权限控制（本项目暂不使用）

---

## 配置检查清单

### ✅ 按模块创建集合
- [ ] 用户管理模块（4个集合）
- [ ] 生产管理模块（6个集合）
- [ ] 健康管理模块（9个集合）
- [ ] 财务管理模块（4个集合）
- [ ] 任务管理模块（4个集合）
- [ ] 系统管理模块（11个集合）
- [ ] 文件管理模块（2个集合）

### ✅ 权限配置检查
- [ ] 仅创建者可读写：4个集合
- [ ] 所有用户可读、创建者可读写：20个集合
- [ ] 所有用户可读：10个集合
- [ ] 所有用户不可读写：6个集合

### ✅ 索引配置检查
- [ ] 所有高频查询字段已创建索引
- [ ] 唯一字段已设置唯一索引
- [ ] 复合索引字段顺序正确

---

## 常见问题

### Q1：为什么需要这么多索引？
A：索引可以显著提升查询性能。对于高频查询字段（如farmId、batchId、日期字段），建议创建索引。

### Q2：索引会影响写入性能吗？
A：是的，但影响很小。鹅数通小程序是读多写少的场景，索引带来的查询性能提升远大于写入性能的影响。

### Q3：权限配置后还能修改吗？
A：可以。在云开发控制台的"数据库" → "集合" → "权限设置"中随时修改。

### Q4：如何验证权限配置是否正确？
A：在小程序中测试不同角色的用户访问权限，确保符合预期。

### Q5：如何处理数据迁移？
A：本项目采用标准化命名规范（如 `health_ai_diagnosis`），所有新功能都使用规范集合名称。如需从旧集合迁移数据，建议先导出旧数据，转换字段格式后导入新集合。

---

## 相关文档

- [shared-config/collections.js](./shared-config/collections.js) - 统一集合配置文件
- [COMPLIANCE_REPORT.md](./COMPLIANCE_REPORT.md) - 合规优化报告
- [SUBPACKAGE_COMPLETE.md](./SUBPACKAGE_COMPLETE.md) - 分包配置完成报告
- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)

---

**文档版本**：v1.0  
**更新时间**：2025年10月24日  
**适用项目**：鹅数通智慧养鹅小程序

---

## 💡 使用建议

1. **按模块配置**：先完成一个模块的所有集合配置（包括权限和索引），再进行下一个模块
2. **测试验证**：每创建5-10个集合后，在小程序中测试访问权限和查询性能
3. **记录进度**：在检查清单中勾选已完成的集合
4. **备份配置**：完成配置后，导出集合列表作为备份

**预计配置时间**：2-3小时（40个集合 × 约3-5分钟/集合）

---

🎉 **祝配置顺利！**

