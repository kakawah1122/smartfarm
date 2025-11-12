---
trigger: always_on
---

## 一、微信小程序云开发规范

### 1.1 云函数规范

#### 1.1.1 基本结构

```javascript
// index.js
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV  // 使用动态环境变量
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID, APPID, UNIONID } = wxContext;
  
  try {
    // 业务逻辑
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error('云函数错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
```

#### 1.1.2 命名规范

- ✅ 使用小写字母和下划线：`user_management`、`health_records`
- ✅ 函数名应清晰表达功能：`get_user_info`、`create_health_record`
- ❌ 禁止使用驼峰命名：`userManagement`、`getUserInfo`
- ❌ 禁止使用拼音或中文命名

#### 1.1.3 超时和性能

- **超时时间**：云函数最大超时时间为 20 秒，建议设置合理超时时间（3-10秒）
- **冷启动优化**：优化代码，减少冷启动时间至 500ms 以内
- **任务拆分**：复杂任务应拆分为多个小任务，避免超时
- **异步处理**：使用 `async/await` 处理异步操作，避免阻塞

```javascript
// ✅ 正确：异步处理
exports.main = async (event) => {
  const result = await db.collection('users').get();
  return result;
};

// ❌ 错误：同步阻塞
exports.main = (event) => {
  return db.collection('users').get();  // 未使用 await
};
```

#### 1.1.4 错误处理

- ✅ 必须使用 try-catch 捕获错误
- ✅ 返回统一的错误格式
- ✅ 记录错误日志便于调试

```javascript
exports.main = async (event) => {
  try {
    // 业务逻辑
    return { success: true, data: result };
  } catch (error) {
    console.error('云函数执行失败:', error);
    return {
      success: false,
      error: error.message || '未知错误'
    };
  }
};
```

#### 1.1.5 用户身份验证

- ✅ 使用 `cloud.getWXContext()` 获取用户信息
- ✅ 验证用户权限后再执行操作
- ❌ 禁止直接信任客户端传入的用户ID

```javascript
exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const { OPENID } = wxContext;
  
  // ✅ 正确：使用服务器端获取的 OPENID
  const userDoc = await db.collection('users').where({
    _openid: OPENID
  }).get();
  
  // ❌ 错误：直接使用客户端传入的 openid
  // const userDoc = await db.collection('users').where({
  //   _openid: event.openid  // 不安全
  // }).get();
};
```

### 1.2 云数据库规范

#### 1.2.1 集合设计原则

- ✅ 集合名称使用小写字母和下划线：`wx_users`、`health_records`
- ✅ 每个集合应有明确的业务含义，避免过度嵌套
- ✅ 嵌套数组深度不超过 3 层
- ✅ 单集合记录数建议不超过 10 万条（超过应考虑分表）
- ❌ 禁止使用拼音或中文命名集合

#### 1.2.2 字段设计规范

- ✅ 字段命名使用小写字母和下划线：`user_name`、`created_at`
- ✅ 字段名称应具有描述性，避免缩写
- ✅ 时间字段统一使用 `created_at`、`updated_at`、`deleted_at`
- ✅ 使用合适的字段类型，避免不必要的类型转换

```javascript
// ✅ 正确：规范的字段设计
{
  _id: 'xxx',
  user_name: '张三',
  user_role: 'admin',
  created_at: db.serverDate(),
  updated_at: db.serverDate(),
  is_deleted: false
}

// ❌ 错误：不规范的设计
{
  _id: 'xxx',
  name: '张三',  // 不明确
  role: 'admin',
  time: '2025-01-01',  // 时间格式不一致
  del: false  // 缩写不清晰
}
```

#### 1.2.3 索引优化

- ✅ 对高频查询字段建立索引
- ✅ 复合索引遵循最左匹配原则
- ✅ 定期检查索引使用情况，删除无用索引

```javascript
// 索引创建示例（在云开发控制台创建）
// 单字段索引
db.collection('health_records').createIndex({
  fields: [{
    field: 'animal_id',
    direction: 1  // 1: 升序, -1: 降序
  }]
});

// 复合索引
db.collection('health_records').createIndex({
  fields: [
    { field: 'animal_id', direction: 1 },
    { field: 'record_date', direction: -1 }
  ]
});
```

#### 1.2.4 查询优化

- ✅ 使用 `.limit()` 限制返回数据量，避免一次性返回过多数据
- ✅ 使用 `.field()` 只查询需要的字段
- ✅ 使用 `.skip()` 分页查询，避免一次性加载所有数据
- ✅ 使用批量操作减少请求次数

```javascript
// ✅ 正确：分页查询
const result = await db.collection('health_records')
  .where({ animal_id: 'xxx' })
  .orderBy('record_date', 'desc')
  .skip(page * pageSize)
  .limit(pageSize)
  .get();

// ❌ 错误：一次性查询所有数据
const result = await db.collection('health_records')
  .where({ animal_id: 'xxx' })
  .get();  // 可能返回大量数据
```

#### 1.2.5 安全规则配置

- ✅ 严格限制客户端操作权限
- ✅ 使用云函数进行敏感操作
- ✅ 禁止客户端直接删除数据（使用软删除）

```javascript
// 数据库安全规则示例
{
  "wx_users": {
    "read": "auth.openid == doc._openid",  // 只能读取自己的数据
    "write": false  // 禁止客户端直接写入，必须通过云函数
  },
  "health_records": {
    "read": true,  // 允许读取
    "write": false  // 禁止客户端直接写入
  }
}
```

### 1.3 云存储规范

#### 1.3.1 文件命名规范

- ✅ 使用有意义的文件名：`user_avatar_20250116.jpg`
- ✅ 避免使用中文文件名
- ✅ 文件路径使用小写字母和下划线

#### 1.3.2 权限管理

- ✅ 根据文件类型设置合适的权限（仅创建者可读写、所有用户可读等）
- ✅ 敏感文件仅允许创建者访问
- ✅ 使用云函数生成临时访问链接

#### 1.3.3 CDN 加速

- ✅ 启用 CDN 加速提升文件访问速度
- ✅ 图片资源使用云存储而非 base64
- ✅ 合理使用图片压缩，减少存储空间

---

## 二、TDesign 组件规范

### 2.1 组件引入规范

#### 2.1.1 全局引入（推荐）

在 `app.json` 中全局引入常用组件：

```json
{
  "usingComponents": {
    "t-button": "tdesign-miniprogram/button/button",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-input": "tdesign-miniprogram/input/input",
    "t-dialog": "tdesign-miniprogram/dialog/dialog",
    "t-loading": "tdesign-miniprogram/loading/loading",
    "t-empty": "tdesign-miniprogram/empty/empty"
  }
}
```

#### 2.1.2 局部引入

在页面或组件的 `index.json` 中局部引入：

```json
{
  "usingComponents": {
    "t-picker": "tdesign-miniprogram/picker/picker",
    "t-picker-item": "tdesign-miniprogram/picker-item/picker-item"
  }
}
```

### 2.2 组件使用规范

#### 2.2.1 优先使用 TDesign 组件

- ✅ 优先使用 TDesign 提供的组件
- ✅ 确保 UI 一致性和可维护性
- ❌ 避免重复开发已有的组件功能

#### 2.2.2 组件定制规范

- ✅ 使用 `custom-style` 属性自定义样式（虚拟化组件节点场景）
- ✅ 使用 `style` 属性添加内联样式
- ✅ 使用外部样式类（如 `t-class-loading`）覆盖特定状态
- ✅ 通过 `addGlobalClass` 解除样式隔离（需谨慎使用）

```html
<!-- ✅ 正确：使用 custom-style -->
<t-button custom-style="color: red">填充按钮</t-button>

<!-- ✅ 正确：使用外部样式类 -->
<t-button t-class-loading="red-loading">填充按钮</t-button>
```

#### 2.2.3 版本管理

- ✅ 定期更新 TDesign 组件库至最新稳定版本
- ✅ 关注组件库更新日志和废弃 API
- ✅ 在更新前进行充分测试

### 2.3 组件命名规范

- ✅ 使用 TDesign 官方组件名：`t-button`、`t-input`
- ✅ 保持组件引入路径一致
- ❌ 禁止自定义组件别名

---

## 三、数据库集合规范

### 3.1 集合命名规范

本项目使用统一的集合配置，所有云函数必须引用 `shared-config/collections.js` 文件，**禁止硬编码集合名称**。

#### 3.1.1 命名规则

- ✅ 使用模块前缀 + 功能描述：`wx_users`、`health_records`
- ✅ 统一使用小写字母和下划线
- ✅ 集合名称应体现业务含义

#### 3.1.2 模块划分

项目包含 7 大业务模块，共 43 个标准化集合：

- **用户管理模块**：`wx_` 或 `user_` 前缀（7个集合）
- **生产管理模块**：`prod_` 前缀（6个集合）
- **健康管理模块**：`health_` 前缀（6个集合）
- **财务管理模块**：`finance_` 前缀（4个集合）
- **任务管理模块**：`task_` 前缀（2个集合）
- **系统管理模块**：`sys_` 前缀（11个集合）
- **文件管理模块**：`file_` 前缀（1个集合）

### 3.2 使用规范

#### 3.2.1 正确使用方式

```javascript
// ✅ 正确：引用配置文件
const { COLLECTIONS } = require('../../shared-config/collections.js');

const db = cloud.database();
const result = await db.collection(COLLECTIONS.WX_USERS).get();
```

#### 3.2.2 错误使用方式

```javascript
// ❌ 错误：硬编码集合名称
const result = await db.collection('wx_users').get();

// ❌ 错误：使用错误的集合名
const result = await db.collection('users').get();
```

### 3.3 集合设计原则

- ✅ 每个集合应有明确的业务含义
- ✅ 避免过度嵌套文档（嵌套深度不超过 3 层）
- ✅ 单集合记录数建议不超过 10 万条
- ✅ 对高频查询字段建立索引
- ✅ 时间字段统一使用 `created_at`、`updated_at`、`deleted_at`

### 3.4 权限设置规范 ⭐ 重要

#### 3.4.1 权限选项说明

微信云数据库提供 5 个权限选项，**这些选项是互斥的单选项**，每个集合只能选择一个：

1. **所有用户可读，仅创建者可读写**
2. **仅创建者可读写**
3. **所有用户可读**
4. **所有用户不可读写**
5. **自定义安全规则**

#### 3.4.2 权限设置规则

**规则1：所有用户可读，仅创建者可读写**
- **界面选项**：直接选择 **"所有用户可读，仅创建者可读写"**
- **适用场景**：用户评论、用户公开信息、健康记录、生产记录等
- **示例集合**：`wx_users`、`health_records`、`prod_batch_entries`、`finance_cost_records`

**规则2：仅创建者可读写**
- **界面选项**：直接选择 **"仅创建者可读写"**
- **适用场景**：用户个人设置、用户会话等
- **示例集合**：`user_notification_settings`、`user_sessions`

**规则3：所有用户可读（但限制写入）**
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": true,
  "write": false
}
```
- **适用场景**：商品信息、统计报表等（只能通过云函数写入）
- **示例集合**：`finance_reports`、`sys_overview_stats`、`sys_notifications`

**规则4：仅创建者可读（但限制写入）**
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": "doc._openid == auth.openid",
  "write": false
}
```
- **适用场景**：用户通知等（只能通过云函数写入）
- **示例集合**：`user_notifications`

**规则5：使用userId字段（仅创建者可读写）**
- **界面选项**：选择 **"自定义安全规则"**（单选）
- **设置规则**：选择后，点击 **"修改"** 按钮，粘贴以下JSON：
```json
{
  "read": "doc.userId == auth.openid",
  "write": "doc.userId == auth.openid"
}
```
- **适用场景**：生产管理模块（使用 `userId` 业务字段）
- **示例集合**：`prod_batch_entries`、`prod_batch_exits`、`prod_material_records`、`feed_usage_records`

**规则6：所有用户不可读写**
- **界面选项**：直接选择 **"所有用户不可读写"**
- **适用场景**：后台流水数据、审计日志等
- **示例集合**：`sys_audit_logs`、`sys_ai_cache`、`sys_ai_usage`

#### 3.4.3 权限设置注意事项

**⚠️ 重要提示**：
- ✅ **JSON格式**：必须使用双引号 `"`，不要使用单引号 `'`
- ✅ **字段引用**：使用 `doc.fieldName` 而不是 `resource.fieldName`
- ✅ **布尔值**：`true` 和 `false` 必须是小写，不要加引号
- ✅ **表达式**：字符串表达式必须用双引号包裹（如 `"doc._openid == auth.openid"`）
- ✅ **JSON完整性**：确保JSON格式完整，没有多余的逗号或缺失的括号

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

### 3.5 索引配置规范 ⭐ 重要

#### 3.5.1 索引命名规范

- ✅ **索引名称格式**：`字段1_排序1_字段2_排序2_字段3_排序3`
  - 升序用 `1` 表示，降序用 `-1` 表示
  - 示例：`batchId_1_isDeleted_1_createTime_-1`（`batchId` 升序，`isDeleted` 升序，`createTime` 降序）
- ✅ **索引名称应唯一**：同一个集合内索引名称不能重复
- ✅ **索引名称应具有描述性**：能清晰表达索引字段和排序方向

#### 3.5.2 索引创建原则

- ✅ **基于实际查询模式**：只为实际使用的查询条件创建索引
- ✅ **遵循最左匹配原则**：复合索引字段顺序必须与查询条件顺序一致
- ✅ **优先创建高频查询索引**：优先为高频查询场景创建索引
- ✅ **避免创建冗余索引**：不要创建不必要的索引
- ✅ **索引属性选择**：
  - **唯一索引**：用于确保字段值唯一（如 `_openid_1`）
  - **非唯一索引**：用于提升查询性能（大多数场景）

#### 3.5.3 索引创建步骤

1. **进入索引管理**
   - 在云开发控制台，选择集合 → 点击"索引管理"标签页

2. **创建索引**
   - 点击"添加索引"按钮
   - **索引名称**：输入规范的索引名称（如 `batchId_1_isDeleted_1_createTime_-1`）
   - **索引属性**：选择"唯一"或"非唯一"
   - **索引字段**：按照文档顺序逐个添加：
     - 点击"+"按钮添加字段
     - 输入字段名（必须与实际数据字段名完全一致）
     - 选择排序方向：**升序**（对应 `1`）或 **降序**（对应 `-1`）
     - 继续添加下一个字段，直到所有字段添加完成
   - 点击"确定"按钮创建索引

3. **索引创建注意事项**
   - ⚠️ **字段名必须一致**：索引字段名必须与实际数据字段名完全一致
   - ⚠️ **字段顺序必须正确**：严格按照文档顺序（最左匹配原则）
   - ⚠️ **排序方向必须正确**：升序/降序必须对应文档描述
   - ⚠️ **唯一索引不能重复**：唯一索引不能重复创建
   - ⚠️ **大数据量需要时间**：大数据量集合创建索引可能需要较长时间

#### 3.5.4 默认索引处理 ⚠️ 重要

微信云数据库会自动创建两个默认索引，**这两个索引必须保留，不要删除**：

**1. `_openid_` 索引**（非唯一）
- ✅ **必须保留**，不要删除
- **用途**：用于查询用户数据（`{ _openid: 'xxx' }`）
- **命中次数**：通常较高（如625次），说明频繁使用
- **删除后果**：会影响所有基于 `_openid` 的查询性能

**2. `_id_` 索引**（主键索引）
- ✅ **必须保留**，不要删除
- **用途**：用于通过文档ID查询（`.doc(id).get()`）
- **命中次数**：通常较高（如457次），说明频繁使用
- **删除后果**：会导致通过 `_id` 查询文档失败，严重影响系统功能

**结论**：
- ✅ **两个默认索引都必须保留，不要删除**
- ✅ 如果集合中已存在 `_openid_` 索引（非唯一），保留即可
- ✅ 如果确实需要唯一索引约束，可以额外创建 `_openid_1`（唯一索引），但不要删除默认的 `_openid_` 索引
- ✅ `_id_` 索引是系统必需的，绝对不能删除

### 3.6 字段命名统一规范 ⭐ 重要

#### 3.6.1 用户标识字段规范

**用户管理模块**：统一使用 `_openid`（微信云数据库标准字段）
- ✅ `wx_users`：使用 `_openid`
- ✅ `user_roles`：统一使用 `_openid`
- ✅ `user_batch_assignments`：统一使用 `_openid`
- ✅ `user_sessions`：统一使用 `_openid`
- ✅ `user_notifications`：统一使用 `_openid`
- ✅ `user_notification_settings`：统一使用 `_openid`
- ✅ `sys_audit_logs`：统一使用 `_openid`
- ✅ `sys_ai_usage`：统一使用 `_openid`

**生产管理模块**：使用 `userId` 字段（业务字段，不是用户标识）
- ✅ `prod_batch_entries`：使用 `userId`（代码中实际使用）
- ✅ `prod_batch_exits`：使用 `userId`（代码中实际使用）
- ✅ `prod_material_records`：使用 `userId`
- ✅ `feed_usage_records`：使用 `userId`
- ⚠️ **注意**：`userId` 字段存储的是 `wxContext.OPENID` 的值，但字段名是 `userId`（业务逻辑字段）

**其他模块**：
- ⚠️ `task_completions`：代码中使用 `completedBy`，建议统一为 `_openid`

#### 3.6.2 时间字段规范

- ✅ **死亡记录**：统一使用 `deathDate`（`health_death_records`）
- ✅ **饲料投喂记录**：使用 `recordDate`（`feed_usage_records`，与死亡记录不同）
- ✅ **创建时间**：统一使用 `createTime` 或 `createdAt`
- ✅ **更新时间**：统一使用 `updateTime` 或 `updatedAt`
- ✅ **删除时间**：统一使用 `deleteTime` 或 `deletedAt`

#### 3.6.3 字段命名原则

- ✅ **统一性**：同一业务模块内字段命名应保持一致
- ✅ **规范性**：遵循微信云数据库标准字段命名（如 `_openid`）
- ✅ **描述性**：字段名应清晰表达业务含义
- ✅ **代码同步**：修改字段名时，必须同步更新代码和数据库配置

### 3.7 配置流程规范

#### 3.7.1 新建集合配置流程

1. **确定集合归属模块**
   - 根据业务功能确定集合所属模块（用户管理、生产管理、健康管理等）

2. **设置权限规则**
   - 根据业务需求选择合适的权限选项
   - 如需自定义规则，选择"自定义安全规则"并设置JSON

3. **创建索引**
   - 分析实际查询模式
   - 根据查询条件创建合适的索引
   - 遵循最左匹配原则

4. **更新配置文件**
   - 在 `shared-config/collections.js` 中添加集合常量
   - 更新 `DATABASE_CONFIG.md` 文档

5. **代码实现**
   - 使用 `COLLECTIONS` 常量引用集合名
   - 遵循字段命名统一规范

#### 3.7.2 修改集合配置流程

1. **备份数据**（生产环境必须）
   - 备份重要数据
   - 准备回滚方案

2. **字段统一检查**
   - 确认字段名是否符合统一规范
   - 如需修改字段名，先修改代码，再迁移数据，最后更新索引

3. **更新权限**
   - 如需修改权限，在云开发控制台更新
   - 验证权限设置正确

4. **更新索引**
   - 如需修改索引，先删除旧索引，再创建新索引
   - 注意索引字段名和顺序

5. **测试验证**
   - 使用测试账号验证功能
   - 确认查询性能正常

### 3.8 配置参考文档

详细的集合权限和索引配置请参考：
- **[DATABASE_CONFIG.md](./DATABASE_CONFIG.md)** - 完整的数据库配置指南（包含所有29个实际使用集合的详细配置）

**配置原则总结**：
- ✅ 基于实际代码中的查询模式
- ✅ 遵循最左匹配原则
- ✅ 统一使用 `_openid`（用户管理模块）
- ✅ 统一使用 `userId`（生产管理模块）
- ✅ 保留默认索引（`_openid_` 和 `_id_`）
- ✅ 未使用的集合不需要配置，需要时再创建

---

## 四、页面规范

### 4.1 页面结构规范

#### 4.1.1 文件组织

```
page-name/
├── page-name.ts          # 页面逻辑
├── page-name.wxml        # 页面结构
├── page-name.scss        # 页面样式
└── page-name.json        # 页面配置
```

#### 4.1.2 页面代码结构

```typescript
// page-name.ts
Page({
  data: {
    // 页面数据
  },
  
  onLoad(options) {
    // 页面加载时执行
  },
  
  onShow() {
    // 页面显示时执行
  },
  
  onReady() {
    // 页面初次渲染完成时执行
  },
  
  onUnload() {
    // 页面卸载时执行
  },
  
  // 自定义方法
  handleSubmit() {
    // 业务逻辑
  }
});
```

### 4.2 页面性能优化

#### 4.2.1 数据优化

- ✅ 精简首屏数据，避免一次性加载过多数据
- ✅ 使用分页加载长列表
- ✅ 提前请求首屏数据
- ✅ 合理使用缓存，减少重复请求

#### 4.2.2 渲染优化

- ✅ 避免引用未使用的自定义组件
- ✅ 使用 `wx:if` 而非 `hidden` 控制显示（`wx:if` 不渲染 DOM）
- ✅ 使用虚拟列表处理长列表（`recycle-view`）
- ✅ 减少不必要的 `setData` 调用

```javascript
// ✅ 正确：使用 wx:if
<view wx:if="{{showContent}}">内容</view>

// ❌ 错误：使用 hidden（仍会渲染）
<view hidden="{{!showContent}}">内容</view>
```

#### 4.2.3 事件优化

- ✅ 避免在 `onPageScroll` 中执行复杂逻辑
- ✅ 使用 `WXS` 响应事件（如滚动动画）
- ✅ 避免频繁调用 `setData`

```javascript
// ❌ 错误：空函数也要删除
Page({
  onPageScroll() {}  // 不要保留空函数
});

// ✅ 正确：不需要时不定义
Page({
  // 直接不定义 onPageScroll
});
```

### 4.3 页面样式规范

- ✅ 遵循 `UI_DESIGN_GUIDELINES.md` 中的设计规范
- ✅ 使用统一的颜色、字体、间距规范
- ✅ 禁止使用粗边框（border-width > 2rpx）作为装饰
- ✅ 使用 TDesign 提供的样式变量

---

## 五、云函数规范

### 5.1 目录结构规范

```
cloudfunctions/
├── function-name/
│   ├── index.js          # 入口文件
│   ├── package.json      # 依赖配置
│   └── package-lock.json # 锁定版本
```

### 5.2 代码规范

#### 5.2.1 基本结构

```javascript
const cloud = require('wx-server-sdk');
const { COLLECTIONS } = require('../../shared-config/collections.js');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID, APPID } = wxContext;
  
  try {
    // 1. 参数验证
    const { param1, param2 } = event;
    if (!param1) {
      return { success: false, error: '参数缺失' };
    }
    
    // 2. 业务逻辑
    const result = await db.collection(COLLECTIONS.WX_USERS).get();
    
    // 3. 返回结果
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('云函数执行失败:', error);
    return {
      success: false,
      error: error.message || '未知错误'
    };
  }
};
```

#### 5.2.2 命名规范

- ✅ 使用小写字母和下划线：`user_management`、`health_records`
- ✅ 函数名应清晰表达功能
- ❌ 禁止使用驼峰命名、拼音或中文

#### 5.2.3 依赖管理

- ✅ 在 `package.json` 中明确声明依赖版本
- ✅ 定期更新依赖包至安全版本
- ✅ 避免引入不必要的依赖

```json
{
  "name": "function-name",
  "version": "1.0.0",
  "dependencies": {
    "wx-server-sdk": "^2.6.0"
  }
}
```

### 5.3 定时触发器规范

- ✅ 使用定时触发器执行定时任务
- ✅ Cron 表达式格式：`秒 分 时 日 月 周`
- ✅ 合理设置执行频率，避免过度消耗资源

```javascript
// cloudbaserc.json 配置示例
{
  "functions": [
    {
      "name": "scheduled_task",
      "config": {
        "trigger": {
          "type": "timer",
          "config": "0 0 2 * * *"  // 每天凌晨2点执行
        }
      }
    }
  ]
}
```

---

## 六、分包和包大小限制

### 6.1 包大小限制

- **主包大小**：≤ 2MB（必须）
- **单个分包大小**：≤ 2MB（必须）
- **总包大小**：≤ 16MB（必须）
- **单个分包/主包内，单个文件**：≤ 2MB（必须）

### 6.2 分包策略

#### 6.2.1 主包内容

主包应包含：
- ✅ 小程序启动页
- ✅ TabBar 页面
- ✅ 公共组件和工具类
- ✅ 必需的基础库

#### 6.2.2 分包设计

- ✅ 按业务模块划分分包：`packageProduction`、`packageHealth`、`packageUser` 等
- ✅ 分包命名使用小写字母：`package-production`、`package-health`
- ✅ 非核心功能放入分包，按需加载
- ✅ 使用 `preloadRule` 预加载常用分包

```json
{
  "subpackages": [
    {
      "root": "packageProduction",
      "name": "production",
      "pages": [
        "entry-form/entry-form",
        "exit-form/exit-form"
      ]
    }
  ],
  "preloadRule": {
    "pages/index/index": {
      "network": "all",
      "packages": ["production", "health"]
    }
  }
}
```

### 6.3 包大小优化

#### 6.3.1 代码优化

- ✅ 删除未使用的代码和文件
- ✅ 使用代码压缩和混淆
- ✅ 开启按需加载（`lazyCodeLoading: "requiredComponents"`）

#### 6.3.2 资源优化

- ✅ 压缩图片资源（使用 WebP 格式）
- ✅ 将大图片放到云存储或 CDN
- ✅ 删除未使用的静态资源

#### 6.3.3 依赖优化

- ✅ 避免引入大型第三方库
- ✅ 使用按需引入，避免全量引入
- ✅ 定期检查 `node_modules` 大小

### 6.4 Worker 分包配置

从基础库 v2.27.3 开始，支持将 Worker 代码配置为分包：

```json
{
  "workers": {
    "path": "workers",
    "isSubpackage": true  // true 表示把 worker 打包为分包
  }
}
```

---

## 七、性能优化指南

### 7.1 启动性能优化

#### 7.1.1 代码包准备阶段

- ✅ 使用分包加载，减少主包体积
- ✅ 避免使用非必要的全局自定义组件和插件
- ✅ 压缩资源文件或将资源文件放到 CDN
- ✅ 删除没有使用的文件或模块

#### 7.1.2 代码注入阶段

- ✅ 开启按需加载（`lazyCodeLoading: "requiredComponents"`）
- ✅ 减少生命周期中的同步 API 调用
- ✅ 避免进行复杂的运算逻辑

#### 7.1.3 首页渲染阶段

- ✅ 使用初始渲染缓存（`initialRenderingCache`）
- ✅ 避免引用未使用的自定义组件
- ✅ 精简首屏数据
- ✅ 提前首屏数据的请求
- ✅ 缓存请求数据
- ✅ 使用骨架屏

### 7.2 运行时性能优化

#### 7.2.1 setData 优化

- ✅ 减少 `setData` 调用次数
- ✅ 减少单次 `setData` 的数据量
- ✅ 避免在 `setData` 中设置过大对象

```javascript
// ❌ 错误：频繁调用 setData
this.setData({ count: 1 });
this.setData({ name: 'test' });
this.setData({ age: 18 });

// ✅ 正确：合并调用
this.setData({
  count: 1,
  name: 'test',
  age: 18
});
```

#### 7.2.2 事件处理优化

- ✅ 避免在事件处理函数中执行复杂逻辑
- ✅ 使用防抖和节流处理高频事件
- ✅ 避免在 `onPageScroll` 中执行复杂操作

```javascript
// ✅ 正确：使用防抖
let timer = null;
onPageScroll() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    // 复杂逻辑
  }, 100);
}
```

#### 7.2.3 图片优化

- ✅ 使用合适的图片格式（WebP、PNG、JPG）
- ✅ 压缩图片大小
- ✅ 使用懒加载（`lazy-load`）
- ✅ 使用云存储而非 base64

```html
<!-- ✅ 正确：使用懒加载 -->
<image src="{{imageUrl}}" lazy-load></image>

<!-- ❌ 错误：base64 过大 -->
<image src="data:image/png;base64,iVBORw0KG..."></image>
```

### 7.3 网络请求优化

- ✅ 合并请求，减少网络开销
- ✅ 使用请求缓存，避免重复请求
- ✅ 使用合理的超时时间
- ✅ 处理网络错误和重试机制

```javascript
// ✅ 正确：合并请求
const [userInfo, healthRecords] = await Promise.all([
  wx.cloud.callFunction({ name: 'getUserInfo' }),
  wx.cloud.callFunction({ name: 'getHealthRecords' })
]);
```

### 7.4 内存优化

- ✅ 及时清理不需要的数据和事件监听
- ✅ 避免内存泄漏（及时 `clearTimeout`、`clearInterval`）
- ✅ 使用对象池复用对象

---

## 八、代码规范

### 8.1 TypeScript 规范

#### 8.1.1 类型定义

- ✅ 使用 TypeScript 定义类型
- ✅ 避免使用 `any` 类型
- ✅ 为函数参数和返回值定义类型

```typescript
// ✅ 正确：定义类型
interface UserInfo {
  name: string;
  age: number;
}

function getUserInfo(id: string): Promise<UserInfo> {
  // ...
}
```

#### 8.1.2 命名规范

- ✅ 变量和函数使用驼峰命名：`userName`、`getUserInfo`
- ✅ 常量使用大写下划线：`MAX_COUNT`、`API_BASE_URL`
- ✅ 类型和接口使用大驼峰：`UserInfo`、`ApiResponse`

### 8.2 代码风格

#### 8.2.1 缩进和换行

- ✅ 使用 2 个空格缩进
- ✅ 每行代码不超过 100 个字符
- ✅ 适当使用空行分隔代码块

#### 8.2.2 注释规范

- ✅ 复杂逻辑必须添加注释
- ✅ 函数应添加 JSDoc 注释
- ✅ 避免无意义的注释

```javascript
/**
 * 获取用户信息
 * @param {string} userId - 用户ID
 * @returns {Promise<UserInfo>} 用户信息
 */
async function getUserInfo(userId) {
  // ...
}
```

### 8.3 错误处理

- ✅ 所有异步操作必须处理错误
- ✅ 使用 try-catch 捕获异常
- ✅ 向用户展示友好的错误提示

```javascript
// ✅ 正确：错误处理
try {
  const result = await wx.cloud.callFunction({
    name: 'functionName'
  });
} catch (error) {
  console.error('调用失败:', error);
  wx.showToast({
    title: '操作失败，请稍后重试',
    icon: 'none'
  });
}
```

---

## 九、安全规范

### 9.1 数据安全

- ✅ 敏感数据必须通过云函数处理
- ✅ 禁止客户端直接操作敏感数据
- ✅ 使用数据库安全规则限制客户端权限
- ✅ 验证用户身份和权限

### 9.2 接口安全

- ✅ 验证请求参数的有效性
- ✅ 防止 SQL 注入和 XSS 攻击
- ✅ 使用 HTTPS 传输数据
- ✅ 限制接口调用频率

### 9.3 存储安全

- ✅ 敏感信息不得存储在本地缓存
- ✅ 使用加密存储敏感数据（如需要）
- ✅ 定期清理过期缓存

### 9.4 用户隐私

- ✅ 遵循微信小程序隐私政策
- ✅ 获取用户授权后再使用敏感 API
- ✅ 明确告知用户数据使用目的

---

## 十、项目规范执行

### 10.1 代码审查

- ✅ 所有代码提交前必须进行代码审查
- ✅ 检查是否符合项目规范
- ✅ 检查性能和安全性

### 10.2 持续更新

- ✅ 定期查阅官方文档更新规范
- ✅ 关注微信小程序和 TDesign 的最新更新
- ✅ 及时更新项目规范文档

### 10.3 工具支持

- ✅ 使用 ESLint 进行代码检查
- ✅ 使用 Prettier 进行代码格式化
- ✅ 定期运行性能分析工具

---

## 📚 参考资源

### 官方文档

- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [微信小程序云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [TDesign 小程序组件库](https://github.com/tencent/tdesign-miniprogram)
- [微信小程序性能优化指南](https://developers.weixin.qq.com/miniprogram/dev/framework/performance/)

### 项目文档

- [UI 设计规范](./UI_DESIGN_GUIDELINES.md)
- [数据库索引指南](./DATABASE_INDEX_GUIDE.md)
- [部署指南](./DEPLOYMENT_GUIDE.md)

---

## 📝 更新日志

### v1.1.0 (2025-01-16)

- ✅ **新增数据库权限设置规范**（3.4节）
  - 详细说明5个权限选项的使用场景和配置方法
  - 提供自定义安全规则的JSON模板和正确格式
  - 添加常见错误示例和注意事项
- ✅ **新增索引配置规范**（3.5节）
  - 索引命名规范（字段1_排序1_字段2_排序2格式）
  - 索引创建原则和步骤
  - 默认索引处理说明（`_openid_` 和 `_id_` 必须保留）
- ✅ **新增字段命名统一规范**（3.6节）
  - 用户标识字段规范（用户管理模块使用 `_openid`，生产管理模块使用 `userId`）
  - 时间字段规范（`deathDate`、`recordDate`、`createTime` 等）
  - 字段命名原则
- ✅ **新增配置流程规范**（3.7节）
  - 新建集合配置流程（5步）
  - 修改集合配置流程（5步）
- ✅ **更新模块划分**：从40个集合更新为43个集合
- ✅ **添加配置参考文档链接**：指向 DATABASE_CONFIG.md

### v1.0.0 (2025-01-16)

- ✅ 初始版本发布
- ✅ 整合微信小程序云开发规范
- ✅ 整合 TDesign 组件规范
- ✅ 整合数据库集合规范
- ✅ 整合页面和云函数规范
- ✅ 整合分包和包大小限制
- ✅ 整合性能优化指南
- ✅ 整合代码和安全规范

---

## 💡 建议与反馈

如有规范相关的建议或问题，请联系：
- 项目维护者：KAKA
- 更新此文档并提交 PR

---

**记住：所有开发工作必须严格遵循项目规范，确保代码质量和系统稳定性！**