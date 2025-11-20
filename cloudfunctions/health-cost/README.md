# health-cost 云函数

## 功能说明
从 health-management 拆分出来的成本计算模块，负责处理所有健康管理相关的成本计算。

## 支持的 Actions
- `calculate_batch_cost` / `calculateBatchCost` - 计算批次成本
- `calculate_treatment_cost` - 计算治疗成本
- `calculate_batch_treatment_costs` - 计算批次治疗成本
- `calculate_health_rate` - 计算健康率
- `recalculate_death_cost` - 重算死亡成本
- `recalculate_all_death_costs` - 批量重算死亡成本

## 部署步骤

### 1. 安装依赖
```bash
cd cloudfunctions/health-cost
npm install
```

### 2. 上传到云端
在微信开发者工具中：
1. 右键点击 cloudfunctions/health-cost 目录
2. 选择"上传并部署：云端安装依赖"
3. 等待部署完成

### 3. 验证部署
部署完成后，前端调用成本相关功能时会自动路由到新云函数。

## 测试方法
```javascript
// 前端测试代码
wx.cloud.callFunction({
  name: 'health-management',  // 仍然调用原云函数
  data: {
    action: 'calculate_batch_cost',
    batchId: '实际的批次ID'
  }
}).then(res => {
  console.log('成本计算结果:', res.result)
})
```

## 注意事项
1. 前端代码无需修改，health-management 会自动路由
2. 如果新云函数出错，会自动降级到原逻辑
3. 所有返回格式保持 {success: boolean, data/error} 不变

## 性能优势
- 独立部署，不影响其他功能
- 冷启动更快（代码量减少80%）
- 可独立扩容和优化
