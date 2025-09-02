# 员工权限管理系统部署指南

## 系统概述

本系统为微信小程序添加了完整的员工权限管理功能，支持管理员和普通用户的区分，以及细粒度的权限控制。

## 功能特性

### 1. 用户角色体系
- **管理员（admin）**：拥有所有权限，可以管理员工、分配权限
- **员工（employee）**：根据分配的权限访问相应功能
- **普通用户（user）**：只有基础权限

### 2. 权限管理
- **基础权限**：访问基本功能
- **生产管理**：生产数据查看/管理
- **健康管理**：健康数据查看/管理
- **财务管理**：财务数据查看/管理/审批
- **员工管理**：员工信息查看/管理/邀请
- **系统管理**：系统设置权限

### 3. 员工管理功能
- **邀请员工**：生成邀请码邀请员工加入组织
- **权限分配**：为员工分配具体权限
- **员工列表**：查看和管理员工信息
- **状态管理**：激活/停用员工账号

## 部署步骤

### 1. 部署云函数

#### 1.1 部署 employeeManage 云函数
```bash
# 进入云函数目录
cd cloudfunctions/employeeManage

# 安装依赖
npm install

# 右键选择"上传并部署：云端安装依赖"
```

#### 1.2 更新 login 云函数
- 登录云函数已更新，需要重新部署
- 第一个注册的用户将自动成为管理员

### 2. 数据库集合

系统会自动创建以下数据库集合：

#### 2.1 users 集合（扩展字段）
```javascript
{
  _id: string,
  _openid: string,
  nickname: string,
  avatarUrl: string,
  phone: string,
  farmName: string,
  // 新增权限字段
  role: 'admin' | 'employee' | 'user',
  permissions: string[],
  department: string,
  position: string,
  managedBy: string,
  organizationId: string,
  createTime: Date,
  isActive: boolean
}
```

#### 2.2 employee_invites 集合（新增）
```javascript
{
  _id: string,
  inviteCode: string,
  inviterOpenid: string,
  inviterName: string,
  organizationId: string,
  department: string,
  position: string,
  permissions: string[],
  createTime: Date,
  expireTime: Date,
  isUsed: boolean,
  usedBy: string,
  usedTime: Date
}
```

### 3. 页面配置

员工管理页面已添加到路由配置中：
- 路径：`/pages/employee/employee`
- 权限要求：员工管理相关权限

## 使用说明

### 1. 管理员操作流程

#### 1.1 首次登录
1. 第一个注册的用户自动成为管理员
2. 完善个人信息和养殖场信息

#### 1.2 邀请员工
1. 进入"个人中心" → "员工管理"
2. 点击"邀请员工"按钮
3. 填写员工部门、职位和权限
4. 生成邀请码并发送给员工

#### 1.3 管理员工
1. 在员工列表中查看所有员工
2. 编辑员工权限和信息
3. 激活/停用员工账号

### 2. 员工加入流程

#### 2.1 通过邀请码加入
1. 员工完成微信登录
2. 进入"个人中心" → "员工管理"
3. 点击"加入组织"
4. 输入管理员提供的邀请码
5. 成功加入后获得相应权限

### 3. 权限控制

#### 3.1 菜单权限
- 个人中心的功能菜单会根据用户权限显示/隐藏
- 无权限的功能会显示权限不足提示

#### 3.2 页面权限
- 进入需要权限的页面时会自动检查
- 权限不足会显示提示并阻止访问

## 权限详细说明

### 基础权限分类

| 权限代码 | 权限名称 | 说明 |
|---------|---------|------|
| basic | 基础功能访问 | 所有用户的基本权限 |
| production.view | 生产数据查看 | 查看生产相关数据 |
| production.manage | 生产数据管理 | 管理生产数据 |
| health.view | 健康数据查看 | 查看健康监控数据 |
| health.manage | 健康数据管理 | 管理健康数据 |
| finance.view | 财务数据查看 | 查看财务报表和数据 |
| finance.manage | 财务数据管理 | 管理财务数据 |
| finance.approve | 财务审批 | 审批财务申请 |
| employee.view | 员工信息查看 | 查看员工列表和信息 |
| employee.manage | 员工信息管理 | 管理员工信息和权限 |
| employee.invite | 员工邀请 | 邀请新员工加入 |
| system.admin | 系统管理 | 系统设置和管理 |
| all | 所有权限 | 拥有所有功能权限 |

### 角色默认权限

| 角色 | 默认权限 |
|-----|---------|
| admin | all（所有权限） |
| employee | basic, production.view, health.view, finance.view |
| user | basic |

## 开发接口

### 权限工具类使用

```typescript
import { PermissionManager } from '../../utils/permission'

// 检查权限
const hasPermission = PermissionManager.hasPermission(userInfo, 'employee.manage')

// 验证权限（会显示提示）
const isValid = PermissionManager.validatePermission(userInfo, 'finance.approve')

// 检查是否是管理员
const isAdmin = PermissionManager.isAdmin(userInfo)

// 获取权限列表
const permissions = PermissionManager.getUserPermissionList(userInfo)
```

### 云函数调用示例

```typescript
// 获取员工列表
const result = await wx.cloud.callFunction({
  name: 'employeeManage',
  data: {
    action: 'getEmployees'
  }
})

// 邀请员工
const inviteResult = await wx.cloud.callFunction({
  name: 'employeeManage',
  data: {
    action: 'inviteEmployee',
    department: '生产部',
    position: '饲养员',
    permissions: ['basic', 'production.view']
  }
})

// 加入组织
const joinResult = await wx.cloud.callFunction({
  name: 'employeeManage',
  data: {
    action: 'joinByInvite',
    inviteCode: 'ABC12345'
  }
})
```

## 注意事项

1. **第一个用户自动成为管理员**：确保正确的人员首先注册
2. **邀请码有效期**：默认7天，可在邀请时自定义
3. **权限检查**：所有敏感操作都有权限验证
4. **数据安全**：员工数据通过权限控制保护
5. **组织隔离**：通过 organizationId 实现多组织支持

## 扩展建议

1. **审批流程**：可以添加员工申请审批功能
2. **权限模板**：预设不同职位的权限模板
3. **操作日志**：记录权限变更和敏感操作
4. **批量管理**：支持批量设置员工权限
5. **通知系统**：权限变更时通知相关人员

## 故障排除

### 常见问题

1. **云函数调用失败**
   - 检查云函数是否正确部署
   - 确认云开发环境配置

2. **权限检查异常**
   - 确认用户信息完整性
   - 检查 permissions 字段格式

3. **邀请码无效**
   - 检查邀请码是否过期
   - 确认邀请码格式正确

4. **员工无法加入**
   - 验证邀请码有效性
   - 检查网络连接状态
