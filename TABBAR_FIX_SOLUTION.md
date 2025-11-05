# TabBar遮挡问题修复方案

## 问题描述
在真机调试中，健康管理页面的任务详情弹窗底部按钮被TabBar遮挡，用户无法点击操作按钮。

## 问题分析

### 根本原因
1. **t-popup组件的默认行为**：TDesign的t-popup组件使用`placement="bottom"`时，会将弹窗定位在屏幕底部（bottom: 0）
2. **TabBar的层级**：微信小程序的TabBar具有固定的z-index，会覆盖在弹窗之上
3. **之前的错误方案**：仅使用`env(safe-area-inset-bottom)`只能处理设备的物理安全区域（如iPhone X的Home Indicator），无法处理TabBar的逻辑高度

### TabBar高度规范
- **标准高度**：50px（约133rpx）
- **有Home Indicator的设备**：50px + 34px = 84px
- **需要避让的总高度**：133rpx + env(safe-area-inset-bottom)

## 解决方案

### 核心思路
将整个弹窗容器向上偏移TabBar的高度，而不是仅增加内容区域的padding。

### 具体修改

#### 1. 调整弹窗容器定位
```scss
.bottom-popup-content {
  /* 添加底部偏移，将弹窗整体上移，避开TabBar */
  bottom: calc(133rpx + env(safe-area-inset-bottom)) !important;
  bottom: calc(133rpx + constant(safe-area-inset-bottom)) !important; /* 兼容iOS < 11.2 */
  
  /* 调整最大高度，确保弹窗不会超出可视区域 */
  max-height: calc(80vh - 133rpx - env(safe-area-inset-bottom)) !important;
  max-height: calc(80vh - 133rpx - constant(safe-area-inset-bottom)) !important; /* 兼容iOS < 11.2 */
}
```

#### 2. 简化内容和按钮区域样式
因为整个弹窗已经上移，内容区域和按钮区域不需要额外的padding-bottom：

```scss
/* 内容区域 - 恢复正常padding */
.popup-content {
  padding: 24rpx 32rpx;
}

/* 按钮区域 - 使用标准padding */
.action-buttons {
  padding: 24rpx 40rpx 40rpx;
}
```

## 技术要点

### 1. CSS变量兼容性
- 使用`env()`和`constant()`双写，确保在老版本iOS系统上也能正常工作
- `constant()`用于iOS < 11.2，`env()`用于iOS >= 11.2

### 2. TabBar高度常量
- 133rpx = 50px（微信小程序TabBar标准高度）
- 这个值在所有微信小程序中是固定的

### 3. 重要的!important声明
- 由于使用了TDesign的t-popup组件，需要使用`!important`覆盖组件内部样式
- 通过`t-class-content="bottom-popup-content"`自定义类实现样式覆盖

## 验证方案

### 需要测试的场景
1. ✅ iPhone X及以上设备（有Home Indicator）
2. ✅ iPhone 8及以下设备（无Home Indicator）
3. ✅ Android设备
4. ✅ 不同内容长度的弹窗
5. ✅ 有操作按钮和无操作按钮的弹窗

### 预期效果
- 弹窗完全显示在TabBar之上
- 所有按钮可以正常点击
- 弹窗高度自适应，不会超出可视区域
- 在不同设备上都能正确显示

## 适用范围
此修复方案适用于项目中所有使用`bottom-popup`组件的页面：
- 健康管理中心 - 任务详情弹窗
- 生产管理 - 记录详情弹窗
- 其他使用bottom-popup组件的地方

## 修改文件
- `miniprogram/components/bottom-popup/bottom-popup.scss`

## 提交信息
```
fix: 修复任务弹窗被TabBar遮挡的问题

- 调整bottom-popup组件的底部定位，向上偏移TabBar高度
- 使用calc()动态计算弹窗位置和最大高度
- 添加iOS < 11.2的兼容性支持（constant函数）
- 简化内容和按钮区域的padding设置

修复后弹窗完全显示在TabBar之上，所有按钮可正常点击
```

