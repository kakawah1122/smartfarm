# TDesign Picker Slot 重复警告问题说明

## 问题描述

在使用 TDesign 的 `t-date-time-picker` 组件时，控制台会出现大量的 slot 重复警告：

```
[Component] More than one slot named "label-suffix--X" are found inside a single component instance 
(in component "miniprogram_npm/tdesign-miniprogram/picker-item/picker-item"). 
The first one was accepted.
```

## 问题原因

这是 TDesign 小程序组件库的一个已知问题：

1. `t-date-time-picker` 内部使用 `picker-item` 组件来渲染每个选项
2. 当渲染多个选项时（如日期选择器的年月日），`picker-item` 组件会为每个选项生成 slot
3. 由于组件内部的 slot 命名机制问题，导致 slot 名称重复
4. 微信小程序框架检测到重复的 slot 名称，产生警告

## 影响范围

- ⚠️ **不影响功能**：这些警告不会影响日期选择器的正常使用
- ⚠️ **不影响性能**：只是控制台警告，不会造成性能问题
- ⚠️ **影响体验**：大量的警告信息会淹没其他重要的日志

## 解决方案

### 方案一：忽略警告（推荐）

由于这些警告不影响功能，可以暂时忽略：

- 在开发时关注其他真正的错误和警告
- 等待 TDesign 官方修复此问题
- 当前使用的版本：`tdesign-miniprogram@1.11.0`

### 方案二：使用原生 picker 替代（可选）

如果警告信息影响开发体验，可以使用微信原生的 `picker` 组件：

#### 替换前（TDesign）：

```xml
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

#### 替换后（原生）：

```xml
<picker 
  mode="date" 
  value="{{dateValue}}" 
  bind:change="onDateConfirm"
>
  <view class="picker-trigger">
    <text>{{formData.entryDate || '请选择入栏日期'}}</text>
  </view>
</picker>
```

对应的 TS 代码调整：

```typescript
// 确认选择日期
onDateConfirm(e: any) {
  const { value } = e.detail  // 原生 picker 返回的是字符串格式 "YYYY-MM-DD"
  const batchId = this.generateBatchId(value)
  
  this.setData({
    'formData.entryDate': value,
    'formData.batchId': batchId
  })
}
```

### 方案三：等待官方修复

关注 TDesign 官方更新：

- GitHub: https://github.com/Tencent/tdesign-miniprogram
- 文档: https://tdesign.tencent.com/miniprogram/
- 定期检查是否有新版本修复此问题

## 受影响的页面

当前项目中使用 `t-date-time-picker` 的页面：

1. `entry-form` - 入栏记录表单
2. `exit-form` - 出栏记录表单
3. `purchase-form` - 物资采购表单
4. `material-use-form` - 物资使用表单
5. `feed-usage-form` - 饲料使用表单

## 相关脚本

已创建修复检查脚本：`scripts/fix-tdesign-picker-slot.sh`

运行方式：
```bash
./scripts/fix-tdesign-picker-slot.sh
```

## 总结

- ✅ 这是 TDesign 组件库的已知问题
- ✅ 不影响功能和性能
- ✅ 可以安全忽略这些警告
- ✅ 如需彻底解决，可使用原生 picker 组件

## 更新日志

- 2025-11-03: 创建文档，说明问题和解决方案

