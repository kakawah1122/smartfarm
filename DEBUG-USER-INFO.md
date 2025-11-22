# 调试用户信息

## 🔍 请在控制台执行以下代码

### 1. 查看完整的用户信息

```javascript
var userInfo = wx.getStorageSync('userInfo')
console.log('=== 完整用户信息 ===')
console.log('角色 (role):', userInfo.role)
console.log('权限 (permissions):', userInfo.permissions)
console.log('昵称 (nickName):', userInfo.nickName)
console.log('养殖场 (farmName):', userInfo.farmName)
console.log('职位 (position):', userInfo.position)
console.log('完整对象:', userInfo)
```

### 2. 测试权限检查

```javascript
// 导入权限管理器
var PermissionModule = require('/utils/permission.js')
var PermissionManager = PermissionModule.PermissionManager
var userInfo = wx.getStorageSync('userInfo')

console.log('=== 权限检查结果 ===')
console.log('是否有all权限:', PermissionManager.hasPermission(userInfo, 'all'))
console.log('是否有system.admin权限:', PermissionManager.hasPermission(userInfo, 'system.admin'))
console.log('是否有production.manage权限:', PermissionManager.hasPermission(userInfo, 'production.manage'))
```

### 3. 查看角色映射

```javascript
var PermissionModule = require('/utils/permission.js')
var ROLES = PermissionModule.ROLES

console.log('=== 角色定义 ===')
console.log(ROLES)

var userInfo = wx.getStorageSync('userInfo')
console.log('当前角色:', userInfo.role)
console.log('角色显示名:', ROLES[userInfo.role])
```

### 4. 强制刷新个人中心页面

```javascript
var pages = getCurrentPages()
var currentPage = pages[pages.length - 1]

// 触发页面刷新
if (currentPage.route === 'pages/profile/profile') {
  console.log('正在刷新个人中心页面...')
  currentPage.loadUserInfo()
  console.log('刷新完成')
} else {
  console.log('当前不在个人中心页面，当前页面:', currentPage.route)
}
```

---

## 📋 请提供以下信息

执行上面的代码后，请告诉我：

1. **角色 (role) 的值是什么？**
   - 是 `super_admin` 吗？
   - 还是其他值？

2. **权限 (permissions) 包含什么？**
   - 是否包含 `'all'`？
   - 列出所有权限

3. **权限检查结果是什么？**
   - `hasPermission(userInfo, 'all')` 返回 true 还是 false？

4. **角色显示名是什么？**
   - `ROLES[userInfo.role]` 显示什么？

5. **刷新页面后角色显示是否改变？**
   - 执行 `currentPage.loadUserInfo()` 后是否显示"超级管理员"？

---

## 🎯 可能的问题场景

### 场景1：role不是super_admin

如果role显示为其他值（如'employee'、'user'等），说明：
- 登录时没有正确设置为super_admin
- 需要检查云端数据库中的用户记录

**解决方案**：手动修改数据库中的用户记录

### 场景2：permissions不包含'all'

如果permissions数组中没有'all'，说明：
- 登录时没有正确设置权限
- 权限检查会失败

**解决方案**：手动修改数据库中的用户记录

### 场景3：权限检查返回false

如果hasPermission返回false，说明：
- permission.ts的修复没有生效
- 需要重新编译

**解决方案**：清除缓存，重新编译

### 场景4：角色显示名为undefined

如果ROLES[userInfo.role]返回undefined，说明：
- role值不在ROLES定义中
- 可能是拼写错误或新角色

**解决方案**：添加该角色到ROLES定义

---

## 💡 快速修复命令

### 如果确认role是super_admin但显示不对

```javascript
// 方法1：强制更新显示
var pages = getCurrentPages()
var currentPage = pages[pages.length - 1]
var userInfo = wx.getStorageSync('userInfo')

console.log('当前role:', userInfo.role)

currentPage.setData({
  'userInfo.role': '超级管理员',
  showAdminSection: true
})

console.log('已强制设置为超级管理员')
```

### 如果需要手动修改role

```javascript
// 方法2：修改本地存储（临时方案）
var userInfo = wx.getStorageSync('userInfo')
userInfo.role = 'super_admin'
userInfo.permissions = ['all', 'basic', 'production.view', 'production.manage', 'health.view', 'health.manage', 'finance.view', 'finance.manage', 'finance.approve', 'employee.view', 'employee.manage', 'employee.invite', 'system.admin']
wx.setStorageSync('userInfo', userInfo)

console.log('已修改本地存储')

// 刷新app.globalData
var app = getApp()
app.globalData.userInfo = userInfo

// 刷新页面
var pages = getCurrentPages()
var currentPage = pages[pages.length - 1]
if (currentPage.route === 'pages/profile/profile') {
  currentPage.loadUserInfo()
}

console.log('修改完成，请查看个人中心')
```

---

**请先执行上面的诊断代码，告诉我结果，我会根据结果给出精确的解决方案！**
