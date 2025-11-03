# 使用原生 Picker 替代 TDesign DateTimePicker 示例

## 背景

为了避免 TDesign `t-date-time-picker` 组件的 slot 重复警告，可以使用微信原生的 `picker` 组件。

## 完整示例：entry-form 页面改造

### 1. WXML 文件修改

将 `t-date-time-picker` 替换为原生 `picker`：

#### 修改前：

```xml
<!-- 日期选择器 -->
<t-date-time-picker 
  visible="{{showDate}}"
  mode="date"
  value="{{dateValue}}"
  format="YYYY-MM-DD"
  bind:change="onDateChange"
  bind:cancel="hideDatePicker"
  bind:confirm="onDateConfirm"
/>
```

#### 修改后：

```xml
<!-- 日期选择器 -->
<picker 
  mode="date" 
  value="{{formData.entryDate}}" 
  start="2020-01-01"
  end="{{maxDate}}"
  bind:change="onDateConfirm"
  class="date-picker"
>
  <view class="form-item" hover-class="form-item-hover">
    <view class="item-label required">入栏日期</view>
    <view class="item-input date-input">
      <text class="date-text">{{formData.entryDate || '请选择入栏日期'}}</text>
      <t-icon name="calendar" size="32" color="#c8c9cc" />
    </view>
  </view>
</picker>
```

### 2. TS 文件修改

简化日期相关的逻辑：

#### 修改前的 data：

```typescript
data: {
  formData: { /* ... */ },
  showDate: false,      // 需要控制弹窗显示
  dateValue: '',        // 需要时间戳格式
  // ...
}
```

#### 修改后的 data：

```typescript
data: {
  formData: { /* ... */ },
  maxDate: '',          // 最大日期（今天）
  // ...
  // 移除 showDate 和 dateValue
}
```

#### 修改前的方法：

```typescript
// 显示日期选择器
showDatePicker() {
  this.setData({ showDate: true })
},

// 隐藏日期选择器
hideDatePicker() {
  this.setData({ showDate: false })
},

// 日期选择变化
onDateChange(e: any) {
  const { value } = e.detail
  this.setData({ dateValue: value })
},

// 确认选择日期
onDateConfirm(e: any) {
  const { value } = e.detail
  const date = new Date(value)
  const dateString = this.formatDate(date)
  const batchId = this.generateBatchId(dateString)
  
  this.setData({
    'formData.entryDate': dateString,
    'formData.batchId': batchId,
    dateValue: value,
    showDate: false
  })
}
```

#### 修改后的方法：

```typescript
// 初始化表单
initializeForm() {
  const today = new Date()
  const dateString = this.formatDate(today)
  const batchId = this.generateBatchId(dateString)
  
  this.setData({
    'formData.entryDate': dateString,
    'formData.batchId': batchId,
    maxDate: dateString  // 设置最大日期为今天
  })
},

// 确认选择日期（原生 picker 直接返回格式化的日期字符串）
onDateConfirm(e: any) {
  const dateString = e.detail.value  // 格式：YYYY-MM-DD
  const batchId = this.generateBatchId(dateString)
  
  this.setData({
    'formData.entryDate': dateString,
    'formData.batchId': batchId
  })
}
```

### 3. JSON 文件修改

移除 `t-date-time-picker` 组件引用：

#### 修改前：

```json
{
  "usingComponents": {
    "navigation-bar": "/components/navigation-bar/navigation-bar",
    "bottom-popup": "/components/bottom-popup/bottom-popup",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-input": "tdesign-miniprogram/input/input",
    "t-textarea": "tdesign-miniprogram/textarea/textarea",
    "t-picker": "tdesign-miniprogram/picker/picker",
    "t-date-time-picker": "tdesign-miniprogram/date-time-picker/date-time-picker",
    "t-button": "tdesign-miniprogram/button/button",
    "t-icon": "tdesign-miniprogram/icon/icon"
  },
  "navigationStyle": "custom"
}
```

#### 修改后：

```json
{
  "usingComponents": {
    "navigation-bar": "/components/navigation-bar/navigation-bar",
    "bottom-popup": "/components/bottom-popup/bottom-popup",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-input": "tdesign-miniprogram/input/input",
    "t-textarea": "tdesign-miniprogram/textarea/textarea",
    "t-button": "tdesign-miniprogram/button/button",
    "t-icon": "tdesign-miniprogram/icon/icon"
  },
  "navigationStyle": "custom"
}
```

### 4. SCSS 样式调整（可选）

如果需要调整原生 picker 的样式：

```scss
// 日期选择器样式
.date-picker {
  display: block;
  
  .form-item-hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
}

.date-input {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16rpx;
  
  .date-text {
    font-size: 28rpx;
    color: #333;
    
    &:empty::before {
      content: '请选择入栏日期';
      color: #999;
    }
  }
}
```

## 优势对比

### TDesign DateTimePicker

✅ UI 美观统一  
✅ 功能丰富（时间、日期时间等）  
❌ 有 slot 重复警告  
❌ 包体积较大  

### 原生 Picker

✅ 无警告信息  
✅ 性能更好  
✅ 包体积更小  
✅ 微信官方维护  
❌ UI 相对简单  
❌ 需要自定义样式  

## 实施建议

### 场景一：警告影响开发体验
**建议**：批量替换为原生 picker

受影响的页面：
- entry-form
- exit-form  
- purchase-form
- material-use-form
- feed-usage-form

### 场景二：警告可以接受
**建议**：保持现状，等待 TDesign 官方修复

优点：
- 无需修改代码
- UI 保持一致
- 功能更丰富

## 替换步骤

如果决定替换，按以下步骤进行：

1. **创建备份**
   ```bash
   git checkout -b fix/replace-tdesign-picker
   ```

2. **逐页替换**
   - 先在一个页面测试
   - 确认无问题后批量替换

3. **测试验证**
   - 功能测试：日期选择是否正常
   - 样式测试：UI 是否符合预期
   - 兼容性测试：不同机型是否正常

4. **提交代码**
   ```bash
   git add .
   git commit -m "feat: 使用原生 picker 替代 t-date-time-picker"
   ```

## 总结

- 原生 picker 可以完全替代 t-date-time-picker 的日期选择功能
- 实现更简单，性能更好，无警告
- 需要根据实际情况权衡是否替换

