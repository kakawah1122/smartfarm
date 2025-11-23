# 混合内联样式分析报告

生成时间: 11/23/2025, 11:11:11 AM

## 📊 分析统计

- 分析样式数: 9
- 可提取静态部分: 0
- 条件样式: 1
- 完全动态: 8

## 🎯 优化机会

### 1. 可提取静态部分（0个）

这些样式包含静态部分，可以提取到CSS类中：


### 2. 条件样式（1个）

这些使用条件表达式的样式，建议改用条件class绑定：


#### 1. treatment-records.wxml
- 原始样式: `padding-bottom: {{showTabBar ? 120 : 0}}rpx`
- 建议: 使用条件class绑定

### 3. 完全动态（8个）

这些样式完全动态，建议保留：

- form-item.wxml: `width: {{labelWidth}}`
- form-item.wxml: `text-align: {{contentAlign}}`
- lazy-load.wxml: `min-height: {{minHeight}}`
- loading-animation.wxml: `width: {{progress}}%`
- navigation-bar.wxml: `padding-top: {{statusBarHeight}}px`
- role-migration.wxml: `background-color: {{getRoleColor(role)}}20; color: {{getRoleColor(role)}}`
- notification-settings.wxml: `padding-top: {{totalNavHeight}}rpx`
- weather-detail.wxml: `left: {{airData.progress}}%;`

## 💡 优化建议

### 优先级1：提取静态部分
对于包含静态部分的混合样式，可以：
1. 将静态部分提取到CSS类
2. 只保留动态部分在style属性中
3. 同时使用class和style

### 优先级2：改用class绑定
对于条件样式，建议：
1. 定义不同状态的CSS类
2. 使用条件表达式切换class
3. 避免在style中使用三元运算符

### 示例：
```html
<!-- 优化前 -->
<view style="padding: 20rpx; background-color: {{color}}; margin: {{show ? '10rpx' : '0'}}">

<!-- 优化后 -->
<view class="item-container {{show ? 'with-margin' : ''}}" style="background-color: {{color}}">
```

## 📋 行动计划

1. 优先处理可提取静态部分的样式
2. 创建对应的CSS类
3. 修改模板文件
4. 测试功能正常性
