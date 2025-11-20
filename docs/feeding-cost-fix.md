# 饲养成本数据修复说明

## 问题描述
- **全部批次**：饲养成本显示正确（¥1800）
- **单批次（QY-20251118）**：饲养成本显示为 ¥0

## 问题原因分析

1. **API参数差异**
   - 全部批次模式：只需传递 `batchId: 'all'`
   - 单批次模式：需要同时传递 `batchId` 和 `batchNumber`

2. **数据返回格式不同**
   - API在不同模式下可能返回不同的数据结构
   - 需要尝试多种数据路径获取成本值

## 修复方案

### 1. 优化请求参数构建
```javascript
const feedCostParams = {
  action: 'get_cost_stats',
  dateRange: this.data.dateRange
}

if (isAllBatches) {
  feedCostParams.batchId = 'all'
} else {
  feedCostParams.batchId = batchId
  feedCostParams.batchNumber = this.data.currentBatchNumber
}
```

### 2. 多路径数据提取
```javascript
feedingCost = feedCostResult.data?.feedCost || 
             feedCostResult.data?.feedingCost || 
             feedCostResult.data?.totalFeedCost ||
             feedCostResult.data?.materialCost || 
             feedCostResult.data?.total || 0
```

### 3. 添加调试日志
```javascript
console.log('[饲养成本] 批次模式:', isAllBatches ? '全部' : '单批次')
console.log('[饲养成本] 批次ID:', batchId)
console.log('[饲养成本] 批次编号:', this.data.currentBatchNumber)
console.log('[饲养成本] API返回数据:', feedCostResult.data)
```

## 测试步骤

1. **打开开发者工具控制台**
2. **切换到"效果分析"标签页**
3. **查看控制台输出**：
   - 检查请求参数是否正确
   - 查看API返回的数据结构
   - 确认数据提取路径

4. **验证修复效果**：
   - 全部批次模式：饲养成本应显示 ¥1800
   - 单批次模式：饲养成本应显示正确金额

## 后续优化建议

1. **统一API响应格式**
   - 财务管理API在全部批次和单批次模式下应返回相同的数据结构
   - 避免前端需要多路径尝试

2. **添加错误处理**
   - 当成本数据获取失败时，显示"-"或"暂无数据"
   - 避免显示 ¥0 造成误解

3. **缓存优化**
   - 成本数据可以缓存一段时间
   - 减少重复的API调用

## 相关文件
- `/miniprogram/pages/health/health.ts` - 第1698-1764行
- `/cloudfunctions/finance-management/index.js` - get_cost_stats 方法
