# 修复 wx.getUserProfile 频繁调用错误

## 问题描述
出现错误："invoke wx.getUserProfile too frequently"

这是因为 `wx.getUserProfile` API 有调用频率限制，并且微信官方已经废弃了这个API。

## 问题原因
在个人中心页面的 `changeAvatar()` 函数中使用了已废弃的 `wx.getUserProfile` API。

## 修复方案

### ✅ 已完成的修复
1. **移除废弃API**: 完全移除了 `wx.getUserProfile` 的调用
2. **更新头像更换逻辑**: 修改为引导用户到登录页面进行头像更换
3. **使用正确的API**: 登录页面已经使用了正确的头像昵称填写组件

### 📝 修复详情

**原代码 (已移除)**:
```javascript
// 错误的做法 - 已废弃的API
const { userInfo } = await wx.getUserProfile({
  desc: '用于完善会员资料',
})
```

**新代码**:
```javascript
// 正确的做法 - 引导到合适的页面
changeAvatar() {
  if (!this.data.isLoggedIn) {
    wx.showToast({
      title: '请先登录',
      icon: 'none'
    })
    return
  }

  wx.showModal({
    title: '更换头像',
    content: '头像更换功能请在个人信息编辑页面进行操作',
    showCancel: true,
    confirmText: '去编辑',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        wx.navigateTo({
          url: '/pages/login/login'
        })
      }
    }
  })
}
```

## 用户体验改进

### 头像更换流程
1. **个人中心**: 点击头像 → 显示提示弹窗
2. **选择操作**: 用户可以选择去编辑页面或取消
3. **登录页面**: 使用正确的头像昵称填写组件
4. **数据同步**: 更新后的头像会自动同步到个人中心

### 技术优势
- ✅ 符合微信最新API规范
- ✅ 避免频繁调用限制
- ✅ 更好的用户体验
- ✅ 统一的头像管理流程

## 登录页面的头像组件

登录页面已经正确实现了头像选择功能：

```javascript
// 正确的头像选择实现
async onChooseAvatar(e: any) {
  const { avatarUrl } = e.detail
  this.setData({
    selectedAvatarUrl: avatarUrl
  })
  
  wx.showToast({
    title: '头像已选择',
    icon: 'success'
  })
}
```

对应的WXML使用了头像昵称填写组件：
```html
<button 
  class="avatar-button" 
  open-type="chooseAvatar" 
  bind:chooseavatar="onChooseAvatar">
  <image class="avatar-image" src="{{selectedAvatarUrl || '/assets/icons/profile.png'}}" />
</button>
```

## 验证修复

修复后应该：
1. ✅ 不再出现 "invoke wx.getUserProfile too frequently" 错误
2. ✅ 个人中心头像点击后显示合理的引导提示
3. ✅ 登录页面的头像选择功能正常工作
4. ✅ 头像数据正确保存和显示

## 注意事项

1. **API废弃**: `wx.getUserProfile` 已被微信官方废弃，不应再使用
2. **频率限制**: 即使是新的API也有调用频率限制，需要合理设计用户交互
3. **用户体验**: 统一的信息编辑入口提供更好的用户体验
4. **数据一致性**: 确保头像更新后在所有页面都能正确显示
