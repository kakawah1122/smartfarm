# 鹅数通 UI 设计规范

> 版本：1.0.0  
> 更新时间：2025-10-29  
> 维护者：KAKA

---

## 📐 设计原则

### 1. 简洁优先
- 避免过度装饰性元素
- 保持界面简洁清晰
- 信息层次分明

### 2. 一致性
- 统一的视觉语言
- 统一的交互模式
- 统一的组件使用

### 3. 用户友好
- 直观的操作流程
- 清晰的反馈提示
- 合理的信息密度

---

## 🎨 视觉规范

### 颜色规范

#### 主色调
```scss
$primary-color: #0052d9;      // 主题蓝色
$success-color: #00a870;      // 成功绿色
$warning-color: #ed7b2f;      // 警告橙色
$error-color: #e34d59;        // 错误红色
$info-color: #0052d9;         // 信息蓝色
```

#### 中性色
```scss
$text-primary: #333333;       // 主要文字
$text-secondary: #666666;     // 次要文字
$text-placeholder: #999999;   // 占位符
$text-disabled: #cccccc;      // 禁用文字

$bg-primary: #ffffff;         // 主背景
$bg-secondary: #f5f5f5;       // 次背景
$bg-tertiary: #fafafa;        // 第三背景

$border-color: #e5e5e5;       // 边框颜色
$divider-color: #eeeeee;      // 分割线颜色
```

### 字体规范

#### 字号
```scss
$font-size-xs: 24rpx;         // 极小字号
$font-size-sm: 26rpx;         // 小字号
$font-size-base: 28rpx;       // 基础字号
$font-size-md: 30rpx;         // 中等字号
$font-size-lg: 32rpx;         // 大字号
$font-size-xl: 36rpx;         // 超大字号
$font-size-xxl: 40rpx;        // 特大字号
```

#### 字重
```scss
$font-weight-normal: 400;     // 常规
$font-weight-medium: 500;     // 中等
$font-weight-bold: 600;       // 加粗
```

### 间距规范

```scss
$spacing-xs: 8rpx;            // 极小间距
$spacing-sm: 12rpx;           // 小间距
$spacing-base: 16rpx;         // 基础间距
$spacing-md: 20rpx;           // 中等间距
$spacing-lg: 24rpx;           // 大间距
$spacing-xl: 32rpx;           // 超大间距
$spacing-xxl: 40rpx;          // 特大间距
```

### 圆角规范

```scss
$border-radius-sm: 8rpx;      // 小圆角
$border-radius-base: 12rpx;   // 基础圆角
$border-radius-md: 16rpx;     // 中等圆角
$border-radius-lg: 20rpx;     // 大圆角
$border-radius-full: 9999rpx; // 全圆角
```

---

## ❌ 禁止使用的样式

### 1. 突兀的粗线条 ⛔️

**严格禁止**使用粗边框（border-width > 2rpx）作为装饰性元素，特别是：

```scss
// ❌ 错误示例 - 禁止使用
.card {
  border-left: 4rpx solid #0052d9;    // 突兀的粗竖线
  border-left: 6rpx solid #ed7b2f;    // 更粗的竖线
}

.item {
  border-top: 4rpx solid #00a870;     // 突兀的粗横线
}
```

**原因**：
- ❌ 视觉突兀，破坏整体美感
- ❌ 分散用户注意力
- ❌ 与现代扁平化设计风格不符
- ❌ 在小屏幕上过于显眼

**替代方案**：

```scss
// ✅ 正确示例 1 - 使用背景色区分
.card {
  background: linear-gradient(135deg, #f0f7ff 0%, #e6f0ff 100%);
  // 通过渐变背景营造层次感
}

// ✅ 正确示例 2 - 使用细边框
.card {
  border: 1rpx solid #e5e5e5;
  // 1rpx 的细边框，不突兀
}

// ✅ 正确示例 3 - 使用阴影
.card {
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
  // 柔和的阴影增加层次感
}

// ✅ 正确示例 4 - 使用图标
.card {
  .icon {
    color: #0052d9;
    // 用图标颜色来强调重要性
  }
}
```

### 2. 其他禁止使用的样式

```scss
// ❌ 禁止过度使用文字阴影
.text {
  text-shadow: 2rpx 2rpx 4rpx rgba(0, 0, 0, 0.5);  // 过重
}

// ❌ 禁止使用过于鲜艳的渐变
.button {
  background: linear-gradient(to right, #ff0000, #00ff00, #0000ff);  // 刺眼
}

// ❌ 禁止过度使用动画
.item {
  animation: shake 0.5s infinite;  // 过度使用会干扰用户
}
```

---

## ✅ 推荐的设计模式

### 1. 卡片设计

```scss
// ✅ 标准卡片
.card {
  background: #ffffff;
  border-radius: 12rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

// ✅ 带状态的卡片（通过背景色区分）
.card-success {
  background: linear-gradient(135deg, #f0faf5 0%, #e6f7f0 100%);
  border-radius: 12rpx;
  padding: 24rpx;
}

.card-warning {
  background: linear-gradient(135deg, #fff7e6 0%, #ffe8cc 100%);
  border-radius: 12rpx;
  padding: 24rpx;
}
```

### 2. 列表项设计

```scss
// ✅ 标准列表项
.list-item {
  padding: 24rpx;
  background: #ffffff;
  border-bottom: 1rpx solid #eeeeee;  // 细分割线
  
  &:last-child {
    border-bottom: none;
  }
}
```

### 3. 按钮设计

```scss
// ✅ 主按钮
.button-primary {
  background: #0052d9;
  color: #ffffff;
  border-radius: 8rpx;
  padding: 16rpx 32rpx;
  border: none;  // 无边框
}

// ✅ 次要按钮
.button-secondary {
  background: transparent;
  color: #0052d9;
  border: 1rpx solid #0052d9;  // 细边框
  border-radius: 8rpx;
  padding: 16rpx 32rpx;
}
```

---

## 📱 组件规范

### 1. 状态标识

```scss
// ✅ 使用标签而非粗线条
.status-tag {
  display: inline-block;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  font-size: 24rpx;
  
  &.success {
    background: #e6f7f0;
    color: #00a870;
  }
  
  &.warning {
    background: #fff7e6;
    color: #ed7b2f;
  }
}
```

### 2. 信息卡片

```scss
// ✅ 使用背景色和阴影而非边框
.info-card {
  background: #fafafa;
  border-radius: 12rpx;
  padding: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
```

---

## 🔧 代码审查清单

在提交代码前，请检查：

- [ ] 没有使用粗边框（border-width > 2rpx）
- [ ] 颜色值符合设计规范
- [ ] 间距使用了规范中定义的值
- [ ] 圆角使用了规范中定义的值
- [ ] 没有过度使用动画效果
- [ ] 阴影效果柔和自然
- [ ] 组件样式保持一致性

---

## 📚 参考资源

### 设计参考
- [微信小程序设计指南](https://developers.weixin.qq.com/miniprogram/design/)
- [TDesign 设计规范](https://tdesign.tencent.com/design/)
- [Material Design 3](https://m3.material.io/)

### 工具推荐
- Figma - UI 设计工具
- ColorZilla - 颜色提取工具
- PxCook - 设计稿标注工具

---

## 📝 更新日志

### v1.0.0 (2025-10-29)
- ✅ 初始版本发布
- ✅ 明确禁止使用突兀的粗线条
- ✅ 定义基础设计规范
- ✅ 提供替代方案和示例代码

---

## 💡 建议与反馈

如有设计规范相关的建议或问题，请联系：
- 项目维护者：KAKA
- 更新此文档并提交 PR

---

**记住：简洁、一致、友好是我们的设计原则！**

