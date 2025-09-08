# 跨平台兼容性指南

## 真机调试与兼容性检查清单

### 1. 样式兼容性 ✅
- [x] 1px边框问题修复 - 使用2rpx替代1px确保iOS显示正常
- [x] 统一按钮样式 - 使用TDesign变量和标准化class名
- [x] 色彩主题一致性 - 全局现代蓝色主题
- [x] 动画性能优化 - 添加硬件加速和GPU优化

### 2. 布局兼容性 ✅
- [x] 安全区域适配 - 使用safe-area-inset-*
- [x] 响应式设计 - 支持不同屏幕尺寸
- [x] 导航栏兼容 - 自定义导航栏适配

### 3. 交互兼容性
- [x] 按钮反馈 - 统一的按压效果
- [x] 滚动性能 - 优化长列表滚动
- [x] 过渡动画 - 流畅的页面切换

### 4. 真机测试建议

#### iOS设备测试重点
1. 检查1px边框显示是否正常
2. 验证安全区域适配（刘海屏、药丸屏）
3. 测试动画性能是否流畅
4. 确认字体渲染清晰度

#### Android设备测试重点
1. 不同厂商ROM兼容性
2. 状态栏高度适配
3. 返回键交互逻辑
4. 低端设备性能表现

### 5. 性能优化
- [x] 启用硬件加速动画
- [x] 优化图片资源加载
- [x] 减少重绘和回流
- [x] 使用transform3d优化动画

### 6. 开发工具设置
- 开启真机调试2.0
- 使用不同机型模拟器测试
- 启用性能监控工具
- 定期清理缓存

### 7. 常见兼容性问题解决方案

#### 按钮样式不一致
```scss
// ❌ 错误写法
.button {
  border: 1px solid #ccc;
  transition: all 0.3s;
}

// ✅ 正确写法  
.t-button.primary-button {
  border: var(--td-border-level-1-color, 2rpx solid #ccc);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
  transform: translate3d(0, 0, 0);
}
```

#### 动画卡顿优化
```scss
// ❌ 可能卡顿
.animation {
  transition: all 0.3s;
}

// ✅ 硬件加速优化
.animation {
  will-change: transform;
  backface-visibility: hidden;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

## 发布前检查清单
- [ ] 在iOS和Android真机上测试所有核心功能
- [ ] 验证不同屏幕尺寸下的显示效果
- [ ] 检查网络环境切换的兼容性
- [ ] 确认所有按钮和交互响应正常
- [ ] 测试应用在后台恢复时的状态保持

