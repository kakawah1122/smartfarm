# 角色体系统一更新部署指南

## 🎯 更新概述

已完成对整个小程序的角色体系统一更新，从原有的多种不同角色定义（11个角色）简化为标准的4个核心角色，并确保登录注册模块与权限管理系统完全一致。

### 核心角色定义
- **超级管理员 (super_admin)**: 系统全局管理权限
- **经理 (manager)**: 业务运营管理权限  
- **员工 (employee)**: 日常操作执行权限，**包括AI诊断完全权限**
- **兽医 (veterinarian)**: 健康诊疗专业权限

## 📁 更新文件清单

### 🔧 云函数更新

#### 1. 登录注册相关
- **`cloudfunctions/login/index.js`**
  - 第一个用户角色：`admin` → `super_admin`
  - 默认用户角色：`user` → `employee`
  - 更新角色注释说明

- **`cloudfunctions/register/index.js`**
  - 保持现有邀请码逻辑，兼容新角色体系

- **`cloudfunctions/user-approval/index.js`**
  - 权限验证更新：`user.role === 'super_admin' || user.role === 'manager'`
  - 移除旧的`isSuper`、`admin`、`operator`判断

#### 2. 用户管理相关
- **`cloudfunctions/employee-invite-management/index.js`**
  - 权限验证统一为新4角色
  - 默认邀请角色：`user` → `employee`

- **`cloudfunctions/user-management/index.js`**
  - 集成统一角色配置：`require('../common/role-config')`
  - 更新`ROLE_PERMISSIONS`为新4角色
  - 新增`getUserRoles`函数支持前端权限管理器

#### 3. 新增配置文件
- **`cloudfunctions/common/role-config.js`**
  - 统一角色定义和权限配置
  - 角色层级、权限矩阵、工具函数
  - 前后端共享的角色常量

### 🎨 前端更新

#### 1. 工具和配置
- **`miniprogram/utils/role-config.js`**
  - 前端角色配置文件
  - 角色显示信息（颜色、图标、描述）
  - 权限检查和工具函数

#### 2. 页面更新
- **`miniprogram/pages/login/login.ts`**
  - 导入新角色配置
  - 更新`UserInfo`接口类型注释

- **`miniprogram/pages/profile/profile.ts`**
  - 导入新角色工具函数
  - 简化`getRoleDisplayName`函数逻辑

#### 3. 权限配置更新
- **`miniprogram/utils/permission-config.js`**
  - AI诊断验证按钮：员工角色权限开放
  - 确保所有4个角色都能使用AI诊断功能

#### 4. 新增角色管理页面
- **`miniprogram/pages/role-management/`**
  - 完整的角色管理界面
  - 权限矩阵展示
  - 用户角色分配功能
  - 响应式设计和TDesign组件

## 🔑 关键权限调整

### AI诊断权限完全开放给员工
- **权限矩阵更新**: 员工AI诊断从 ◐ (部分权限) → ✓ (完全权限)
- **操作权限**: 员工可以创建、查看、验证AI诊断
- **页面访问**: 员工可以访问所有AI诊断相关页面
- **组件权限**: 所有AI诊断按钮和功能对员工开放

### 角色层级关系
```
鹅场管理系统角色体系
├── 超级管理员 (super_admin) - 级别1
│   └── 系统全局管理权限
├── 经理 (manager) - 级别2  
│   └── 业务运营管理权限
├── 员工 (employee) - 级别3
│   └── 日常操作执行权限，包括AI诊断
└── 兽医 (veterinarian) - 级别3
    └── 健康诊疗专业权限
```

## 📋 部署步骤

### 1. 云函数部署
```bash
# 部署所有更新的云函数
wx cloud functions:deploy login
wx cloud functions:deploy register  
wx cloud functions:deploy user-approval
wx cloud functions:deploy employee-invite-management
wx cloud functions:deploy user-management

# 部署新的通用配置（如果支持）
wx cloud functions:deploy common
```

### 2. 前端代码同步
- 确保所有前端文件已更新
- 验证新的角色管理页面可正常访问
- 测试权限组件和角色显示

### 3. 数据库角色迁移
如果需要迁移现有用户角色数据：

```javascript
// 在云函数中执行角色迁移
const roleMapping = {
  'admin': 'super_admin',
  'user': 'employee', 
  'operator': 'employee',
  'technician': 'veterinarian',
  'finance': 'manager'
}

// 批量更新用户角色
await db.collection('users').where({
  role: db.command.in(Object.keys(roleMapping))
}).update({
  data: {
    role: db.command.replace(roleMapping)
  }
})
```

## ✅ 验证清单

### 功能验证
- [ ] 第一个用户注册为超级管理员
- [ ] 新用户默认为员工角色
- [ ] 员工可以完全使用AI诊断功能
- [ ] 角色管理页面正常显示和操作
- [ ] 权限验证在各个模块正常工作

### 页面验证  
- [ ] 登录页面角色显示正确
- [ ] 个人资料页面角色名称更新
- [ ] 角色管理页面功能完整
- [ ] AI诊断页面员工可正常访问

### 权限验证
- [ ] 超级管理员：所有功能可用
- [ ] 经理：管理功能和AI诊断可用
- [ ] 员工：基础功能和AI诊断可用  
- [ ] 兽医：健康功能和AI诊断可用

## 🚨 注意事项

1. **向下兼容**: 保持对现有用户数据的兼容性
2. **权限验证**: 确保所有云函数都使用新的角色验证逻辑
3. **AI诊断**: 特别验证员工角色的AI诊断完整权限
4. **错误处理**: 对无效角色代码的容错处理
5. **缓存清理**: 部署后清理前端权限缓存

## 📚 相关文档

- [用户角色权限系统文档](./user-role-permission-system.md)
- [统一权限使用指南](./unified-permission-usage-guide.md)
- [完整部署指南](./complete-deployment-guide.md)

## 🔄 后续维护

1. **监控角色分布**: 定期检查各角色用户数量
2. **权限审计**: 定期审查角色权限分配
3. **用户反馈**: 收集角色权限使用反馈
4. **系统优化**: 根据使用情况优化角色权限设计
