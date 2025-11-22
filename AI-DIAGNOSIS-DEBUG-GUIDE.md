# AI诊断页面调试指南

## 问题现状
- 真机显示不全
- 和开发者工具显示不一致
- 真机调试控制台没有日志

---

## 🔍 已添加的调试功能

### 1. Console日志
已将所有logger.info改为console.log，确保真机能看到：

```javascript
[AI诊断] onLoad开始
[AI诊断] 加载批次列表成功
[AI诊断] 批次数据已设置
[AI诊断] onShow - 当前数据状态
[AI诊断] 批次选择器变化
[AI诊断] 批次数据已更新
```

### 2. Toast提示
在批次数据设置成功后会显示：
```
已选择批次 2025-001
```

### 3. 错误提示
如果加载失败会弹窗显示具体错误信息。

---

## 📱 真机调试步骤

### 步骤1：打开真机调试控制台

1. 在微信开发者工具中，点击顶部"真机调试"按钮
2. 扫码在手机上打开小程序
3. 在开发者工具中，确保"Console"标签页已打开
4. 确保右上角的"筛选"没有过滤掉log级别的日志

### 步骤2：重新编译并打开AI诊断页面

1. 在开发者工具中点击"编译"按钮
2. 在手机上打开AI智能诊断页面
3. **观察以下内容**：

#### 应该看到的日志（按顺序）
```
[AI诊断] onLoad开始 {recordId: undefined}
[AI诊断] 加载批次列表成功 {totalBatches: 3, selectedIndex: 0, selectedBatch: {...}}
[AI诊断] 批次数据已设置 {selectedBatchId: "xxx", selectedBatchNumber: "2025-001", dayAge: 15}
[AI诊断] onShow - 当前数据状态 {selectedBatchId: "xxx", selectedBatchNumber: "2025-001", ...}
```

#### 应该看到的界面
- ✅ 批次选择下拉框，显示当前批次号
- ✅ 诊断类型（病鹅诊断/死因剖析）
- ✅ **鹅只日龄**（如：15天）
- ✅ **受影响数量**输入框（病鹅诊断模式）
- ✅ 症状描述文本框
- ✅ 上传图片按钮

#### 应该看到的Toast
- 页面加载后会短暂显示："已选择批次 2025-001"

---

## 🔧 可能的问题和解决方案

### 问题1：控制台完全没有日志

**可能原因**：
1. 真机调试未正确连接
2. 控制台被筛选了

**解决方案**：
1. 重新点击"真机调试"，重新扫码
2. 检查控制台右上角筛选器，确保显示"全部"或"log"级别
3. 尝试在控制台输入：`console.log('测试')`，看是否显示

### 问题2：看到日志但字段不显示

**检查点A：selectedBatchId是否有值**
```
[AI诊断] 批次数据已设置 {
  selectedBatchId: "xxx",  ← 这里必须有值，不能是空字符串
  selectedBatchNumber: "2025-001",
  dayAge: 15
}
```

如果selectedBatchId是空字符串''，说明：
- 批次数据没有_id字段
- 或者云函数返回的数据格式不对

**检查点B：WXML条件判断**
```xml
<view wx:if="{{selectedBatchId && selectedBatchId !== ''}}">
  <text>鹅只日龄</text>
  <text>{{dayAge}}</text>
</view>
```

如果selectedBatchId有值但字段还是不显示，说明：
- WXML渲染有问题
- 可能是其他样式问题导致字段被隐藏

### 问题3：开发者工具正常，真机异常

**检查点C：批次数据格式**
在真机控制台查看：
```
[AI诊断] 加载批次列表成功 {
  totalBatches: 3,
  selectedIndex: 0,
  selectedBatch: {
    _id: "xxx",           ← 必须有值
    batchNumber: "2025-001",  ← 必须有值
    dayAge: 15           ← 必须有值
  }
}
```

如果selectedBatch中任何一个字段是undefined，说明：
- 云函数返回的批次数据不完整
- 需要检查production-entry云函数的getActiveBatches方法

### 问题4：看到错误提示

如果页面弹窗显示"加载失败"，并且有具体错误信息，说明：
- 云函数调用失败
- 查看错误信息确定原因

---

## 🧪 手动测试方法

### 方法1：在真机控制台手动检查数据

在真机调试控制台输入：
```javascript
// 获取当前页面实例
var pages = getCurrentPages()
var currentPage = pages[pages.length - 1]

// 检查数据
console.log('selectedBatchId:', currentPage.data.selectedBatchId)
console.log('selectedBatchNumber:', currentPage.data.selectedBatchNumber)
console.log('dayAge:', currentPage.data.dayAge)
console.log('availableBatches:', currentPage.data.availableBatches)
```

### 方法2：手动触发loadBatchList

在真机调试控制台输入：
```javascript
var pages = getCurrentPages()
var currentPage = pages[pages.length - 1]
currentPage.loadBatchList()
```

观察是否有新的日志输出。

### 方法3：手动设置数据

在真机调试控制台输入：
```javascript
var pages = getCurrentPages()
var currentPage = pages[pages.length - 1]

currentPage.setData({
  selectedBatchId: 'test123',
  selectedBatchNumber: '测试批次',
  dayAge: 20
}, () => {
  console.log('手动设置数据成功:', currentPage.data)
})
```

如果手动设置后字段显示了，说明：
- WXML和逻辑没问题
- 问题在于loadBatchList没有正确设置数据

---

## 🎯 重点检查项

### 必须确认的3个关键点

#### 1. 批次数据是否加载成功
```
✅ 日志：[AI诊断] 加载批次列表成功
✅ Toast：已选择批次 xxx
✅ selectedBatch有_id、batchNumber、dayAge
```

#### 2. 数据是否正确设置
```
✅ 日志：[AI诊断] 批次数据已设置
✅ selectedBatchId有值（不是空字符串）
✅ dayAge > 0
```

#### 3. 页面状态是否正确
```
✅ 日志：[AI诊断] onShow - 当前数据状态
✅ 所有字段都有正确的值
```

---

## 📊 对比开发者工具和真机

| 检查项 | 开发者工具 | 真机 | 说明 |
|--------|-----------|------|------|
| Console日志 | 应该有 | 应该有 | 如果真机没有，检查调试连接 |
| Toast提示 | 应该显示 | 应该显示 | 如果真机没有，说明setData回调没执行 |
| selectedBatchId | 有值 | 有值 | 如果真机没有，说明数据设置失败 |
| 日龄字段显示 | 显示 | 显示 | 如果真机不显示，检查wx:if条件 |

---

## 🔄 快速验证流程

1. **重新编译** → 确保最新代码已部署
2. **打开AI诊断页面** → 观察是否有Toast提示
3. **查看控制台** → 确认是否有"[AI诊断]"开头的日志
4. **检查日志内容** → 确认selectedBatchId是否有值
5. **检查页面显示** → 确认日龄字段是否显示

---

## 💡 预期结果

### 成功的表现
```
✅ 控制台有完整的日志链
✅ Toast提示"已选择批次 xxx"
✅ 页面显示所有字段
✅ 开发者工具和真机显示一致
```

### 失败的表现
```
❌ 控制台没有日志
❌ 没有Toast提示
❌ selectedBatchId是空字符串或undefined
❌ 日龄字段不显示
```

---

## 🆘 如果还是不行

### 采集以下信息提供给我

1. **控制台截图**
   - 包含所有"[AI诊断]"开头的日志
   - 或者截图显示"没有日志"

2. **页面截图**
   - 显示缺失哪些字段

3. **手动检查数据的结果**
   - 执行上面"方法1"的代码
   - 截图console输出

4. **云函数日志**
   - 进入微信云开发控制台
   - 查看production-entry云函数的日志
   - 确认getActiveBatches是否被调用
   - 确认返回了什么数据

---

**最后更新**：2025-11-22 22:10
**调试版本**：ef25484
