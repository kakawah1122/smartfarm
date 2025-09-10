# 统一权限管理使用指南

## 概述
本文档详细说明了如何在整个小程序中使用统一的权限管理体系，确保所有页面和组件都使用一致的权限控制。

## 权限体系概览

### 角色定义
- **超级管理员 (super_admin)**: 系统全局管理权限
- **经理 (manager)**: 业务运营管理权限  
- **员工 (employee)**: 日常操作执行权限，包括AI诊断功能
- **兽医 (veterinarian)**: 健康诊疗专业权限

### 权限模块
- **生产管理 (production_management)**: 批次、入栏、出栏、物料
- **健康管理 (health_management)**: 健康记录、诊疗、疫苗
- **财务管理 (finance_management)**: 收支、成本、报表
- **用户管理 (user_management)**: 用户、角色、权限
- **AI诊断 (ai_diagnosis)**: AI诊断、验证、历史
- **系统管理 (system_management)**: 配置、备份、日志

## 使用方法

### 1. 在页面中使用权限控制

#### 方法一：使用权限组件包装内容
```xml
<!-- pages/production/production.wxml -->
<permission-wrapper 
  module="production_management" 
  action="read"
  bind:authorized="onAuthorized"
  bind:unauthorized="onUnauthorized"
>
  <!-- 有权限时显示的内容 -->
  <view class="production-content">
    <text>生产管理内容</text>
  </view>
</permission-wrapper>
```

#### 方法二：使用组件ID预配置权限
```xml
<!-- 使用预配置的组件权限 -->
<permission-wrapper 
  component-id="production-menu"
  bind:permissionChecked="onPermissionChecked"
>
  <view class="menu-item">生产管理</view>
</permission-wrapper>
```

#### 方法三：使用角色权限控制
```xml
<!-- 只有经理和超级管理员能看到 -->
<permission-wrapper 
  allowed-roles="{{['super_admin', 'manager']}}"
>
  <button>创建新批次</button>
</permission-wrapper>
```

### 2. 在JavaScript中进行权限检查

#### 页面级权限检查
```javascript
// pages/finance/finance.js
import { checkPagePermission } from '../../utils/permission-manager.js'

Page({
  async onLoad() {
    // 检查页面访问权限
    const hasPermission = await checkPagePermission('/pages/finance/finance')
    if (!hasPermission) {
      wx.showModal({
        title: '访问受限',
        content: '您没有权限访问财务管理',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
      return
    }
    
    // 继续页面初始化
    this.initPage()
  },
  
  async initPage() {
    // 页面初始化逻辑
  }
})
```

#### 功能级权限检查
```javascript
// 在具体功能中检查权限
import { checkPermission } from '../../utils/permission-manager.js'

Page({
  async onCreateBatch() {
    // 检查创建批次权限
    const hasPermission = await checkPermission(
      'production_management', 
      'create'
    )
    
    if (!hasPermission) {
      wx.showToast({
        title: '无权限创建批次',
        icon: 'none'
      })
      return
    }
    
    // 执行创建批次逻辑
    this.createBatch()
  },
  
  async onDeleteRecord(e) {
    const recordId = e.currentTarget.dataset.id
    
    // 检查删除权限
    const hasPermission = await checkPermission(
      'production_management',
      'delete',
      recordId
    )
    
    if (!hasPermission) {
      wx.showToast({
        title: '无权限删除记录',
        icon: 'none'
      })
      return
    }
    
    // 执行删除逻辑
    this.deleteRecord(recordId)
  }
})
```

#### 批量权限检查
```javascript
// 一次性检查多个权限
import permissionManager from '../../utils/permission-manager.js'

Page({
  async onLoad() {
    // 批量检查权限
    const permissions = await permissionManager.checkMultiplePermissions({
      canCreate: {
        module: 'production_management',
        action: 'create'
      },
      canDelete: {
        module: 'production_management', 
        action: 'delete'
      },
      canExport: {
        module: 'production_management',
        action: 'batch_operation'
      }
    })
    
    this.setData({
      canCreate: permissions.canCreate,
      canDelete: permissions.canDelete,
      canExport: permissions.canExport
    })
  }
})
```

### 3. 在组件中使用权限控制

#### 组件内权限检查
```javascript
// components/batch-card/batch-card.js
import { checkComponentPermission } from '../../utils/permission-manager.js'

Component({
  properties: {
    batchInfo: Object
  },
  
  data: {
    canEdit: false,
    canDelete: false
  },
  
  lifetimes: {
    async attached() {
      await this.checkPermissions()
    }
  },
  
  methods: {
    async checkPermissions() {
      // 检查编辑权限
      const canEdit = await checkComponentPermission('batch-form', {
        module: 'production_management',
        resourceId: this.data.batchInfo.id
      })
      
      // 检查删除权限
      const canDelete = await checkComponentPermission('delete-record-btn', {
        module: 'production_management',
        resourceId: this.data.batchInfo.id
      })
      
      this.setData({ canEdit, canDelete })
    }
  }
})
```

### 4. 页面导航权限控制

#### 使用导航守卫
```javascript
// utils/navigation-guard.js
import permissionManager from './permission-manager.js'

export async function navigateWithPermission(url) {
  const hasPermission = await permissionManager.navigationGuard(url)
  if (hasPermission) {
    wx.navigateTo({ url })
  }
  // 权限不足时已在navigationGuard中处理
}

// 使用示例
import { navigateWithPermission } from '../../utils/navigation-guard.js'

Page({
  onGoToFinance() {
    navigateWithPermission('/pages/finance/finance')
  }
})
```

#### 在页面跳转前检查权限
```javascript
Page({
  async onNavigateToUserManagement() {
    const hasPermission = await getApp().globalData.permissionManager
      .checkPagePermission('/pages/user/user-list')
    
    if (hasPermission) {
      wx.navigateTo({
        url: '/pages/user/user-list'
      })
    } else {
      wx.showToast({
        title: '无权限访问用户管理',
        icon: 'none'
      })
    }
  }
})
```

### 5. 条件渲染权限控制

#### 在WXML中使用权限状态
```xml
<!-- 根据权限显示不同内容 -->
<view wx:if="{{canCreate}}">
  <button bind:tap="onCreateBatch">创建批次</button>
</view>

<view wx:if="{{canDelete}}">
  <button bind:tap="onDeleteBatch">删除批次</button>
</view>

<view wx:if="{{canExport}}">
  <button bind:tap="onExportData">导出数据</button>
</view>

<!-- 根据角色显示不同菜单 -->
<view wx:if="{{userRole === 'super_admin' || userRole === 'manager'}}">
  <text>管理员菜单</text>
</view>

<view wx:if="{{userRole === 'veterinarian'}}">
  <text>兽医专用功能</text>
</view>
```

#### 动态权限检查
```javascript
Page({
  data: {
    canCreate: false,
    canDelete: false,
    userRole: ''
  },
  
  async onShow() {
    // 每次页面显示时检查权限
    await this.updatePermissions()
  },
  
  async updatePermissions() {
    const permissionManager = getApp().globalData.permissionManager
    
    // 获取用户角色
    const highestRole = permissionManager.getHighestRole()
    const userRole = highestRole ? highestRole.roleCode : ''
    
    // 检查具体权限
    const canCreate = await permissionManager.checkPermission(
      'production_management', 
      'create'
    )
    const canDelete = await permissionManager.checkPermission(
      'production_management', 
      'delete'
    )
    
    this.setData({
      userRole,
      canCreate,
      canDelete
    })
  }
})
```

### 6. 自定义权限检查

#### 实现自定义权限逻辑
```javascript
// 在权限组件中使用自定义检查
Component({
  methods: {
    // 自定义权限检查函数
    async customPermissionCheck() {
      const permissionManager = getApp().globalData.permissionManager
      
      // 检查是否为工作时间
      const now = new Date()
      const hour = now.getHours()
      if (hour < 6 || hour > 22) {
        return false
      }
      
      // 检查是否有基本权限
      const hasBasicPermission = await permissionManager.checkPermission(
        'health_management',
        'create'
      )
      
      // 检查是否为兽医或管理员
      const hasRole = permissionManager.hasAnyRole(['veterinarian', 'manager', 'super_admin'])
      
      return hasBasicPermission && hasRole
    }
  }
})
```

```xml
<!-- 使用自定义权限检查 -->
<permission-wrapper custom-check="customPermissionCheck">
  <view>只在工作时间且有权限时显示</view>
</permission-wrapper>
```

### 7. 权限缓存管理

#### 手动清理权限缓存
```javascript
Page({
  onRoleChanged() {
    // 角色变更后清理缓存
    const permissionManager = getApp().globalData.permissionManager
    permissionManager.clearPermissionCache()
    
    // 重新检查权限
    this.updatePermissions()
  },
  
  onRefreshPermissions() {
    // 手动刷新权限
    const permissionManager = getApp().globalData.permissionManager
    permissionManager.clearPermissionCache()
    
    // 重新加载用户角色
    permissionManager.loadUserRoles().then(() => {
      this.updatePermissions()
    })
  }
})
```

### 8. 错误处理

#### 权限错误统一处理
```javascript
import permissionManager from '../../utils/permission-manager.js'

Page({
  async onSomeAction() {
    try {
      const hasPermission = await permissionManager.checkPermission(
        'finance_management',
        'create'
      )
      
      if (hasPermission) {
        // 执行操作
      }
    } catch (error) {
      // 使用统一的错误处理
      permissionManager.handlePermissionError(error, {
        module: 'finance_management',
        action: 'create',
        page: '/pages/finance/finance'
      })
    }
  }
})
```

### 9. 调试权限问题

#### 权限调试工具
```javascript
Page({
  onLoad() {
    // 开发环境下启用权限调试
    if (process.env.NODE_ENV === 'development') {
      const permissionManager = getApp().globalData.permissionManager
      permissionManager.debugPermissions()
    }
  }
})
```

## 最佳实践

### 1. 权限检查时机
- **页面加载时**: 检查页面访问权限
- **功能执行前**: 检查具体操作权限
- **UI渲染时**: 检查显示权限
- **角色变更后**: 清理缓存重新检查

### 2. 性能优化
- 利用权限缓存减少云函数调用
- 批量检查多个权限
- 在合适的时机清理缓存

### 3. 用户体验
- 提供清晰的权限不足提示
- 隐藏用户无权限的功能
- 提供权限申请或联系管理员的方式

### 4. 安全性
- 前端权限检查仅用于UI控制
- 后端云函数必须再次验证权限
- 敏感操作需要额外的安全验证

## 配置说明

### 添加新页面权限
在 `permission-config.js` 中添加页面配置：
```javascript
export const PAGE_PERMISSIONS = {
  '/pages/new-page/new-page': {
    module: 'production_management',
    action: 'read',
    allowedRoles: ['super_admin', 'manager', 'employee']
  }
}
```

### 添加新组件权限
在 `permission-config.js` 中添加组件配置：
```javascript
export const COMPONENT_PERMISSIONS = {
  'new-component-btn': {
    module: 'health_management',
    action: 'create',
    allowedRoles: ['super_admin', 'manager', 'veterinarian']
  }
}
```

### 修改角色权限
在后端 `user-role-permission-system.md` 中修改角色权限配置，然后重新初始化数据库。

通过这套统一的权限管理体系，整个小程序的权限控制都保持一致，便于维护和扩展。
