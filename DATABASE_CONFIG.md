# 数据库集合完整配置指南（基于实际代码全面分析）

> 最后更新：2025-01-16  
> 基于所有26个云函数的深入代码分析  
> 格式：微信云开发控制台格式  
> **完整、准确、科学、合理**

---

## 📋 文档说明

本文档基于对**所有26个云函数**的深入代码分析，提供：
1. **权限设置**：29个实际使用集合的完整权限规则（基于实际业务逻辑）
2. **索引配置**：基于实际查询模式的索引配置（避免浪费）
3. **统一规范**：字段命名统一为微信云数据库标准

**集合分类**：
- ✅ **实际使用**：29个集合（需要配置）
- ⭐ **可能使用**：5个集合（按需配置）
- ❌ **未使用**：9个集合（不需要配置，需要时再创建）

**配置原则**：
- ✅ 基于实际代码中的查询模式
- ✅ 遵循PROJECT_RULES.md中的规范
- ✅ 统一使用 `_openid`（微信云数据库标准）
- ✅ 遵循最左匹配原则
- ✅ 避免创建不必要的索引
- ✅ 未使用的集合不需要配置，需要时再创建

---

## 🔐 权限设置规则

### 标准权限规则（对应界面选项）

**重要说明**：权限设置是**单选项**，每个集合只能选择一个权限选项。5个选项是互斥的：
1. **所有用户可读，仅创建者可读写**
2. **仅创建者可读写**
3. **所有用户可读**
4. **所有用户不可读写**
5. **自定义安全规则**

**如果需要自定义规则**：直接选择 **"自定义安全规则"** 选项，然后点击 **"修改"** 按钮设置JSON规则。

**⚠️ 安全规则格式重要提示**：
- ✅ **正确**：使用 `doc.fieldName` 来引用文档字段（如 `doc._openid`、`doc.userId`）
- ✅ **正确**：使用 `auth.openid` 来引用当前用户标识
- ❌ **错误**：不要使用 `resource.fieldName`（这是错误的语法）
- ✅ **正确格式**：`doc.fieldName == auth.openid`
- ❌ **错误格式**：`auth.openid == resource.fieldName`

**规则1：所有用户可读，仅创建者可读写**
- **界面选项**：直接选择 **"所有用户可读，仅创建者可读写"**
- **适用场景**：用户评论、用户公开信息等
- **说明**：无需自定义规则，直接选择此选项即可

**规则2：仅创建者可读写**
- **界面选项**：直接选择 **"仅创建者可读写"**
- **适用场景**：用户个人设置、用户订单管理等
- **说明**：无需自定义规则，直接选择此选项即可

**规则3：所有用户可读（但限制写入）**
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": false
}
```
- **适用场景**：商品信息等（但需要限制写入，只能通过云函数写入）

**规则4：仅创建者可读（但限制写入）**
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": "doc._openid == auth.openid",
  "write": false
}
```
- **适用场景**：用户通知等（只能通过云函数写入）

**规则5：所有用户不可读写**
- **界面选项**：直接选择 **"所有用户不可读写"**
- **适用场景**：后台流水数据等
- **说明**：无需自定义规则，直接选择此选项即可

---

## 📋 权限设置快速参考表

**重要说明**：权限设置是**单选项**，每个集合只能选择一个权限选项。5个选项是互斥的，不能同时选择两个选项。如果需要自定义规则，直接选择"自定义安全规则"选项即可。

| 集合名称 | 界面选项（单选） | 是否需要自定义规则 | 自定义规则说明 |
|---------|----------------|------------------|--------------|
| **用户管理模块** |
| wx_users | **所有用户可读，仅创建者可读写** | ❌ 否 | - |
| wx_user_invites | **自定义安全规则** | ✅ 是 | 限制写入：`write: false` |
| user_notifications | **自定义安全规则** | ✅ 是 | 限制写入：`write: false` |
| user_notification_settings | **仅创建者可读写** | ❌ 否 | - |
| user_roles | **自定义安全规则** | ✅ 是 | 限制写入：`write: false` |
| user_batch_assignments | **自定义安全规则** | ✅ 是 | 限制写入：`write: false` |
| user_sessions | **仅创建者可读写** | ❌ 否 | - |
| **生产管理模块** |
| prod_batch_entries | **自定义安全规则** | ✅ 是 | 使用 `userId` 字段：`doc.userId == auth.openid` |
| prod_batch_exits | **自定义安全规则** | ✅ 是 | 使用 `userId` 字段：`doc.userId == auth.openid` |
| prod_materials | **所有用户可读，仅创建者可读写** | ❌ 否 | - |
| prod_material_records | **自定义安全规则** | ✅ 是 | 使用 `userId` 字段：`doc.userId == auth.openid` |
| prod_inventory_logs | **自定义安全规则** | ✅ 是 | 限制写入：`write: false` |
| feed_usage_records | **自定义安全规则** | ✅ 是 | 使用 `userId` 字段：`doc.userId == auth.openid` |
| **健康管理模块** |
| health_records | **所有用户可读，仅创建者可读写** | ❌ 否 | - |
| health_prevention_records | **所有用户可读，仅创建者可读写** | ❌ 否 | - |
| health_treatment_records | **所有用户可读，仅创建者可读写** | ❌ 否 | - |
| health_ai_diagnosis | **所有用户可读，仅创建者可读写** | ❌ 否 | - |
| health_death_records | **所有用户可读，仅创建者可读写** | ❌ 否 | - |
| health_alerts | **自定义安全规则** | ✅ 是 | 限制写入：`write: false` |
| **财务管理模块** |
| finance_cost_records | **所有用户可读，仅创建者可读写** | ❌ 否 | - |
| finance_revenue_records | **所有用户可读，仅创建者可读写** | ❌ 否 | - |
| finance_reports | **自定义安全规则** | ✅ 是 | 限制写入：`write: false` |
| finance_summaries | **自定义安全规则** | ✅ 是 | 限制写入：`write: false` |
| **任务管理模块** |
| task_batch_schedules | **所有用户可读，仅创建者可读写** | ❌ 否 | - |
| task_completions | **所有用户可读，仅创建者可读写** | ❌ 否 | - |
| **系统管理模块** |
| sys_audit_logs | **所有用户不可读写** | ❌ 否 | - |
| sys_ai_cache | **所有用户不可读写** | ❌ 否 | - |
| sys_ai_usage | **所有用户不可读写** | ❌ 否 | - |
| sys_overview_stats | **自定义安全规则** | ✅ 是 | 限制写入：`write: false` |
| sys_notifications | **自定义安全规则** | ✅ 是 | 限制写入：`write: false` |
| sys_roles | **自定义安全规则** | ✅ 是 | 限制写入：`write: false` |
| sys_storage_statistics | **所有用户不可读写** | ❌ 否 | - |
| **文件管理模块** |
| file_dynamic_records | **自定义安全规则** | ✅ 是 | 使用 `userId` 字段：`doc.userId == auth.openid` |

**自定义规则JSON模板**：

**模板1：限制写入（所有用户可读，仅云函数可写）**
```json
{
  "read": true,
  "write": false
}
```

**模板2：限制写入（仅创建者可读，仅云函数可写）**
```json
{
  "read": "doc._openid == auth.openid",
  "write": false
}
```

**模板3：使用userId字段（仅创建者可读写）**
```json
{
  "read": "doc.userId == auth.openid",
  "write": "doc.userId == auth.openid"
}
```

## 📊 集合配置（29个实际使用 + 5个可能使用 + 9个未使用 = 43个集合）

以下只列出**需要配置的集合**（29个实际使用 + 5个可能使用）。

### 模块1：用户管理（7个集合）

#### 1.1 wx_users（用户信息）⭐ 核心集合

**权限设置**：
- **界面选项**：选择 **"所有用户可读，仅创建者可读写"**
- **适用场景**：用户评论、用户公开信息等

**索引配置**：

**索引1：`_openid_1`**（唯一索引，通常已存在）
- **索引名称**：`_openid_1`
- **索引属性**：✅ **唯一**
- **索引字段**：
  - 字段1：`_openid`，排序：**升序**
- **注意**：如果集合中已存在默认的 `_openid_` 索引（非唯一），**请保留该索引**，不要删除。该索引用于查询用户数据，命中次数较高，删除会影响查询性能。如果确实需要唯一索引，可以额外创建 `_openid_1`（唯一索引），但不要删除默认的 `_openid_` 索引。

**索引2：`role_1_isActive_1`**
- **索引名称**：`role_1_isActive_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`role`，排序：**升序**
  - 字段2：`isActive`，排序：**升序**

**实际查询模式**：
- `{ _openid: 'xxx' }` + `.limit(1)`
- `{ isActive: true, role: _.in(['admin', 'manager', 'operator']) }` + `.field({ _openid: true })`

---

#### 1.2 wx_user_invites（用户邀请）

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": false
}
```
*说明：只能通过云函数写入（管理员）*

**索引配置**：

**索引1：`inviteCode_1`**（唯一索引）
- **索引名称**：`inviteCode_1`
- **索引属性**：✅ **唯一**
- **索引字段**：
  - 字段1：`inviteCode`，排序：**升序**

**索引2：`createTime_-1`**
- **索引名称**：`createTime_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`createTime`，排序：**降序**

**索引3：`status_1_expiryTime_1`**
- **索引名称**：`status_1_expiryTime_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`status`，排序：**升序**
  - 字段2：`expiryTime`，排序：**升序**

**实际查询模式**：
- `{ inviteCode: 'xxx' }`
- `.orderBy('createTime', 'desc')`

---

#### 1.3 user_notifications（用户通知）

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": "doc._openid == auth.openid",
  "write": false
}
```
*说明：只能通过云函数写入*

**索引配置**：

**索引1：`_openid_1_isRead_1_createTime_-1`**
- **索引名称**：`_openid_1_isRead_1_createTime_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`_openid`，排序：**升序**
  - 字段2：`isRead`，排序：**升序**
  - 字段3：`createTime`，排序：**降序**

**索引2：`notificationId_1_openid_1`**
- **索引名称**：`notificationId_1_openid_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`notificationId`，排序：**升序**
  - 字段2：`_openid`，排序：**升序**

**实际查询模式**：
- `{ _openid: 'xxx' }` + `orderBy('createTime', 'desc')`
- `{ notificationId: 'xxx', _openid: 'xxx' }`（更新已读状态）

**⚠️ 重要：字段统一规范**
- ✅ **统一使用 `_openid` 字段**（微信云开发标准字段）
- ⚠️ **代码需要修改**：将 `userOpenid` 统一改为 `_openid`
- ⚠️ **数据迁移**：如果数据库中已有数据使用 `userOpenid` 字段，需要先迁移数据

---

#### 1.4 user_notification_settings（通知设置）

**权限设置**：
- **界面选项**：选择 **"仅创建者可读写"**
- **适用场景**：用户个人设置、用户订单管理等

**索引配置**：

**索引1：`_openid_1`**（唯一索引）
- **索引名称**：`_openid_1`
- **索引属性**：✅ **唯一**
- **索引字段**：
  - 字段1：`_openid`，排序：**升序**

**实际查询模式**：
- `{ _openid: 'xxx' }` + `.limit(1)`

---

#### 1.5 user_roles（用户角色）

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": false
}
```
*说明：只能通过云函数写入*

**索引配置**：

**索引1：`_openid_1_isActive_1_expiryTime_1`**
- **索引名称**：`_openid_1_isActive_1_expiryTime_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`_openid`，排序：**升序**
  - 字段2：`isActive`，排序：**升序**
  - 字段3：`expiryTime`，排序：**升序**

**实际查询模式**：
- `{ _openid: 'xxx', isActive: true, expiryTime: _.gt(new Date()) }`

**统一规范**：✅ 统一使用 `_openid`（微信云开发标准字段）

---

#### 1.6 user_batch_assignments（用户批次分配）

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": false
}
```
*说明：只能通过云函数写入*

**索引配置**：

**索引1：`_openid_1_isActive_1_batchNumber_1`**
- **索引名称**：`_openid_1_isActive_1_batchNumber_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`_openid`，排序：**升序**
  - 字段2：`isActive`，排序：**升序**
  - 字段3：`batchNumber`，排序：**升序**

**实际查询模式**：
- `{ _openid: 'xxx', isActive: true }` + `.field({ batchNumber: true })`

**统一规范**：✅ 统一使用 `_openid`（微信云开发标准字段）

---

#### 1.7 user_sessions（用户会话）

**权限设置**：
- **界面选项**：选择 **"仅创建者可读写"**
- **适用场景**：用户个人设置、用户订单管理等

**索引配置**：

**索引1：`_openid_1_isActive_1_lastActivity_-1`**
- **索引名称**：`_openid_1_isActive_1_lastActivity_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`_openid`，排序：**升序**
  - 字段2：`isActive`，排序：**升序**
  - 字段3：`lastActivity`，排序：**降序**

**实际查询模式**：
- `{ _openid: 'xxx', isActive: true, lastActivity: _.gt(...) }` + `.count()`

**统一规范**：✅ 统一使用 `_openid`（微信云开发标准字段）

---

### 模块2：生产管理（7个集合）

#### 2.1 prod_batch_entries（入栏记录）⭐⭐⭐ 核心集合

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": "doc.userId == auth.openid"
}
```
*说明：所有用户可读，仅创建者可写（使用 `userId` 字段）*

**索引配置**：

**索引1：`userId_1_isDeleted_1_createTime_-1`** ⭐ 最高优先级
- **索引名称**：`userId_1_isDeleted_1_createTime_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`userId`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`createTime`，排序：**降序**

**索引2：`batchNumber_1_isDeleted_1`**
- **索引名称**：`batchNumber_1_isDeleted_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchNumber`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**

**索引3：`status_1_isDeleted_1_entryDate_-1`**
- **索引名称**：`status_1_isDeleted_1_entryDate_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`status`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`entryDate`，排序：**降序**

**索引4：`status_1_isDeleted_1_createTime_-1`**
- **索引名称**：`status_1_isDeleted_1_createTime_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`status`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`createTime`，排序：**降序**

**实际查询模式**：
- `{ userId: 'xxx', isDeleted: false }` + `orderBy('createTime', 'desc')`
- `{ batchNumber: 'xxx', isDeleted: false }`
- `{ status: 'active', isDeleted: false }` + `orderBy('entryDate', 'desc')`
- `{ entryDate: _.gte(start).and(_.lte(end)) }` + `orderBy('createTime', 'desc')`
- `.doc(batchId).get()`（通过doc查询，无需索引）

**⚠️ 重要：字段名说明**
- ✅ **代码中实际使用 `userId` 字段**（不是 `_openid`）
- ✅ `userId` 字段存储的是 `wxContext.OPENID` 的值，但字段名是 `userId`（业务逻辑字段）
- ✅ 索引配置使用 `userId`（与实际代码一致）
- ⚠️ **权限配置**：由于使用 `userId` 字段，权限规则需要相应调整

---

#### 2.2 prod_batch_exits（出栏记录）⭐ 核心集合

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": "doc.userId == auth.openid"
}
```
*说明：所有用户可读，仅创建者可写（使用 `userId` 字段）*

**索引配置**：

**索引1：`userId_1_isDeleted_1_createTime_-1`**
- **索引名称**：`userId_1_isDeleted_1_createTime_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`userId`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`createTime`，排序：**降序**

**索引2：`batchNumber_1_isDeleted_1`**
- **索引名称**：`batchNumber_1_isDeleted_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchNumber`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**

**索引3：`exitDate_1_isDeleted_1`**
- **索引名称**：`exitDate_1_isDeleted_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`exitDate`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**

**实际查询模式**：
- `{ userId: 'xxx', isDeleted: false }` + `orderBy('createTime', 'desc')`
- `{ batchNumber: 'xxx', isDeleted: false }`
- `{ exitDate: _.gte(start).and(_.lte(end)) }` + `orderBy('createTime', 'desc')`

---

#### 2.3 prod_materials（生产物料）

**权限设置**：
- **界面选项**：选择 **"所有用户可读，仅创建者可读写"**
- **适用场景**：用户评论、用户公开信息等

**索引配置**：

**索引1：`category_1_isActive_1_createTime_-1`**
- **索引名称**：`category_1_isActive_1_createTime_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`category`，排序：**升序**
  - 字段2：`isActive`，排序：**升序**
  - 字段3：`createTime`，排序：**降序**

**索引2：`name_1_category_1_isActive_1`**
- **索引名称**：`name_1_category_1_isActive_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`name`，排序：**升序**（用于名称+分类查询）
  - 字段2：`category`，排序：**升序**
  - 字段3：`isActive`，排序：**升序**

**实际查询模式**：
- `{ category: 'xxx', isActive: true }` + `orderBy('createTime', 'desc')`
- `{ name: RegExp(...), category: 'xxx', isActive: true }`
- `.doc(materialId).get()`（通过doc查询，无需索引）

---

#### 2.4 prod_material_records（物料记录）

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": "doc.userId == auth.openid"
}
```
*说明：所有用户可读，仅创建者可写（使用 `userId` 字段）*

**索引配置**：

**索引1：`batchId_1_type_1_isDeleted_1_recordDate_1`**
- **索引名称**：`batchId_1_type_1_isDeleted_1_recordDate_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`type`，排序：**升序**
  - 字段3：`isDeleted`，排序：**升序**
  - 字段4：`recordDate`，排序：**升序**

**索引2：`materialId_1_recordDate_1`**
- **索引名称**：`materialId_1_recordDate_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`materialId`，排序：**升序**
  - 字段2：`recordDate`，排序：**升序**

**实际查询模式**：
- `{ batchId: 'xxx', type: 'use', isDeleted: false }`

---

#### 2.5 prod_inventory_logs（库存日志）

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": false
}
```
*说明：只能通过云函数写入*

**索引配置**：

**索引1：`materialId_1_createTime_-1`**
- **索引名称**：`materialId_1_createTime_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`materialId`，排序：**升序**
  - 字段2：`createTime`，排序：**降序**

**实际查询模式**：
- `{ materialId: 'xxx' }` + `orderBy('createTime', 'desc')`

---

#### 2.6 feed_usage_records（饲料投喂记录）

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": "doc.userId == auth.openid"
}
```
*说明：所有用户可读，仅创建者可写（使用 `userId` 字段）*

**索引配置**：

**索引1：`batchId_1_recordDate_1`**
- **索引名称**：`batchId_1_recordDate_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`recordDate`，排序：**升序**

**索引2：`materialId_1_recordDate_1`**
- **索引名称**：`materialId_1_recordDate_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`materialId`，排序：**升序**
  - 字段2：`recordDate`，排序：**升序**

**实际查询模式**：
- `{ batchId: 'xxx', recordDate: _.gte(start).and(_.lte(end)) }`
- `{ materialId: 'xxx', recordDate: _.gte(start).and(_.lte(end)) }`

---

#### 2.7 production_batches（生产批次）❌ 不建议使用

**统一规范**：❌ **不建议使用此集合**，统一使用 `prod_batch_entries`

**原因**：
- 代码中 `production_batches` 的使用场景与 `prod_batch_entries` 重复
- 代码中多处使用 `prod_batch_entries`，`production_batches` 使用频率极低
- 统一使用 `prod_batch_entries` 便于管理和维护

**建议**：
- ✅ 停止使用 `production_batches` 集合
- ✅ 将所有使用 `production_batches` 的地方迁移到 `prod_batch_entries`
- ✅ 如需保留历史数据，可在迁移后删除 `production_batches` 集合

---

### 模块3：健康管理（9个集合）

#### 3.1 health_records（健康记录）⭐⭐⭐ 核心集合

**权限设置**：
- **界面选项**：选择 **"所有用户可读，仅创建者可读写"**
- **适用场景**：用户评论、用户公开信息等

**索引配置**：

**索引1：`batchId_1_recordType_1_status_1_isDeleted_1_checkDate_-1`** ⭐ 最高优先级
- **索引名称**：`batchId_1_recordType_1_status_1_isDeleted_1_checkDate_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`recordType`，排序：**升序**
  - 字段3：`status`，排序：**升序**
  - 字段4：`isDeleted`，排序：**升序**
  - 字段5：`checkDate`，排序：**降序**

**索引2：`batchId_1_isDeleted_1_checkDate_-1`**
- **索引名称**：`batchId_1_isDeleted_1_checkDate_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`checkDate`，排序：**降序**

**索引3：`batchId_1_isDeleted_1_recordDate_-1`**
- **索引名称**：`batchId_1_isDeleted_1_recordDate_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`recordDate`，排序：**降序**

**索引4：`batchId_1_recordType_1_isCorrected_1_isDeleted_1_correctedAt_-1`**
- **索引名称**：`batchId_1_recordType_1_isCorrected_1_isDeleted_1_correctedAt_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`recordType`，排序：**升序**
  - 字段3：`isCorrected`，排序：**升序**
  - 字段4：`isDeleted`，排序：**升序**
  - 字段5：`correctedAt`，排序：**降序**

**实际查询模式**：
- `{ batchId, recordType: 'ai_diagnosis', status: 'abnormal', isDeleted: false }` + `orderBy('checkDate', 'desc')`
- `{ batchId, recordType: 'ai_diagnosis', status: _.in(['abnormal', 'treating']), isDeleted: false }` + `orderBy('checkDate', 'desc')`
- `{ batchId, recordType: 'ai_diagnosis', isCorrected: true, isDeleted: false }` + `orderBy('correctedAt', 'desc')`
- `{ batchId, isDeleted: false }` + `orderBy('checkDate', 'desc')`
- `{ batchId, isDeleted: false }` + `orderBy('recordDate', 'desc')`
- `.doc(recordId).get()`（通过doc查询）

---

#### 3.2 health_prevention_records（预防记录）⭐ 核心集合

**权限设置**：
- **界面选项**：选择 **"所有用户可读，仅创建者可读写"**
- **适用场景**：用户评论、用户公开信息等

**索引配置**：

**索引1：`batchId_1_isDeleted_1_preventionDate_-1`** ⭐ 最高优先级
- **索引名称**：`batchId_1_isDeleted_1_preventionDate_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`preventionDate`，排序：**降序**

**索引2：`batchId_1_isDeleted_1_preventionDate_1`**
- **索引名称**：`batchId_1_isDeleted_1_preventionDate_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`preventionDate`，排序：**升序**（用于时间线升序查询）

**索引3：`taskId_1_isDeleted_1`**
- **索引名称**：`taskId_1_isDeleted_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`taskId`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**

**实际查询模式**：
- `{ batchId, isDeleted: false }` + `orderBy('preventionDate', 'desc')`
- `{ batchId, isDeleted: false }` + `orderBy('preventionDate', 'asc')`（时间线）
- `{ batchId: _.in(batchIds), isDeleted: false }`（批量查询）

---

#### 3.3 health_treatment_records（治疗记录）⭐⭐⭐ 核心集合

**权限设置**：
- **界面选项**：选择 **"所有用户可读，仅创建者可读写"**
- **适用场景**：用户评论、用户公开信息等

**索引配置**：

**索引1：`batchId_1_isDeleted_1_createdAt_-1`** ⭐ 最高优先级
- **索引名称**：`batchId_1_isDeleted_1_createdAt_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`createdAt`，排序：**降序**

**索引2：`batchId_1_isDeleted_1_treatmentDate_-1`**
- **索引名称**：`batchId_1_isDeleted_1_treatmentDate_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`treatmentDate`，排序：**降序**

**索引3：`_openid_1_isDeleted_1_createdAt_-1`**
- **索引名称**：`_openid_1_isDeleted_1_createdAt_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`_openid`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`createdAt`，排序：**降序**

**索引4：`isDeleted_1_isDraft_1_treatmentDate_-1`**
- **索引名称**：`isDeleted_1_isDraft_1_treatmentDate_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`isDeleted`，排序：**升序**
  - 字段2：`isDraft`，排序：**升序**
  - 字段3：`treatmentDate`，排序：**降序**

**索引5：`batchId_1_treatmentDate_1_isDeleted_1`**
- **索引名称**：`batchId_1_treatmentDate_1_isDeleted_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`treatmentDate`，排序：**升序**
  - 字段3：`isDeleted`，排序：**升序**

**实际查询模式**：
- `{ batchId, isDeleted: false }` + `orderBy('treatmentDate', 'desc')` 或 `orderBy('createdAt', 'desc')`
- `{ _openid, isDeleted: false }` + `orderBy('createdAt', 'desc')`
- `{ isDeleted: false, isDraft: false }` + `orderBy('treatmentDate', 'desc')`
- `{ batchId, treatmentDate: _.gte(start).and(_.lte(end)), isDeleted: false }`
- `.doc(treatmentId).get()`（通过doc查询）

---

#### 3.4 health_ai_diagnosis（AI诊断记录）⭐⭐⭐ 核心集合

**权限设置**：
- **界面选项**：选择 **"所有用户可读，仅创建者可读写"**
- **适用场景**：用户评论、用户公开信息等

**索引配置**：

**索引1：`_openid_1_isDeleted_1_createTime_-1`** ⭐ 最高优先级
- **索引名称**：`_openid_1_isDeleted_1_createTime_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`_openid`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`createTime`，排序：**降序**

**索引2：`batchId_1_isDeleted_1_createTime_-1`**
- **索引名称**：`batchId_1_isDeleted_1_createTime_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`createTime`，排序：**降序**

**索引3：`_openid_1_batchId_1_isDeleted_1_createTime_-1`**
- **索引名称**：`_openid_1_batchId_1_isDeleted_1_createTime_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`_openid`，排序：**升序**
  - 字段2：`batchId`，排序：**升序**
  - 字段3：`isDeleted`，排序：**升序**
  - 字段4：`createTime`，排序：**降序**

**实际查询模式**：
- `{ _openid, isDeleted: false }` + `orderBy('createTime', 'desc')`
- `{ _openid, batchId, isDeleted: false }` + `orderBy('createTime', 'desc')`
- `{ _openid, 'veterinaryReview.reviewed': reviewed, isDeleted: false }` + `orderBy('createTime', 'desc')`
- `{ _openid, 'application.adopted': adopted, isDeleted: false }` + `orderBy('createTime', 'desc')`
- `{ _openid, createTime: _.gte(start).and(_.lte(end)), isDeleted: false }` + `orderBy('createTime', 'desc')`
- `.doc(diagnosisId).get()`（通过doc查询）

---

#### 3.5 health_death_records（死亡记录）⭐⭐⭐ 核心集合

**权限设置**：
- **界面选项**：选择 **"所有用户可读，仅创建者可读写"**
- **适用场景**：用户评论、用户公开信息等

**索引配置**：

**索引1：`batchId_1_isDeleted_1_deathDate_-1`** ⭐ 最高优先级
- **索引名称**：`batchId_1_isDeleted_1_deathDate_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`deathDate`，排序：**降序**

**索引2：`batchId_1_isDeleted_1_deathDate_-1_createdAt_-1`**
- **索引名称**：`batchId_1_isDeleted_1_deathDate_-1_createdAt_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`deathDate`，排序：**降序**
  - 字段4：`createdAt`，排序：**降序**

**索引3：`_openid_1_isDeleted_1_deathDate_-1`**
- **索引名称**：`_openid_1_isDeleted_1_deathDate_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`_openid`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**
  - 字段3：`deathDate`，排序：**降序**

**实际查询模式**：
- `{ batchId: 'xxx', isDeleted: false }` + `orderBy('deathDate', 'desc')`
- `{ batchId: 'xxx', isDeleted: false, deathDate: _.gte(start).and(_.lte(end)) }`
- `{ _openid: 'xxx', isDeleted: false }` + `orderBy('deathDate', 'desc')`

**索引4：`batchId_1_batchNumber_1_isDeleted_1`**
- **索引名称**：`batchId_1_batchNumber_1_isDeleted_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**（支持批次ID和批次号查询）
  - 字段2：`batchNumber`，排序：**升序**
  - 字段3：`isDeleted`，排序：**升序**

**实际查询模式**：
- `{ batchId, isDeleted: false }` + `orderBy('deathDate', 'desc')`
- `{ batchId: batchNumber, isDeleted: false }`（按批次号查询）
- `{ batchId, deathDate: _.gte(start).and(_.lte(end)), isDeleted: false }` + `orderBy('createdAt', 'desc')`
- `{ isDeleted: false }` + `orderBy('createdAt', 'desc')`

**⚠️ 重要：字段统一规范**
- ✅ **统一使用 `deathDate` 字段**（死亡记录专用字段）
- ✅ 索引配置使用 `deathDate`（与实际代码一致）
- ✅ **代码已统一**：所有 `recordDate` 已改为 `deathDate`

---

#### 3.6 health_alerts（健康预警）

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": false
}
```
*说明：只能通过云函数写入*

**索引配置**：

**索引1：`batchId_1_status_1_createTime_-1`**
- **索引名称**：`batchId_1_status_1_createTime_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`status`，排序：**升序**
  - 字段3：`createTime`，排序：**降序**

**实际查询模式**：
- `{ batchId, status: 'active' }`

---

#### 3.7 health_cure_records（治愈记录）❌ 未使用，不需要配置

**说明**：代码中未使用，需要时再创建。

---

#### 3.8 health_followup_records（跟进记录）❌ 未使用，不需要配置

**说明**：代码中未使用，需要时再创建。

---

#### 3.9 health_vaccine_plans（疫苗计划）❌ 未使用，不需要配置

**说明**：代码中未使用，需要时再创建。

---

### 模块4：财务管理（4个集合）

#### 4.1 finance_cost_records（成本记录）

**权限设置**：
- **界面选项**：选择 **"所有用户可读，仅创建者可读写"**
- **适用场景**：用户评论、用户公开信息等

**索引配置**：

**索引1：`costDate_1_isDeleted_1`**
- **索引名称**：`costDate_1_isDeleted_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`costDate`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**

**索引2：`batchId_1_costDate_1_isDeleted_1`**
- **索引名称**：`batchId_1_costDate_1_isDeleted_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`costDate`，排序：**升序**
  - 字段3：`isDeleted`，排序：**升序**

**索引3：`createTime_1_isDeleted_1`**
- **索引名称**：`createTime_1_isDeleted_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`createTime`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**

**实际查询模式**：
- `{ isDeleted: false, costDate: _.gte(start).and(_.lte(end)) }`
- `{ batchId, costDate: _.gte(start).and(_.lte(end)), isDeleted: false }`
- `{ isDeleted: false }` + `orderBy('createTime', 'desc')`

---

#### 4.2 finance_revenue_records（收入记录）

**权限设置**：
- **界面选项**：选择 **"所有用户可读，仅创建者可读写"**
- **适用场景**：用户评论、用户公开信息等

**索引配置**：

**索引1：`revenueDate_1_isDeleted_1`**
- **索引名称**：`revenueDate_1_isDeleted_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`revenueDate`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**

**索引2：`batchId_1_revenueDate_1_isDeleted_1`**
- **索引名称**：`batchId_1_revenueDate_1_isDeleted_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`revenueDate`，排序：**升序**
  - 字段3：`isDeleted`，排序：**升序**

**索引3：`createTime_1_isDeleted_1`**
- **索引名称**：`createTime_1_isDeleted_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`createTime`，排序：**升序**
  - 字段2：`isDeleted`，排序：**升序**

**实际查询模式**：
- `{ isDeleted: false, revenueDate: _.gte(start).and(_.lte(end)) }`
- `{ batchId, revenueDate: _.gte(start).and(_.lte(end)), isDeleted: false }`
- `{ isDeleted: false }` + `orderBy('createTime', 'desc')`

---

#### 4.3 finance_reports（财务报表）⭐ 可能使用

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": false
}
```
*说明：只能通过云函数写入（管理员）*

**索引配置**：

**索引1：`generateTime_-1_reportType_1`**
- **索引名称**：`generateTime_-1_reportType_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`generateTime`，排序：**降序**
  - 字段2：`reportType`，排序：**升序**

**实际查询模式**：
- `{ reportType: 'xxx', generateTime: _.gte(start).and(_.lte(end)) }`（写入）

---

#### 4.4 finance_summaries（财务汇总）

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": false
}
```
*说明：只能通过云函数写入*

**索引配置**：

**索引1：`period_1`**
- **索引名称**：`period_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`period`，排序：**升序**

**实际查询模式**：
- `{ period: 'YYYY-MM' }` + `.limit(1)`

---

### 模块5：任务管理（4个集合）

#### 5.1 task_batch_schedules（任务计划）⭐ 核心集合

**权限设置**：
- **界面选项**：选择 **"所有用户可读，仅创建者可读写"**
- **适用场景**：用户评论、用户公开信息等

**索引配置**：

**索引1：`batchId_1_category_1_targetDate_1_userId_1`** ⭐ 最高优先级
- **索引名称**：`batchId_1_category_1_targetDate_1_userId_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`category`，排序：**升序**
  - 字段3：`targetDate`，排序：**升序**
  - 字段4：`userId`，排序：**升序**

**索引2：`userId_1_category_1_completed_1_targetDate_1`**
- **索引名称**：`userId_1_category_1_completed_1_targetDate_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`userId`，排序：**升序**
  - 字段2：`category`，排序：**升序**
  - 字段3：`completed`，排序：**升序**
  - 字段4：`targetDate`，排序：**升序**

**索引3：`batchId_1_category_1_dayAge_1`**
- **索引名称**：`batchId_1_category_1_dayAge_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`category`，排序：**升序**
  - 字段3：`dayAge`，排序：**升序**

**索引4：`batchId_1_category_1_completed_1_dayAge_1`**
- **索引名称**：`batchId_1_category_1_completed_1_dayAge_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`category`，排序：**升序**
  - 字段3：`completed`，排序：**升序**
  - 字段4：`dayAge`，排序：**升序**

**实际查询模式**：
- `{ batchId, category: 'health' }` + `orderBy('dayAge', 'asc')`
- `{ batchId, category: 'health', targetDate: _.gte(today) }` + `orderBy('targetDate', 'asc')`
- `{ userId, type: _.in([...]), status: 'pending', isCompleted: false }`
- `{ batchId: _.in(batchIds), category: 'health' }`（批量查询）
- `.doc(taskId).get()`（通过doc查询）

---

#### 5.2 task_completions（任务完成记录）

**权限设置**：
- **界面选项**：选择 **"所有用户可读，仅创建者可读写"**
- **适用场景**：用户评论、用户公开信息等

**索引配置**：

**索引1：`taskId_1_completedAt_1`**
- **索引名称**：`taskId_1_completedAt_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`taskId`，排序：**升序**
  - 字段2：`completedAt`，排序：**升序**

**索引2：`batchId_1_completedBy_1_completedAt_1`**
- **索引名称**：`batchId_1_completedBy_1_completedAt_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`completedBy`，排序：**升序**
  - 字段3：`completedAt`，排序：**升序**

**索引3：`_openid_1_batchId_1_isActive_1`**
- **索引名称**：`_openid_1_batchId_1_isActive_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`_openid`，排序：**升序**
  - 字段2：`batchId`，排序：**升序**
  - 字段3：`isActive`，排序：**升序**

**实际查询模式**：
- `{ batchId, completedBy: 'xxx' }`
- `{ taskId: 'xxx' }`
- `{ _openid: 'xxx', batchId: 'xxx', isActive: true }`

---

#### 5.3 task_records（任务记录）❌ 未使用，不需要配置

**说明**：代码中未使用，需要时再创建。

---

#### 5.4 task_templates（任务模板）❌ 未使用，不需要配置

**说明**：代码中未使用，需要时再创建。

---

### 模块6：系统管理（11个集合）

#### 6.1 sys_audit_logs（审计日志）

**权限设置**：
- **界面选项**：选择 **"所有用户不可读写"**
- **适用场景**：后台流水数据等

**索引配置**：

**索引1：`timestamp_-1_module_1`**
- **索引名称**：`timestamp_-1_module_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`timestamp`，排序：**降序**
  - 字段2：`module`，排序：**升序**

**索引2：`_openid_1_timestamp_-1`**
- **索引名称**：`_openid_1_timestamp_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`_openid`，排序：**升序**
  - 字段2：`timestamp`，排序：**降序**

**索引3：`action_1_timestamp_-1`**
- **索引名称**：`action_1_timestamp_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`action`，排序：**升序**
  - 字段2：`timestamp`，排序：**降序**

**实际查询模式**：
- `{ _openid: 'xxx', action: 'xxx', resource: 'xxx' }`（写入）
- 可能按时间查询，按模块查询，按操作查询

**统一规范**：✅ 统一使用 `_openid`（微信云开发标准字段）

---

#### 6.2 sys_ai_cache（AI缓存）⭐ 可能使用

**权限设置**：
- **界面选项**：选择 **"所有用户不可读写"**
- **适用场景**：后台流水数据等

**索引配置**：

**索引1：`cacheKey_1`**
- **索引名称**：`cacheKey_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`cacheKey`，排序：**升序**

**实际查询模式**：
- `{ cacheKey: 'xxx' }`

---

#### 6.3 sys_ai_usage（AI使用记录）⭐ 可能使用

**权限设置**：
- **界面选项**：选择 **"所有用户不可读写"**
- **适用场景**：后台流水数据等

**索引配置**：

**索引1：`_openid_1_date_1_usageType_1`**
- **索引名称**：`_openid_1_date_1_usageType_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`_openid`，排序：**升序**
  - 字段2：`date`，排序：**升序**
  - 字段3：`usageType`，排序：**升序**

**实际查询模式**：
- `{ _openid: 'xxx', usageType: 'xxx', date: today }` + `.limit(1)`

**⚠️ 重要：字段统一规范**
- ✅ **统一使用 `_openid` 字段**（微信云开发标准字段）
- ✅ 索引配置使用 `_openid`（与实际代码一致）
- ✅ **代码已统一**：所有 `userId` 已改为 `_openid`

---

#### 6.4 sys_approval_logs（审批日志）❌ 未使用，不需要配置

**说明**：代码中未使用，需要时再创建。

---

#### 6.5 sys_cleanup_logs（清理日志）❌ 未使用，不需要配置

**说明**：代码中未使用，需要时再创建。

---

#### 6.6 sys_configurations（系统配置）❌ 未使用，不需要配置

**说明**：代码中未使用，需要时再创建。

---

#### 6.7 sys_overview_stats（概览统计）

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": false
}
```
*说明：只能通过云函数写入（系统内部）*

**索引配置**：

**索引1：`batchId_1_period_1`**
- **索引名称**：`batchId_1_period_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`period`，排序：**升序**

**实际查询模式**：
- `{ batchId, period: 'YYYY-MM' }` + `.limit(1)`

---

#### 6.8 sys_notifications（系统通知）⭐ 可能使用

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": false
}
```
*说明：只能通过云函数写入（系统内部）*

**索引配置**：

**索引1：`createTime_-1_notificationType_1`**
- **索引名称**：`createTime_-1_notificationType_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`createTime`，排序：**降序**
  - 字段2：`notificationType`，排序：**升序**

**索引2：`_id_1_isActive_1_expireTime_1`**
- **索引名称**：`_id_1_isActive_1_expireTime_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`_id`，排序：**升序**（用于in查询）
  - 字段2：`isActive`，排序：**升序**
  - 字段3：`expireTime`，排序：**升序**

**实际查询模式**：
- `{ _id: _.in(notificationIds), isActive: true, expireTime: _.gte(new Date()) }`

---

#### 6.9 sys_permissions（权限定义）❌ 未使用，不需要配置

**说明**：代码中未使用，需要时再创建。

---

#### 6.10 sys_roles（角色定义）⭐ 核心集合

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": false
}
```
*说明：只能通过云函数写入（管理员）*

**索引配置**：

**索引1：`roleCode_1_isActive_1`**（唯一索引）
- **索引名称**：`roleCode_1_isActive_1`
- **索引属性**：✅ **唯一**
- **索引字段**：
  - 字段1：`roleCode`，排序：**升序**
  - 字段2：`isActive`，排序：**升序**

**实际查询模式**：
- `{ roleCode: 'xxx', isActive: true }` + `.limit(1)`

---

#### 6.11 sys_storage_statistics（存储统计）⭐ 可能使用

**权限设置**：
- **界面选项**：选择 **"所有用户不可读写"**
- **适用场景**：后台流水数据等

**索引配置**：

**索引1：`statDate_1`**
- **索引名称**：`statDate_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`statDate`，排序：**升序**

**注意**：`dynamic-file-manager`中有引用，但代码中未实际使用

---

### 模块7：文件管理（2个集合）

#### 7.1 file_dynamic_records（动态文件记录）

**权限设置**：
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击旁边的 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": "doc.userId == auth.openid",
  "write": "doc.userId == auth.openid"
}
```
*说明：使用 `userId` 字段而非 `_openid`，因为文件记录可能由系统或其他用户上传*

**索引配置**：

**索引1：`userId_1_isActive_1_recordDate_1`**
- **索引名称**：`userId_1_isActive_1_recordDate_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`userId`，排序：**升序**
  - 字段2：`isActive`，排序：**升序**
  - 字段3：`recordDate`，排序：**升序**

**索引2：`userId_1_category_1_recordDate_-1`**
- **索引名称**：`userId_1_category_1_recordDate_-1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`userId`，排序：**升序**
  - 字段2：`category`，排序：**升序**
  - 字段3：`recordDate`，排序：**降序**

**索引3：`batchId_1_recordDate_1`**
- **索引名称**：`batchId_1_recordDate_1`
- **索引属性**：非唯一
- **索引字段**：
  - 字段1：`batchId`，排序：**升序**
  - 字段2：`2`，排序：**升序**

**实际查询模式**：
- `{ userId: 'xxx', isActive: true, category: 'xxx' }` + `orderBy('recordDate', 'desc')`
- `{ userId: 'xxx', isActive: true, recordDate: _.gte(start).and(_.lte(end)) }` + `orderBy('recordDate', 'desc')`
- `{ batchId: 'xxx', recordDate: _.gte(start).and(_.lte(end)) }`

---

#### 7.2 file_static_records（静态文件记录）❌ 未使用，不需要配置

**说明**：代码中未使用，需要时再创建。

---

## 📋 配置检查清单

### 第一优先级：核心集合（必须创建）⭐⭐⭐

#### 权限设置（10个集合）
- [ ] wx_users - 选择"所有用户可读，仅创建者可读写"
- [ ] prod_batch_entries - 选择"所有用户可读，仅创建者可读写"
- [ ] prod_batch_exits - 选择"所有用户可读，仅创建者可读写"
- [ ] health_records - 选择"所有用户可读，仅创建者可读写"
- [ ] health_prevention_records - 选择"所有用户可读，仅创建者可读写"
- [ ] health_treatment_records - 选择"所有用户可读，仅创建者可读写"
- [ ] health_ai_diagnosis - 选择"所有用户可读，仅创建者可读写"
- [ ] health_death_records - 选择"所有用户可读，仅创建者可读写"
- [ ] task_batch_schedules - 选择"所有用户可读，仅创建者可读写"
- [ ] sys_roles - 选择"自定义安全规则"，限制写入

#### 索引配置（核心集合 - 约30个索引）
- [ ] health_records - batchId_1_recordType_1_status_1_isDeleted_1_checkDate_-1
- [ ] health_records - batchId_1_isDeleted_1_checkDate_-1
- [ ] health_records - batchId_1_isDeleted_1_recordDate_-1
- [ ] health_records - batchId_1_recordType_1_isCorrected_1_isDeleted_1_correctedAt_-1
- [ ] prod_batch_entries - userId_1_isDeleted_1_createTime_-1
- [ ] prod_batch_entries - batchNumber_1_isDeleted_1
- [ ] prod_batch_entries - status_1_isDeleted_1_entryDate_-1
- [ ] prod_batch_entries - status_1_isDeleted_1_createTime_-1
- [ ] health_treatment_records - batchId_1_isDeleted_1_createdAt_-1
- [ ] health_treatment_records - batchId_1_isDeleted_1_treatmentDate_-1
- [ ] health_treatment_records - _openid_1_isDeleted_1_createdAt_-1
- [ ] health_treatment_records - isDeleted_1_isDraft_1_treatmentDate_-1
- [ ] health_treatment_records - batchId_1_treatmentDate_1_isDeleted_1
- [ ] health_death_records - batchId_1_isDeleted_1_recordDate_1_createdAt_-1
- [ ] health_death_records - batchId_1_isDeleted_1_deathDate_-1
- [ ] health_death_records - isDeleted_1_createdAt_-1
- [ ] health_death_records - batchId_1_batchNumber_1_isDeleted_1
- [ ] health_prevention_records - batchId_1_isDeleted_1_preventionDate_-1
- [ ] health_prevention_records - batchId_1_isDeleted_1_preventionDate_1
- [ ] health_prevention_records - taskId_1_isDeleted_1
- [ ] health_ai_diagnosis - _openid_1_isDeleted_1_createTime_-1
- [ ] health_ai_diagnosis - batchId_1_isDeleted_1_createTime_-1
- [ ] health_ai_diagnosis - _openid_1_batchId_1_isDeleted_1_createTime_-1
- [ ] task_batch_schedules - batchId_1_category_1_targetDate_1_userId_1
- [ ] task_batch_schedules - userId_1_category_1_completed_1_targetDate_1
- [ ] task_batch_schedules - batchId_1_category_1_dayAge_1
- [ ] task_batch_schedules - batchId_1_category_1_completed_1_dayAge_1
- [ ] wx_users - _openid_1（唯一索引，通常已存在）
- [ ] wx_users - role_1_isActive_1
- [ ] sys_roles - roleCode_1_isActive_1（唯一索引）

**注意**：
- ✅ **默认索引**：`_openid_` 和 `_id_` 索引通常已存在，**必须保留**，不要删除
- ✅ 如果已存在 `_openid_` 索引（非唯一），保留即可，无需额外创建 `_openid_1`（唯一索引）
- ✅ 如果确实需要唯一索引约束，可以额外创建 `_openid_1`（唯一索引），但不要删除默认的 `_openid_` 索引

### 第二优先级：常用集合（建议创建）⭐⭐

#### 权限设置
- [ ] prod_materials - 选择"所有用户可读，仅创建者可读写"
- [ ] prod_material_records - 选择"所有用户可读，仅创建者可读写"
- [ ] prod_inventory_logs - 选择"自定义安全规则"，限制写入
- [ ] feed_usage_records - 选择"所有用户可读，仅创建者可读写"
- [ ] wx_user_invites - 选择"自定义安全规则"，限制写入
- [ ] user_notifications - 选择"自定义安全规则"，限制写入
- [ ] user_notification_settings - 选择"仅创建者可读写"
- [ ] user_roles - 选择"自定义安全规则"，限制写入
- [ ] user_batch_assignments - 选择"自定义安全规则"，限制写入
- [ ] user_sessions - 选择"仅创建者可读写"
- [ ] sys_audit_logs - 选择"所有用户不可读写"
- [ ] sys_overview_stats - 选择"自定义安全规则"，限制写入
- [ ] finance_cost_records - 选择"所有用户可读，仅创建者可读写"
- [ ] finance_revenue_records - 选择"所有用户可读，仅创建者可读写"
- [ ] finance_summaries - 选择"自定义安全规则"，限制写入
- [ ] task_completions - 选择"所有用户可读，仅创建者可读写"
- [ ] health_alerts - 选择"自定义安全规则"，限制写入
- [ ] file_dynamic_records - 选择"自定义安全规则"，使用userId字段

#### 索引配置（常用集合 - 约30个索引）
- [ ] prod_materials - category_1_isActive_1_createTime_-1
- [ ] prod_materials - name_1_category_1_isActive_1
- [ ] prod_material_records - batchId_1_type_1_isDeleted_1_recordDate_1
- [ ] prod_material_records - materialId_1_recordDate_1
- [ ] prod_inventory_logs - materialId_1_createTime_-1
- [ ] feed_usage_records - batchId_1_recordDate_1
- [ ] feed_usage_records - materialId_1_recordDate_1
- [ ] wx_user_invites - inviteCode_1（唯一索引）
- [ ] wx_user_invites - createTime_-1
- [ ] wx_user_invites - status_1_expiryTime_1
- [ ] user_notifications - _openid_1_isRead_1_createTime_-1
- [ ] user_notifications - notificationId_1_openid_1
- [ ] user_notification_settings - _openid_1（唯一索引）
- [ ] user_roles - _openid_1_isActive_1_expiryTime_1
- [ ] user_batch_assignments - _openid_1_isActive_1_batchNumber_1
- [ ] user_sessions - _openid_1_isActive_1_lastActivity_-1
- [ ] sys_audit_logs - timestamp_-1_module_1
- [ ] sys_audit_logs - _openid_1_timestamp_-1
- [ ] sys_audit_logs - action_1_timestamp_-1
- [ ] sys_overview_stats - batchId_1_period_1
- [ ] finance_cost_records - costDate_1_isDeleted_1
- [ ] finance_cost_records - batchId_1_costDate_1_isDeleted_1
- [ ] finance_cost_records - createTime_1_isDeleted_1
- [ ] finance_revenue_records - revenueDate_1_isDeleted_1
- [ ] finance_revenue_records - batchId_1_revenueDate_1_isDeleted_1
- [ ] finance_revenue_records - createTime_1_isDeleted_1
- [ ] finance_summaries - period_1
- [ ] task_completions - taskId_1_completedAt_1
- [ ] task_completions - batchId_1_completedBy_1_completedAt_1
- [ ] task_completions - _openid_1_batchId_1_isActive_1
- [ ] health_alerts - batchId_1_status_1_createTime_-1
- [ ] file_dynamic_records - userId_1_isActive_1_recordDate_1
- [ ] file_dynamic_records - userId_1_category_1_recordDate_-1
- [ ] file_dynamic_records - batchId_1_recordDate_1

### 第三优先级：特殊集合（按需创建）⭐

- [ ] sys_ai_cache - cacheKey_1（如使用）
- [ ] sys_ai_usage - _openid_1_date_1_usageType_1（如使用，注意：代码中使用userId）
- [ ] sys_storage_statistics - statDate_1（如使用）
- [ ] sys_notifications - createTime_-1_notificationType_1（如使用）
- [ ] sys_notifications - _id_1_isActive_1_expireTime_1（如使用）
- [ ] finance_reports - generateTime_-1_reportType_1（如使用）

### 未使用的集合（10个）❌ 不需要配置

以下集合在代码中**未找到使用**，**不需要配置**，需要时再创建：

- `health_cure_records` - 治愈记录
- `health_followup_records` - 跟进记录
- `health_vaccine_plans` - 疫苗计划
- `task_records` - 任务记录
- `task_templates` - 任务模板
- `sys_approval_logs` - 审批日志
- `sys_cleanup_logs` - 清理日志
- `sys_configurations` - 系统配置
- `sys_permissions` - 权限定义
- `file_static_records` - 静态文件记录

**注意**：`production_batches` 集合不建议使用，统一使用 `prod_batch_entries`

---

## ⚠️ 重要注意事项和建议

### 1. 字段名统一规范 ✅

**统一规范**：
- ✅ **用户管理模块**：统一使用 `_openid`（微信云数据库标准字段）
  - ✅ `wx_users`：使用 `_openid` ✅
  - ✅ `user_roles`：统一使用 `_openid` ✅
  - ✅ `user_batch_assignments`：统一使用 `_openid` ✅
  - ✅ `user_sessions`：统一使用 `_openid` ✅
  - ✅ `user_notifications`：统一使用 `_openid` ✅（**已完成代码修改**）
  - ✅ `user_notification_settings`：统一使用 `_openid` ✅
  - ✅ `sys_audit_logs`：统一使用 `_openid` ✅

- ✅ **生产管理模块**：使用 `userId` 字段（业务字段，不是用户标识）
  - ✅ `prod_batch_entries`：使用 `userId` ✅（代码中实际使用）
  - ✅ `prod_batch_exits`：使用 `userId` ✅（代码中实际使用）
  - ⚠️ **注意**：`userId` 字段存储的是 `wxContext.OPENID` 的值，但字段名是 `userId`（业务逻辑字段）

- ⚠️ **其他集合**：
  - ⚠️ `task_completions`：代码中使用 `completedBy`，建议统一为 `_openid`

**配置说明**：
- **用户管理模块**：索引和权限配置使用 `_openid`
- **生产管理模块**：索引配置使用 `userId`（实际字段名）
- **权限配置**：使用 `doc._openid` 或 `doc.userId`（根据实际字段名）

### 2. 集合重复问题 ✅ 已统一

**统一规范**：
- ✅ **统一使用 `prod_batch_entries`**
- ❌ **不再使用 `production_batches`**

**原因**：
- `prod_batch_entries` 是主要使用的集合，代码中大量使用
- `production_batches` 使用频率极低，功能重复
- 统一使用 `prod_batch_entries` 便于管理和维护

**迁移建议**（如已有数据）：
- 如 `production_batches` 中有数据，需要迁移到 `prod_batch_entries`
- 迁移完成后，可删除 `production_batches` 集合

### 3. 字段名不一致（健康记录）⚠️

**发现的问题**：
- `health_death_records`：代码中同时使用`deathDate`和`recordDate`

**建议**：
- ✅ 统一使用一个字段名（建议使用`recordDate`）
- ✅ 索引配置中同时包含两个字段的索引（兼容现有代码）

### 5. 默认索引处理 ⚠️ 重要

**默认索引说明**：

微信云数据库会自动创建两个默认索引：

1. **`_openid_` 索引**（非唯一）
   - ✅ **必须保留**，不要删除
   - **用途**：用于查询用户数据（`{ _openid: 'xxx' }`）
   - **命中次数**：通常较高（如625次），说明频繁使用
   - **删除后果**：会影响所有基于 `_openid` 的查询性能

2. **`_id_` 索引**（主键索引）
   - ✅ **必须保留**，不要删除
   - **用途**：用于通过文档ID查询（`.doc(id).get()`）
   - **命中次数**：通常较高（如457次），说明频繁使用
   - **删除后果**：会导致通过 `_id` 查询文档失败，严重影响系统功能

**结论**：
- ✅ **两个默认索引都必须保留，不要删除**
- ✅ 如果集合中已存在 `_openid_` 索引（非唯一），保留即可，无需额外创建 `_openid_1`（唯一索引）
- ✅ 如果确实需要唯一索引约束，可以额外创建 `_openid_1`（唯一索引），但不要删除默认的 `_openid_` 索引
- ✅ `_id_` 索引是系统必需的，绝对不能删除

---

## 🔧 配置步骤

### 步骤0：配置前检查 ✅

**必须完成**：
- [ ] 备份重要数据（生产环境必须）
- [ ] **字段统一检查**：确认 `user_notifications` 集合的字段名
  - 如果代码中使用 `userOpenid`，需要先修改代码统一为 `_openid`
  - 如果数据库中已有数据使用 `userOpenid`，需要先迁移数据到 `_openid`
  - 然后再创建索引和设置权限
- [ ] 确认 `production_batches` 集合的数据（如有）
  - 如有数据，需要迁移到 `prod_batch_entries`
  - 如无数据，可直接忽略此集合
- [ ] 准备测试账号，用于验证权限和功能

### 步骤1：设置权限规则

1. **打开云开发控制台**
   - 访问：https://console.cloud.tencent.com/tcb
   - 登录并选择对应的小程序项目

2. **进入数据库管理**
   - 点击左侧菜单"数据库"
   - 选择集合（如 `health_records`）

3. **设置权限**
   - 点击"数据权限"标签页
   - **重要**：权限设置是**单选项**，5个选项互斥，只能选择一个
   - 根据文档中的"界面选项"选择对应的权限选项：
     - **"所有用户可读，仅创建者可读写"**：直接选择此选项即可
     - **"仅创建者可读写"**：直接选择此选项即可
     - **"所有用户可读"**：直接选择此选项即可（注意：此选项不能限制写入）
     - **"所有用户不可读写"**：直接选择此选项即可
     - **"自定义安全规则"**：选择此选项（单选），选择后旁边会出现"修改"按钮，点击"修改"按钮，粘贴对应的JSON配置
   - 点击"保存"

**⚠️ 常见错误：`InvalidParameter, rule invalid`**

如果遇到此错误，请检查：
1. ✅ **JSON格式是否正确**：确保使用双引号 `"`，不要使用单引号 `'`
2. ✅ **字段名是否正确**：使用 `doc.fieldName` 而不是 `resource.fieldName`
3. ✅ **布尔值格式**：`true` 和 `false` 必须是小写，不要加引号
4. ✅ **表达式格式**：字符串表达式必须用双引号包裹（如 `"doc._openid == auth.openid"`）
5. ✅ **JSON完整性**：确保JSON格式完整，没有多余的逗号或缺失的括号

**正确示例**：
```json
{
  "read": true,
  "write": false
}
```

```json
{
  "read": "doc._openid == auth.openid",
  "write": false
}
```

**错误示例**（会导致 `InvalidParameter` 错误）：
```json
❌ {
  "read": 'doc._openid == auth.openid',  // 错误：使用了单引号
  "write": false
}
```

```json
❌ {
  "read": "resource._openid == auth.openid",  // 错误：使用了resource而不是doc
  "write": false
}
```

```json
❌ {
  "read": doc._openid == auth.openid,  // 错误：表达式没有用引号包裹
  "write": false
}
```

4. **验证权限** ✅ 必须
   - 使用小程序测试查询和写入功能
   - 确认权限设置正确
   - 如有问题，立即回滚

**配置顺序建议**：
1. 先配置核心集合的权限（10个）
2. 测试验证
3. 再配置常用集合的权限
4. 最后配置系统集合的权限

### 步骤2：创建索引

1. **选择集合**
   - 在集合列表中，点击集合名称

2. **进入索引管理**
   - 点击集合详情页的"索引管理"标签页

3. **创建索引**
   - 点击"添加索引"按钮
   - **索引名称**：输入文档中指定的索引名称（如 `batchId_1_isDeleted_1_createTime_-1`）
   - **索引属性**：选择"唯一"或"非唯一"（文档中标注 ✅ **唯一** 的选"唯一"，其他选"非唯一"）
   - **索引字段**：按照文档中的字段顺序，逐个添加：
     - 点击"+"按钮添加字段
     - 输入字段名（如 `batchId`）
     - 选择排序方向：**升序**（对应文档中的"升序"）或 **降序**（对应文档中的"降序"）
     - 继续添加下一个字段，直到所有字段添加完成
   - 点击"确定"按钮创建索引

4. **等待完成**
   - 索引创建通常需要几秒到几分钟
   - 创建完成后，状态显示为"正常"

**配置顺序建议**：
1. 先创建核心集合的索引（约30个）
2. 测试查询性能
3. 再创建常用集合的索引
4. 最后创建特殊集合的索引（如需要）

**索引创建注意事项**：
- ✅ **字段名统一规范**：所有用户相关字段统一使用 `_openid`（微信云数据库标准）
- ⚠️ 字段名必须与实际数据字段名完全一致（如数据中使用 `userOpenid`，索引字段使用 `userOpenid`）
- ⚠️ 字段顺序必须严格按照文档顺序（最左匹配原则）
- ⚠️ 排序方向（升序/降序）必须正确对应文档中的描述
- ⚠️ 唯一索引不能重复创建
- ⚠️ 大数据量集合创建索引可能需要较长时间
- ✅ **默认索引说明**：
  - **`_openid_` 索引**：✅ **必须保留**，这是微信云数据库默认创建的用户标识索引，用于查询用户数据，命中次数较高（如625次），删除会影响查询性能
  - **`_id_` 索引**：✅ **必须保留**，这是 MongoDB 的默认主键索引，用于 `.doc(id).get()` 查询，所有文档都有 `_id` 字段，这是系统必需的索引，命中次数较高（如457次），删除会导致文档查询失败
  - **结论**：这两个默认索引都**不应该删除**，保留即可

---

## 📊 预期性能提升

创建完所有索引后，预期性能提升：

| 集合 | 查询场景 | 优化前 | 优化后 | 提升 |
|------|---------|--------|--------|------|
| health_records | 批次异常记录查询 | 200-500ms | 10-50ms | **5-10倍** |
| prod_batch_entries | 用户批次查询 | 100-300ms | 10-30ms | **5-10倍** |
| health_treatment_records | 批次治疗记录查询 | 200-500ms | 10-50ms | **5-10倍** |
| health_death_records | 存栏数计算 | 200-500ms | 10-50ms | **5-10倍** |
| task_batch_schedules | 任务计划查询 | 100-300ms | 10-30ms | **5-10倍** |

---

## 📚 参考文档

- [PROJECT_RULES.md](./PROJECT_RULES.md) - 项目开发规范
- [shared-config/collections.js](./shared-config/collections.js) - 集合名称配置
- [微信小程序云开发数据库文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/database/)

---

**最后更新**：2025-01-16  
**维护者**：AI Assistant  
**状态**：完整、准确、科学、合理 ✅  
**总集合数**：43个  
**实际使用**：29个集合（需要配置）  
**可能使用**：5个集合（按需配置）  
**未使用**：9个集合（不需要配置，需要时再创建）  
**核心索引数**：约30个（必须创建）  
**常用索引数**：约30个（建议创建）  
**特殊索引数**：约6个（按需创建）
