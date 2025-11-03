# 健康管理今日任务加载失败 - 排查指南

## 问题现象
- 页面显示："数据加载失败，请下拉刷新"
- 显示："暂无进行中的任务"
- 控制台显示：`[loadPreventionData] 云函数返回失败`

## 已完成的修复

### 1. 数据库管理器修复
✅ 添加了 `buildNotDeletedCondition` 方法到 `database-manager.js`

### 2. 聚合查询修复
✅ 将复杂的聚合查询改为普通查询 + 手动计算统计

### 3. 前端重试机制
✅ 将递归重试改为循环重试，避免作用域问题

## 排查步骤

### 步骤1：确认云函数已重新部署 ⚠️ 重要

**检查方法：**
在微信开发者工具中：
1. 点击左侧 **云开发** 图标
2. 进入 **云函数** 标签
3. 找到 `health-management` 云函数
4. 查看 **上次部署时间**

**如果未部署或时间较早：**
1. 右键点击 `health-management` 文件夹
2. 选择 **上传并部署：云端安装依赖**
3. 等待部署完成（通常需要1-2分钟）

### 步骤2：查看云函数日志

1. 在微信开发者工具中打开 **云开发控制台**
2. 进入 **云函数** → **日志**
3. 选择 `health-management` 云函数
4. 查看最新的调用日志

**重点关注的日志：**
- `[权限验证]` - 检查是否权限错误
- `[预防管理]` - 检查数据查询过程
- `Error` - 查看具体错误信息

### 步骤3：检查权限配置

**可能的权限问题：**
1. 用户角色未配置
2. `sys_roles` 集合中缺少角色权限
3. `health` 模块权限未授予

**检查方法：**
```javascript
// 在云开发控制台 → 数据库
// 1. 查看 wx_users 集合，找到你的用户记录
// 确认 role 字段值（如 "admin", "super_admin" 等）

// 2. 查看 sys_roles 集合
// 确认对应角色有 health 模块的 view 权限
{
  "roleCode": "admin",
  "permissions": [
    {
      "module": "health",
      "actions": ["view", "create", "update"]
    }
  ]
}
```

### 步骤4：测试云函数

在云开发控制台测试云函数：
```json
{
  "action": "getPreventionDashboard",
  "batchId": "all"
}
```

查看返回结果是否包含错误信息。

### 步骤5：检查数据库集合

确认以下集合存在且有数据权限：
- `task_batch_schedules` - 任务计划
- `health_prevention_records` - 预防记录
- `prod_batch_entries` - 批次入栏

### 步骤6：前端调试

在小程序控制台查看详细错误：
```javascript
// 查看 [loadPreventionData] 相关日志
// 特别关注：
// - 云函数返回的 errorCode
// - 云函数返回的 message
// - 云函数返回的 error 详情
```

## 常见错误及解决方案

### 错误1：权限不足
```
errorCode: "PERMISSION_DENIED"
message: "您没有查看预防管理数据的权限"
```

**解决方案：**
1. 在 `sys_roles` 集合中为你的角色添加 health 模块权限
2. 或者修改云函数中的权限检查逻辑（临时测试用）

### 错误2：云函数未部署
```
error: "_.cond is not a function"
或
error: "dbManager.buildNotDeletedCondition is not a function"
```

**解决方案：**
重新部署云函数（见步骤1）

### 错误3：数据库查询失败
```
error: "collection not found"
```

**解决方案：**
检查 `shared-config/collections.js` 中的集合名称是否正确

### 错误4：批次ID问题
```
error: "batch not found"
```

**解决方案：**
确保传入的 `batchId` 为 "all" 或有效的批次ID

## 临时测试方案

如果需要快速测试，可以临时跳过权限检查：

**修改云函数（仅供测试）：**
```javascript
// cloudfunctions/health-management/index.js
// 找到 getPreventionDashboard 函数
async function getPreventionDashboard(event, wxContext) {
  // ...
  
  // ⚠️ 临时注释权限检查（仅供测试，生产环境必须启用）
  /*
  const hasPermission = await checkPermission(openid, 'health', 'view', batchId)
  if (!hasPermission) {
    return { success: false, errorCode: 'PERMISSION_DENIED' }
  }
  */
  
  // ... 继续执行
}
```

## 验证修复

修复后应该看到：
1. ✅ 控制台显示：`[loadPreventionData] 云函数返回: true`
2. ✅ 页面显示今日任务列表
3. ✅ 无错误提示

## 需要提供的信息

如果问题仍未解决，请提供：
1. 云函数日志截图（最新的调用记录）
2. 前端控制台的完整错误信息
3. 你的用户角色（role 字段值）
4. 云函数最后部署时间

---

**当前状态：等待云函数重新部署**

请按步骤1先重新部署云函数，然后测试。如果还有问题，提供云函数日志。

