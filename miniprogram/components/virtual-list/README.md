# 虚拟列表组件使用指南

## 📋 组件介绍
虚拟列表组件用于优化长列表渲染性能，只渲染可视区域内的元素，大幅减少DOM节点数量。

## 🚀 性能优势
- **减少DOM节点**：只渲染可视区域 + 缓冲区的元素
- **流畅滚动**：使用节流优化滚动事件处理
- **内存优化**：减少内存占用，提升页面性能
- **支持大数据量**：可处理上万条数据

## 📦 使用方法

### 1. 引入组件
在页面的 `json` 文件中引入：
```json
{
  "usingComponents": {
    "virtual-list": "/components/virtual-list/virtual-list"
  }
}
```

### 2. 使用组件
在 `wxml` 文件中：
```xml
<virtual-list
  list="{{diagnosisHistory}}"
  item-height="{{120}}"
  height="{{600}}"
  buffer-size="{{5}}"
  enable-pull-refresh="{{true}}"
  enable-load-more="{{true}}"
  bind:refresh="onRefresh"
  bind:loadmore="onLoadMore"
  bind:itemtap="onItemTap"
>
  <!-- 自定义列表项内容 -->
  <view slot="item" class="custom-item">
    <text>{{item.title}}</text>
    <text>{{item.description}}</text>
  </view>
</virtual-list>
```

### 3. 处理事件
在 `ts` 文件中：
```typescript
Page({
  data: {
    diagnosisHistory: []
  },

  onRefresh() {
    // 处理下拉刷新
    this.loadData().then(() => {
      // 停止刷新动画
      const virtualList = this.selectComponent('#virtual-list')
      virtualList.stopRefresh()
    })
  },

  onLoadMore() {
    // 处理上拉加载更多
    this.loadMoreData().then(() => {
      // 停止加载动画
      const virtualList = this.selectComponent('#virtual-list')
      virtualList.stopLoadMore()
    })
  },

  onItemTap(e) {
    const { index, item } = e.detail
    console.log('点击了第', index, '项：', item)
  }
})
```

## 🔧 属性说明

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| list | Array | [] | 列表数据 |
| item-height | Number | 100 | 每项高度（固定高度） |
| height | Number | 600 | 容器高度（像素） |
| buffer-size | Number | 5 | 缓冲区大小（上下各渲染几个额外项） |
| enable-pull-refresh | Boolean | false | 是否开启下拉刷新 |
| enable-load-more | Boolean | false | 是否开启上拉加载 |

## 📢 事件说明

| 事件 | 说明 | 回调参数 |
|------|------|----------|
| refresh | 下拉刷新触发 | - |
| loadmore | 上拉加载触发 | - |
| itemtap | 列表项点击 | {index, item} |
| scroll | 滚动时触发 | {scrollTop, ...} |

## 💡 最佳实践

### 1. 合适的缓冲区
- 建议设置 5-10 的缓冲区
- 太小会频繁更新，太大会失去虚拟列表的优势

### 2. 固定高度
- 目前只支持固定高度的列表项
- 如需动态高度，需要额外计算

### 3. 数据更新
- 更新数据时直接修改 list 属性即可
- 组件会自动重新计算和渲染

### 4. 性能监控
```javascript
// 监控渲染的元素数量
const virtualList = this.selectComponent('#virtual-list')
console.log('可视元素数：', virtualList.data.visibleList.length)
console.log('总元素数：', this.data.diagnosisHistory.length)
```

## 🎯 适用场景
- 健康记录列表
- 诊断历史列表
- 批次任务列表
- 财务记录列表
- 任何超过50条的列表数据

## ⚠️ 注意事项
1. 列表项必须是固定高度
2. 大量数据更新时建议使用 setData 的增量更新
3. 避免在列表项中使用复杂的嵌套结构
