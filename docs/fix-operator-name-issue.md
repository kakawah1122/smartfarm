# 修复操作人员显示"未知"问题

## 问题描述

死亡记录创建成功，但操作人员显示为"未知"。

## 原因分析

可能的原因：
1. `wx_users` 集合中没有当前用户的记录
2. 用户记录中缺少 `name` 字段
3. `_openid` 字段不匹配

## 修复步骤

### 步骤 1: 检查用户记录

1. **打开云开发控制台**
   - 进入数据库
   - 找到 `wx_users` 集合

2. **查看当前用户记录**
   - 查找你自己的用户记录
   - 检查字段：
     ```json
     {
       "_id": "xxx",
       "_openid": "oXXXX...",  // ✅ 必须有
       "name": "你的名字",      // ✅ 必须有
       "nickName": "昵称",      // 可选
       "role": "super_admin",
       "status": "approved"
     }
     ```

3. **检查用户 OpenID**
   - 在云函数日志中查看：`[疫苗死亡] 用户查询结果`
   - 记下日志中的 `openid` (如: `oXXXX...`)
   - 在数据库中查找是否有匹配的 `_openid`

### 步骤 2: 添加或更新用户记录

#### 情况 A: 用户记录不存在

1. 在 `wx_users` 集合中添加新记录：
   ```json
   {
     "_openid": "你的openid",  // 从日志中获取
     "name": "你的名字",
     "role": "super_admin",
     "status": "approved",
     "createdAt": { "$date": "2025-11-04T00:00:00.000Z" }
   }
   ```

#### 情况 B: 用户记录存在但缺少 name 字段

1. 找到你的用户记录
2. 点击编辑
3. 添加 `name` 字段：
   ```json
   "name": "你的名字"
   ```

### 步骤 3: 验证修复

1. **重新上传云函数**
   ```bash
   右键 health-management → 上传并部署：云端安装依赖
   ```

2. **创建新的死亡记录**
   - 进入疫苗记录
   - 点击"记录死亡"
   - 输入数量
   - 确认创建

3. **查看云函数日志**
   - 应该看到：
     ```
     [疫苗死亡] 用户查询结果: {
       openid: "oXXXX...",
       found: true,
       userName: "你的名字"
     }
     ```

4. **查看死亡记录**
   - 进入死亡记录列表
   - 操作人员应显示为"你的名字"

## 调试步骤

### 1. 查看云函数日志

在云开发控制台 → 云函数 → `health-management` → 日志中查找：

**成功的情况**:
```
[疫苗死亡] 用户查询结果: {
  openid: "oXXXX...",
  found: true,
  userName: "张三"
}
```

**失败的情况**:
```
[疫苗死亡] 用户查询结果: {
  openid: "oXXXX...",
  found: false,
  userName: undefined
}

[疫苗死亡] 未找到用户信息, openid: oXXXX...
```

### 2. 手动查询验证

在云开发控制台 → 数据库 → `wx_users`，执行查询：

```javascript
{
  "_openid": "oXXXX..."  // 从日志中获取的 openid
}
```

检查是否有结果。

### 3. 检查字段名称

可能的字段名称：
- `name` ✅ (推荐)
- `nickName`
- `userName`
- `realName`

代码已支持：
```javascript
operatorName = userInfo.data[0].name || userInfo.data[0].nickName || '未知'
```

## 批量修复旧记录

如果之前创建的记录操作人员都是"未知"，可以运行修复脚本：

### 创建临时云函数

1. 云开发 → 云函数 → 新建 → `fix-operator-names`

2. 粘贴以下代码：

```javascript
const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event, context) => {
  // 获取所有操作人员为"未知"的死亡记录
  const deathRecords = await db.collection('health_death_records')
    .where({
      operatorName: '未知',
      isDeleted: false
    })
    .limit(100)
    .get()
  
  console.log('找到记录数:', deathRecords.data.length)
  
  let updatedCount = 0
  
  for (const record of deathRecords.data) {
    const openid = record._openid || record.operator
    
    if (!openid) {
      console.log('跳过：没有 openid 的记录', record._id)
      continue
    }
    
    // 查询用户信息
    const userInfo = await db.collection('wx_users')
      .where({ _openid: openid })
      .limit(1)
      .get()
    
    if (userInfo.data.length > 0) {
      const userName = userInfo.data[0].name || userInfo.data[0].nickName
      
      if (userName) {
        await db.collection('health_death_records')
          .doc(record._id)
          .update({
            data: {
              operatorName: userName
            }
          })
        
        console.log(`已更新: ${record._id} -> ${userName}`)
        updatedCount++
      }
    } else {
      console.log('未找到用户:', openid.substring(0, 8) + '...')
    }
  }
  
  return {
    success: true,
    message: `成功更新 ${updatedCount} 条记录`
  }
}
```

3. 上传并部署

4. 在云函数管理页面点击"测试"

5. 查看执行结果

6. 完成后删除此云函数

## 预防措施

### 1. 确保新用户注册时创建记录

在 `register` 或 `user-management` 云函数中，确保创建用户时包含 `name` 字段。

### 2. 用户审批时要求填写姓名

在用户审批流程中，管理员应要求用户填写真实姓名。

### 3. 添加数据验证

在创建重要记录前，验证操作人员信息是否完整：

```javascript
if (!operatorName || operatorName === '未知') {
  console.warn('警告: 无法获取操作人员姓名')
  // 可以选择阻止操作或使用默认值
}
```

## 常见问题

### Q1: 为什么查询不到用户信息？

**A1**: 检查以下几点：
1. 用户是否已注册并审批通过
2. `wx_users` 集合中是否有该用户
3. `_openid` 是否匹配（不是 `openid`，是 `_openid`）

### Q2: 用户记录存在但还是显示"未知"？

**A2**: 检查：
1. `name` 字段是否为空字符串
2. 字段名是否正确（不是 `userName`，是 `name`）
3. 云函数是否已重新部署

### Q3: 如何获取当前用户的 openid？

**A3**: 在小程序端：
```javascript
wx.cloud.callFunction({
  name: 'login',
  data: {}
}).then(res => {
  console.log('当前用户 openid:', res.result.openid)
})
```

## 验证清单

- [ ] `wx_users` 集合中有我的用户记录
- [ ] 用户记录包含 `_openid` 字段
- [ ] 用户记录包含 `name` 字段且不为空
- [ ] 云函数已重新部署
- [ ] 创建新记录后查看云函数日志
- [ ] 日志显示 `found: true` 和正确的 `userName`
- [ ] 死亡记录列表显示正确的操作人员

## 完成

修复后，新创建的死亡记录应正确显示操作人员姓名。

