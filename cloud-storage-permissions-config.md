# 🔐 云存储权限配置指南 - 基于微信云开发最佳实践

> 本配置严格遵循微信官方文档的安全规则标准，确保数据安全和访问控制的合规性。

## 📋 **权限配置清单**

基于我们的动态存储结构，以下是完整的权限配置：

### **1. 用户头像 (avatars/)**

**权限策略**: 所有用户可读，仅创建者可写

```json
{
  "read": true,
  "write": "resource.openid == auth.openid"
}
```

**应用场景**: 
- ✅ 所有用户可以查看其他用户头像
- ✅ 只能修改自己的头像
- 🎯 适用于社交功能和用户识别

---

### **2. 健康数据 (health/)**

**权限策略**: 团队成员可读，仅创建者可写

```json
{
  "read": "auth.openid != null",
  "write": "resource.openid == auth.openid"
}
```

**应用场景**:
- ✅ 已登录用户都可以查看健康数据（团队协作）
- ✅ 只能修改自己创建的健康记录
- 🎯 便于团队成员了解整体健康状况

**详细子目录配置**:

#### `health/symptoms/` - 症状图片
```json
{
  "read": "auth.openid != null",
  "write": "resource.openid == auth.openid"
}
```

#### `health/treatment/` - 治疗过程图片
```json
{
  "read": "auth.openid != null", 
  "write": "resource.openid == auth.openid"
}
```

#### `health/recovery/` - 康复记录图片
```json
{
  "read": "auth.openid != null",
  "write": "resource.openid == auth.openid"
}
```

---

### **3. 生产数据 (production/)**

**权限策略**: 团队协作，全员可见

```json
{
  "read": "auth.openid != null",
  "write": "resource.openid == auth.openid"
}
```

**应用场景**:
- ✅ 生产数据需要团队共享
- ✅ 便于生产计划协调
- 🎯 提升团队工作效率

---

### **4. AI诊断数据 (ai-diagnosis/)**

**权限策略**: 用户私有数据

```json
{
  "read": "resource.openid == auth.openid",
  "write": "resource.openid == auth.openid"  
}
```

**应用场景**:
- ✅ AI诊断结果属于用户隐私
- ✅ 防止诊断信息泄露
- 🎯 保护敏感医疗数据

---

### **5. AI智能盘点 (ai-count/)**

**权限策略**: 用户私有，但可选择共享

```json
{
  "read": "resource.openid == auth.openid",
  "write": "resource.openid == auth.openid"
}
```

**应用场景**:
- ✅ 盘点数据初始为私有
- ✅ 后续可通过业务逻辑实现共享
- 🎯 平衡隐私和协作需求

---

### **6. 文档资料 (documents/)**

**权限策略**: 根据文档类型分级

#### `documents/manuals/` - 操作手册（公开）
```json
{
  "read": true,
  "write": false
}
```

#### `documents/reports/` - 报告文件（团队可见）
```json
{
  "read": "auth.openid != null",
  "write": "resource.openid == auth.openid"
}
```

#### `documents/certificates/` - 证书文件（私有）
```json
{
  "read": "resource.openid == auth.openid",
  "write": "resource.openid == auth.openid"
}
```

---

### **7. 系统文件**

#### `exports/` - 导出文件（用户可见，系统写入）
```json
{
  "read": "resource.openid == auth.openid",
  "write": false
}
```

#### `system/` - 系统文件（仅云函数访问）
```json
{
  "read": false,
  "write": false
}
```

#### `temp/` - 临时文件（用户私有）
```json
{
  "read": "resource.openid == auth.openid", 
  "write": "resource.openid == auth.openid"
}
```

---

## 🎯 **权限配置最佳实践**

### **1. 安全原则**
- **最小权限原则**: 只授予完成任务所需的最小权限
- **用户隔离**: 使用 `resource.openid == auth.openid` 确保用户只能访问自己的数据
- **团队协作**: 使用 `auth.openid != null` 实现已登录用户的数据共享

### **2. 权限层级**
```
📊 权限等级 (从严格到宽松)
├── 🔒 系统专用 (read: false, write: false)
├── 🔐 用户私有 (resource.openid == auth.openid)  
├── 👥 团队协作 (read: auth.openid != null, write: owner)
├── 📖 公开只读 (read: true, write: false)
└── 🌍 完全公开 (read: true, write: true) ❌不推荐
```

### **3. 动态权限支持**
虽然微信云开发的存储权限是静态的，但我们可以通过云函数实现动态权限控制：

```javascript
// 在云函数中实现更细粒度的权限控制
async function checkPermission(fileID, userId, operation) {
  // 查询文件记录
  const fileRecord = await db.collection('dynamic_file_records')
    .where({ fileID, isActive: true })
    .get();
    
  if (fileRecord.data.length === 0) {
    return { allowed: false, reason: '文件不存在' };
  }
  
  const file = fileRecord.data[0];
  
  // 业务权限逻辑
  switch (file.category) {
    case 'health':
      // 健康数据：团队成员可读，创建者可写
      if (operation === 'read') {
        return { allowed: true };
      } else if (operation === 'write') {
        return { allowed: file.userId === userId };
      }
      break;
      
    case 'ai-diagnosis':
      // AI诊断：仅创建者可访问
      return { allowed: file.userId === userId };
      
    default:
      return { allowed: false, reason: '未知文件类型' };
  }
}
```

---

## 📝 **配置步骤指导**

### **Step 1: 登录微信云开发控制台**
1. 访问 [微信云开发控制台](https://console.cloud.tencent.com/tcb)
2. 选择您的小程序项目
3. 进入 "存储" → "权限设置"

### **Step 2: 创建权限规则**
按照以下顺序配置权限：

1. **点击 "添加权限"**
2. **输入文件夹路径** (如: `avatars/**`)
3. **设置权限规则** (复制上面的JSON配置)
4. **保存配置**

### **Step 3: 验证权限配置**
```javascript
// 在小程序中测试权限
async function testPermissions() {
  try {
    // 测试读取权限
    const readResult = await wx.cloud.downloadFile({
      fileID: 'cloud://test-file-id'
    });
    console.log('读取权限正常');
    
    // 测试写入权限
    const uploadResult = await wx.cloud.uploadFile({
      cloudPath: 'test/test.txt',
      filePath: 'temp://test.txt'
    });
    console.log('写入权限正常');
    
  } catch (error) {
    console.error('权限测试失败:', error);
  }
}
```

### **Step 4: 权限问题排查**
如果遇到权限问题，请检查：

1. **用户登录状态**: 确保 `auth.openid` 不为空
2. **文件路径匹配**: 检查权限规则的路径模式是否正确
3. **JSON语法**: 确保权限规则JSON格式正确
4. **测试用户**: 使用不同用户测试权限隔离

---

## 🔧 **高级配置技巧**

### **1. 路径通配符使用**
```json
// 匹配单层目录
"avatars/*": { "read": true }

// 匹配多层目录  
"health/**": { "read": "auth.openid != null" }

// 匹配特定文件
"config/app.json": { "read": true, "write": false }
```

### **2. 条件表达式进阶**
```json
// 组合条件
{
  "read": "auth.openid != null && resource.createTime > '2024-01-01'",
  "write": "resource.openid == auth.openid && auth.role == 'admin'"
}

// 时间条件  
{
  "read": "resource.createTime < now()",
  "write": "resource.expiryTime > now()"
}
```

### **3. 多环境权限管理**
```javascript
// 根据环境设置不同权限
const PERMISSIONS = {
  development: {
    // 开发环境：权限较宽松便于测试
    "test/**": { "read": true, "write": true }
  },
  production: {
    // 生产环境：权限严格
    "test/**": { "read": false, "write": false }
  }
};
```

---

## ⚠️ **安全注意事项**

### **1. 敏感数据保护**
- 🔐 医疗诊断数据必须使用用户私有权限
- 🔐 财务数据建议额外加密存储
- 🔐 个人身份信息严格控制访问

### **2. 权限测试**
- ✅ 定期测试不同角色的权限
- ✅ 验证权限规则的有效性
- ✅ 监控异常访问行为

### **3. 数据备份**
- 💾 重要数据建议定期备份
- 💾 权限配置变更前先备份
- 💾 建立数据恢复机制

### **4. 合规要求**
- 📋 遵循数据保护法规
- 📋 建立访问日志记录
- 📋 定期进行安全审计

---

## 🎉 **配置验证清单**

配置完成后，请验证以下项目：

- [ ] ✅ 用户只能访问自己创建的私有文件
- [ ] ✅ 团队成员可以查看共享的健康和生产数据  
- [ ] ✅ 未登录用户无法访问任何敏感数据
- [ ] ✅ 系统文件仅云函数可访问
- [ ] ✅ AI诊断数据严格用户隔离
- [ ] ✅ 文档权限按类型正确分级
- [ ] ✅ 临时文件和导出文件权限正确
- [ ] ✅ 所有权限规则JSON语法正确

完成以上验证后，您的动态云存储权限配置就完全符合微信云开发的最佳实践了！

---

*本配置基于微信云开发官方文档制定，如有权限相关问题请参考 [微信云开发存储权限文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/storage.html)*
