# 个人中心UI优化说明

## 修改日期
2025年11月6日

## 问题描述
根据用户提供的原型图反馈:
1. 个人信息卡片被导航栏遮挡
2. 养殖场概况超出卡片安全边距,需要采用四宫格彩色卡片
3. 图二下方的表单不应在个人中心直接展示,应点击功能按钮后以弹窗形式弹出

## 修改内容

### 1. 修复个人信息卡片被导航栏遮挡 ✅
**文件**: `miniprogram/pages/profile/profile.scss`

**修改位置**: 第15-22行

**修改前**:
```scss
.profile-card {
  background: linear-gradient(135deg, #0052d9 0%, #0099ff 100%);
  margin: -80rpx 32rpx 32rpx;  // ❌ 负边距导致被导航栏遮挡
  border-radius: 32rpx;
  padding: 48rpx;
  color: white;
  box-shadow: 0 8rpx 24rpx rgba(0, 82, 217, 0.2);
}
```

**修改后**:
```scss
.profile-card {
  background: linear-gradient(135deg, #0052d9 0%, #0099ff 100%);
  margin: 32rpx 32rpx 32rpx;  // ✅ 移除负边距,避免被导航栏遮挡
  border-radius: 32rpx;
  padding: 48rpx;
  color: white;
  box-shadow: 0 8rpx 24rpx rgba(0, 82, 217, 0.2);
}
```

### 2. 养殖场概况改为四宫格彩色卡片 ✅
**文件**: `miniprogram/pages/profile/profile.scss`

**修改位置**: 第156-216行

**修改内容**:
1. 将四宫格布局从 4列 改为 2列2行布局
2. 为四个卡片分别添加不同的渐变背景色:
   - 第1个(当前存栏): 蓝色渐变 `#0052d9 -> #0066ff`
   - 第2个(存活率): 绿色渐变 `#00a870 -> #00d68f`
   - 第3个(健康数量): 青色渐变 `#029cd4 -> #00bfff`
   - 第4个(低库存): 橙色渐变 `#ed7b2f -> #ff9a4a`
3. 添加卡片阴影效果,增强视觉层次
4. 将文字颜色改为白色,提高可读性

**修改后效果**:
```scss
.stats-grid-4 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);  // ✅ 2列布局
  gap: 24rpx;
  margin-bottom: 24rpx;
}

.stat-item {
  text-align: center;
  padding: 32rpx 24rpx;
  background: #fafbfc;
  border-radius: 16rpx;
  border: 1px solid #f0f0f0;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
  
  // ✅ 第一个卡片 - 蓝色
  &:nth-child(1) {
    background: linear-gradient(135deg, #0052d9 0%, #0066ff 100%);
    border: none;
    box-shadow: 0 4rpx 16rpx rgba(0, 82, 217, 0.3);
    .stat-value, .stat-label, .stat-trend {
      color: white !important;
      opacity: 1;
    }
  }
  
  // ✅ 第二个卡片 - 绿色
  &:nth-child(2) {
    background: linear-gradient(135deg, #00a870 0%, #00d68f 100%);
    border: none;
    box-shadow: 0 4rpx 16rpx rgba(0, 168, 112, 0.3);
    .stat-value, .stat-label, .stat-trend {
      color: white !important;
      opacity: 1;
    }
  }
  
  // ✅ 第三个卡片 - 青色
  &:nth-child(3) {
    background: linear-gradient(135deg, #029cd4 0%, #00bfff 100%);
    border: none;
    box-shadow: 0 4rpx 16rpx rgba(2, 156, 212, 0.3);
    .stat-value, .stat-label, .stat-trend {
      color: white !important;
      opacity: 1;
    }
  }
  
  // ✅ 第四个卡片 - 橙色
  &:nth-child(4) {
    background: linear-gradient(135deg, #ed7b2f 0%, #ff9a4a 100%);
    border: none;
    box-shadow: 0 4rpx 16rpx rgba(237, 123, 47, 0.3);
    .stat-value, .stat-label, .stat-trend {
      color: white !important;
      opacity: 1;
    }
  }
}
```

### 3. 表单弹窗形式确认 ✅
**文件**: `miniprogram/pages/profile/profile.wxml`

**确认内容**:
- 报销申请表单已经是弹窗形式(第324-415行)
- 使用 `<t-dialog>` 组件实现弹窗
- 通过 `showReimbursementDialog` 控制显示/隐藏
- 点击"+ 新建报销申请"按钮后才弹出(第99-101行)

**弹窗触发代码**:
```xml
<button class="btn-primary" bind:tap="createReimbursement">
  + 新建报销申请
</button>
```

## 修改后的效果

### 视觉效果
1. ✅ 个人信息卡片不再被导航栏遮挡,完整显示
2. ✅ 养殖场概况采用2x2四宫格彩色卡片布局
3. ✅ 每个统计卡片有独特的渐变色背景和阴影
4. ✅ 文字在彩色背景上清晰可读(白色文字)
5. ✅ 报销表单仅在点击按钮后以弹窗形式显示

### 布局优化
- 个人信息卡片与导航栏保持安全距离
- 四宫格卡片在卡片内部保持合理边距
- 整体视觉层次更加清晰

## 相关文件
- `miniprogram/pages/profile/profile.scss` - 样式文件(已修改)
- `miniprogram/pages/profile/profile.wxml` - 页面结构(无需修改)
- `miniprogram/pages/profile/profile.ts` - 页面逻辑(无需修改)

## 测试建议
1. 在不同屏幕尺寸的设备上测试个人信息卡片是否正常显示
2. 验证四宫格彩色卡片在不同设备上的显示效果
3. 确认报销申请弹窗的交互流程是否正常
4. 检查文字在彩色背景上的可读性

## 注意事项
- 修改使用了 SCSS 嵌套语法和伪类选择器
- 确保小程序开发工具已开启 SCSS 编译支持
- 彩色卡片的颜色方案符合设计规范,与个人信息卡片的蓝色系保持协调

