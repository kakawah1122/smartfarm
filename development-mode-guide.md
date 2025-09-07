# 🚧 开发期权限限制解决方案指南

> 在微信小程序免费版本中，无法修改云存储权限设置。本指南提供完整的开发期解决方案。

## 📋 **问题说明**

微信小程序免费版本限制：
- ❌ 无法修改云存储权限配置
- ❌ 默认权限：仅创建者可读写 (`resource.openid == auth.openid`)
- ⚠️ 影响团队协作和数据共享功能

## 🔧 **解决方案**

### **方案1：开发模式存储（推荐）**

我已经为您的项目添加了**开发模式支持**，无需修改云端权限即可继续开发：

#### **工作原理**
```javascript
// 开发模式下的路径结构：
// 普通模式: health/symptoms/2024/01/file.jpg
// 开发模式: dev-{openid}/health/symptoms/2024/01/file.jpg
```

每个用户的文件都存储在自己的目录下，避免权限冲突。

#### **使用方法**

**1. 在 app.js 中启用开发模式**
```javascript
// miniprogram/app.js
import { DynamicStorageManager } from './utils/dynamic-storage'

App({
  onLaunch() {
    // 启用开发模式（已默认开启）
    DynamicStorageManager.setDevelopmentMode(true)
    console.log('🔧 开发模式已启用')
  }
})
```

**2. 正常使用存储功能**
```javascript
// 任何页面中使用
import { DynamicStorageManager } from '../../utils/dynamic-storage'

// 上传文件 - 自动应用开发模式
const result = await DynamicStorageManager.uploadFile(tempFilePath, {
  category: 'health',
  subCategory: 'symptoms',
  recordDate: '2024-01-15'
  // devMode 会自动应用，无需手动设置
})

console.log('文件上传成功:', result.cloudPath)
// 输出: dev-{your-openid}/health/symptoms/2024-01/file.jpg
```

### **方案2：权限检查和错误处理**

在需要跨用户访问的功能中，添加权限检查：

```javascript
// 示例：查看团队健康数据
async loadTeamHealthData() {
  try {
    const result = await wx.cloud.callFunction({
      name: 'health-management',
      data: { action: 'getTeamStats' }
    })
    // 成功处理
  } catch (error) {
    if (error.errCode === -404003) {
      // 权限不足时的替代方案
      console.log('开发期权限限制，使用模拟数据')
      this.loadMockData()
    }
  }
}
```

### **方案3：本地开发数据**

对于需要共享的数据，使用本地存储模拟：

```javascript
// 模拟团队数据
const mockTeamData = {
  totalEmployees: 25,
  healthyCount: 22,
  abnormalCount: 3,
  // ... 其他模拟数据
}

// 在开发期使用模拟数据
const teamStats = DynamicStorageManager.isDev() 
  ? mockTeamData 
  : await this.getRealTeamData()
```

## 🎯 **开发建议**

### **当前阶段（免费版）**
1. ✅ 启用开发模式继续功能开发
2. ✅ 使用模拟数据测试团队功能
3. ✅ 完善UI和交互逻辑
4. ✅ 准备权限配置文档

### **上线准备阶段**
1. 🔄 升级到付费版本
2. 🔄 配置正确的存储权限
3. 🔄 关闭开发模式
4. 🔄 测试真实环境功能

## 📱 **实际操作步骤**

### **Step 1: 确认开发模式已启用**
```javascript
// 在任何页面的 console 中检查
console.log('开发模式状态:', DynamicStorageManager.isDev())
// 应该输出: true
```

### **Step 2: 测试文件上传**
```javascript
// 选择图片后上传测试
wx.chooseImage({
  count: 1,
  success: async (res) => {
    const result = await DynamicStorageManager.uploadFile(res.tempFilePaths[0], {
      category: 'health',
      subCategory: 'symptoms',
      recordDate: new Date().toISOString().split('T')[0]
    })
    
    if (result.success) {
      console.log('✅ 开发模式上传成功:', result.cloudPath)
      // 路径应该包含 dev- 前缀
    }
  }
})
```

### **Step 3: 验证存储结构**
在微信云开发控制台 → 存储管理中，您应该看到类似的目录结构：
```
dev-{your-openid}/
  ├── health/
  │   ├── symptoms/
  │   ├── treatment/
  │   └── recovery/
  ├── production/
  │   ├── entry/
  │   ├── exit/
  │   └── material/
  └── ...
```

## ⚠️ **注意事项**

### **开发期限制**
- 每个开发者只能看到自己的数据
- 团队协作功能需要使用模拟数据
- 文件共享功能暂时无法完全测试

### **数据迁移**
- 升级付费版后，需要将开发期数据迁移到正式目录
- 建议编写数据迁移脚本
- 测试数据可以保留作为备份

### **性能考虑**
- 开发模式的路径较长，注意路径长度限制
- 用户较多时，根目录下会有很多 dev- 文件夹

## 🎉 **总结**

通过开发模式，您可以：
- ✅ **继续开发**：无需等待权限升级
- ✅ **功能测试**：核心功能正常工作
- ✅ **UI完善**：专注于用户体验优化
- ✅ **准备上线**：为正式发布做好准备

当准备正式发布时，只需：
1. 升级微信小程序套餐
2. 配置正确的存储权限
3. 关闭开发模式：`DynamicStorageManager.setDevelopmentMode(false)`
4. 进行完整测试

---

**需要帮助？**
- 查看 `deployment-testing-guide.md` 了解完整部署流程
- 查看 `cloud-storage-permissions-config.md` 了解权限配置
- 有问题随时询问！
