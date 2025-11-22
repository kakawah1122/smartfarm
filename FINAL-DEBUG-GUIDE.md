# 🔍 最终调试指南

## ✅ 已添加详细调试日志

我已经在profile.ts中添加了详细的console.log，可以追踪整个执行流程。

---

## 📱 立即操作步骤

### 步骤1：清除所有缓存并重新编译

**非常重要！必须清除编译缓存！**

1. 在微信开发者工具中点击：**"清缓存" → "清除编译缓存"**
2. 再点击：**"清缓存" → "清除全部缓存"**
3. 点击：**"编译"**

### 步骤2：打开个人中心页面

1. 在小程序中进入个人中心
2. **立即查看控制台**

### 步骤3：查看控制台日志

您应该看到以下日志（按顺序）：

```
[Profile] loadUserInfo开始执行
[Profile] 获取到的userInfo: {role: "super_admin", ...}
[Profile] userInfo.role= super_admin
[Profile] getRoleDisplayName被调用, role= super_admin
[Profile] getRoleDisplayName返回: 超级管理员
[Profile] 准备setData, roleDisplayName= 超级管理员
[Profile] setData完成, 当前data.userInfo.role= 超级管理员
```

### 步骤4：如果没看到日志

说明代码没有更新，请：

1. **关闭微信开发者工具**
2. **重新打开**
3. **再次清除缓存**
4. **重新编译**

---

## 🔧 手动强制刷新（确保看到日志）

在控制台执行：

```javascript
// 1. 清除控制台
console.clear()

// 2. 获取当前页面
var pages = getCurrentPages()
var currentPage = pages[pages.length - 1]

console.log('当前页面:', currentPage.route)
console.log('当前显示的role:', currentPage.data.userInfo.role)

// 3. 调用loadUserInfo（会输出详细日志）
currentPage.loadUserInfo().then(() => {
  console.log('===== loadUserInfo执行完成 =====')
  console.log('最终data.userInfo.role=', currentPage.data.userInfo.role)
})
```

---

## 📊 预期结果和问题诊断

### ✅ 如果看到完整日志

```
[Profile] loadUserInfo开始执行
[Profile] 获取到的userInfo: {role: "super_admin", ...}
[Profile] userInfo.role= super_admin
[Profile] getRoleDisplayName被调用, role= super_admin
[Profile] getRoleDisplayName返回: 超级管理员
[Profile] 准备setData, roleDisplayName= 超级管理员
[Profile] setData完成, 当前data.userInfo.role= 超级管理员
```

**结论**：代码已正确执行，页面应该显示"超级管理员"

**如果还显示"用户"**：说明WXML渲染有问题，需要检查WXML绑定

### ❌ 如果getRoleDisplayName返回"用户"

```
[Profile] getRoleDisplayName被调用, role= super_admin
[Profile] getRoleDisplayName返回: 用户  ← 这里不对
```

**结论**：getRoleDisplayName函数中没有'super_admin'的定义

**原因**：代码没有更新，需要重新编译

### ❌ 如果userInfo.role不是super_admin

```
[Profile] userInfo.role= employee  ← 不是super_admin
```

**结论**：存储中的role不对，需要修改数据库

**解决方案**：在控制台执行：

```javascript
var userInfo = wx.getStorageSync('userInfo')
userInfo.role = 'super_admin'
wx.setStorageSync('userInfo', userInfo)

var app = getApp()
app.globalData.userInfo = userInfo

// 刷新页面
var pages = getCurrentPages()
var currentPage = pages[pages.length - 1]
currentPage.loadUserInfo()
```

### ❌ 如果完全没有日志

**结论**：
1. 代码没有更新（编译缓存问题）
2. 或者不在profile页面

**解决方案**：
1. 关闭开发者工具
2. 重新打开
3. 清除所有缓存
4. 重新编译
5. 确认在profile页面

---

## 🎯 调试代码集合

### 代码1：完整诊断

```javascript
console.clear()
console.log('===== 开始诊断 =====')

// 1. 检查存储
var userInfo = wx.getStorageSync('userInfo')
console.log('1. Storage中的role:', userInfo.role)
console.log('   Storage中的permissions:', userInfo.permissions)

// 2. 检查当前页面
var pages = getCurrentPages()
var currentPage = pages[pages.length - 1]
console.log('2. 当前页面route:', currentPage.route)
console.log('   当前页面data.userInfo.role:', currentPage.data.userInfo.role)

// 3. 测试getRoleDisplayName
if (currentPage.route === 'pages/profile/profile') {
  console.log('3. 测试getRoleDisplayName:')
  console.log('   super_admin ->', currentPage.getRoleDisplayName('super_admin'))
  console.log('   admin ->', currentPage.getRoleDisplayName('admin'))
  console.log('   employee ->', currentPage.getRoleDisplayName('employee'))
  console.log('   unknown ->', currentPage.getRoleDisplayName('unknown'))
} else {
  console.log('3. 不在profile页面，无法测试getRoleDisplayName')
}

console.log('===== 诊断完成 =====')
```

### 代码2：强制修复并查看日志

```javascript
console.clear()
console.log('===== 开始强制修复 =====')

// 修改存储
var userInfo = wx.getStorageSync('userInfo')
userInfo.role = 'super_admin'
userInfo.permissions = ['all']
wx.setStorageSync('userInfo', userInfo)
console.log('1. 已更新Storage')

// 更新app.globalData
var app = getApp()
app.globalData.userInfo = userInfo
console.log('2. 已更新globalData')

// 刷新页面（会输出详细日志）
var pages = getCurrentPages()
var currentPage = pages[pages.length - 1]

if (currentPage.route === 'pages/profile/profile') {
  console.log('3. 开始刷新页面...')
  currentPage.loadUserInfo().then(() => {
    console.log('===== 刷新完成 =====')
    console.log('最终结果: data.userInfo.role=', currentPage.data.userInfo.role)
  })
} else {
  console.log('当前不在profile页面')
}
```

### 代码3：直接测试setData

```javascript
console.clear()
var pages = getCurrentPages()
var currentPage = pages[pages.length - 1]

console.log('测试setData...')
console.log('修改前:', currentPage.data.userInfo.role)

currentPage.setData({
  'userInfo.role': '测试角色123'
}, () => {
  console.log('修改后:', currentPage.data.userInfo.role)
  console.log('如果显示"测试角色123"说明setData正常')
})
```

---

## 🚨 如果所有方法都不行

### 最后的终极方案

在 `profile.wxml` 中直接硬编码测试：

找到这一行（第36行）：
```xml
<text class="role-badge">{{userInfo.role}}</text>
```

临时改为：
```xml
<text class="role-badge">超级管理员</text>
```

如果这样都不显示"超级管理员"，说明：
1. WXML没有重新编译
2. 或者有CSS隐藏了
3. 或者看错位置了

---

## 📋 请提供以下信息

执行上面的诊断代码后，请告诉我：

1. **控制台是否有`[Profile]`开头的日志？**
   - 如果有，完整复制发给我
   - 如果没有，说明代码没更新

2. **getRoleDisplayName('super_admin')返回什么？**
   - 应该返回"超级管理员"
   - 如果返回"用户"，说明函数没更新

3. **最终data.userInfo.role的值是什么？**
   - 应该是"超级管理员"
   - 如果不是，说明setData有问题

4. **页面实际显示什么？**
   - 截图发给我

---

**现在请立即：**
1. 清除所有缓存
2. 重新编译
3. 打开个人中心
4. 查看控制台日志
5. 告诉我结果！
