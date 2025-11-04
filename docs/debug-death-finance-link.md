# 死亡记录财务关联调试指南

## 问题说明

死亡记录已创建，但未关联到财务损失记录。

## 修复内容

### 1. 添加详细日志
在健康管理云函数中添加了以下日志：

**疫苗追踪死亡**:
- `[疫苗死亡] 准备创建财务记录`
- `[疫苗死亡] 财务记录创建结果`
- `[疫苗死亡] 已更新财务记录ID到死亡记录`
- `[疫苗死亡] 创建财务记录失败` (如果失败)

**标准死亡记录**:
- `[标准死亡] 准备创建财务记录`
- `[标准死亡] 财务记录创建结果`
- `[标准死亡] 已更新财务记录ID到死亡记录`
- `[标准死亡] 创建财务记录失败` (如果失败)

### 2. 自动关联财务记录ID
修改后，创建财务记录成功后会自动更新到死亡记录的 `financialLoss.financeRecordId` 字段。

## 部署步骤

```bash
# 1. 上传健康管理云函数
右键 cloudfunctions/health-management → 上传并部署：云端安装依赖

# 2. 编译小程序
点击"编译"
```

## 测试步骤

### 步骤 1: 创建新的死亡记录

1. 进入疫苗记录详情
2. 点击"记录死亡"
3. 输入数量（如：2）
4. 确认创建

### 步骤 2: 查看云函数日志

1. 打开微信开发者工具
2. 点击"云开发"按钮
3. 进入云函数管理
4. 找到 `health-management` 云函数
5. 点击"日志"标签
6. 查看最新的日志，应该能看到：

```
[疫苗死亡] 准备创建财务记录: {
  deathRecordId: "xxx",
  deathCount: 2,
  unitCost: "10.50",
  totalLoss: "21.00"
}

[疫苗死亡] 财务记录创建结果: {
  success: true,
  data: {
    financeRecordId: "yyy",
    recordId: "DL...",
    amount: "21.00"
  },
  message: "财务损失记录创建成功"
}

[疫苗死亡] 已更新财务记录ID到死亡记录
```

### 步骤 3: 验证数据库

#### 3.1 检查死亡记录

1. 打开云开发控制台
2. 数据库 → `health_death_records` 集合
3. 找到刚创建的记录
4. 检查 `financialLoss` 字段：

```json
{
  "financialLoss": {
    "unitCost": "10.50",
    "totalLoss": "21.00",
    "calculationMethod": "batch_average",
    "financeRecordId": "yyy"  // ✅ 应该有这个字段
  }
}
```

#### 3.2 检查财务记录

1. 数据库 → `finance_cost_records` 集合
2. 找到对应的财务记录
3. 检查字段：

```json
{
  "_id": "yyy",
  "recordId": "DL...",
  "costType": "death_loss",
  "category": "loss",
  "amount": 21.00,
  "details": {
    "deathRecordId": "xxx",
    "deathCount": 2,
    "unitCost": 10.50,
    "deathCause": "疫苗接种后死亡"
  }
}
```

## 常见问题排查

### 问题 1: 日志中显示财务记录创建失败

**查看错误信息**:
```
[疫苗死亡] 创建财务记录失败: Error: xxx
```

**可能原因**:
1. 财务云函数未部署或版本过旧
2. `totalLoss` 参数格式错误（应为字符串）
3. 权限不足

**解决方法**:
```bash
# 重新上传财务云函数
右键 cloudfunctions/finance-management → 上传并部署：云端安装依赖
```

### 问题 2: 财务记录创建成功，但未更新到死亡记录

**检查日志**:
- 如果看到"财务记录创建结果: { success: true }"
- 但没有看到"已更新财务记录ID到死亡记录"

**可能原因**:
- 返回的数据结构不匹配
- 数据库更新权限不足

**解决方法**:
1. 检查云函数日志中的完整返回结果
2. 确认 `financeResult.result.data.financeRecordId` 存在

### 问题 3: 财务记录创建成功，但查询不到

**检查**:
1. 财务记录是否有 `_openid` 字段
2. 财务记录的 `isDeleted` 是否为 `false`
3. 查询条件是否正确

## 手动修复旧记录

如果之前创建的死亡记录没有关联财务记录，可以手动关联：

### 方法 1: 通过控制台

1. 打开云开发控制台
2. 找到 `health_death_records` 集合中的记录
3. 找到 `finance_cost_records` 集合中对应的财务记录（通过 `details.deathRecordId` 匹配）
4. 复制财务记录的 `_id`
5. 更新死亡记录的 `financialLoss.financeRecordId` 字段

### 方法 2: 通过云函数脚本

创建一个临时云函数脚本：

```javascript
// 在云开发控制台 → 云函数 → 新建云函数 → fix-death-finance-link

const cloud = require('wx-server-sdk')
cloud.init()
const db = cloud.database()

exports.main = async (event, context) => {
  // 查询所有没有 financeRecordId 的死亡记录
  const deathRecords = await db.collection('health_death_records')
    .where({
      'financialLoss.financeRecordId': db.command.exists(false)
    })
    .get()
  
  let updatedCount = 0
  
  // 遍历每条记录
  for (const death of deathRecords.data) {
    // 查找对应的财务记录
    const financeRecords = await db.collection('finance_cost_records')
      .where({
        'details.deathRecordId': death._id
      })
      .limit(1)
      .get()
    
    if (financeRecords.data.length > 0) {
      const financeId = financeRecords.data[0]._id
      
      // 更新死亡记录
      await db.collection('health_death_records')
        .doc(death._id)
        .update({
          data: {
            'financialLoss.financeRecordId': financeId
          }
        })
      
      updatedCount++
      console.log(`已关联: 死亡记录 ${death._id} -> 财务记录 ${financeId}`)
    }
  }
  
  return {
    success: true,
    message: `成功关联 ${updatedCount} 条记录`
  }
}
```

运行后删除此云函数。

## 验证修复效果

### 在死亡记录列表页面

1. 进入死亡记录列表
2. 检查统计数据：
   - 累计死亡数 ✅
   - 总损失 ✅ (应显示正确金额)
   - 平均损失 ✅ (应显示正确金额)

3. 点击记录查看详情
4. 财务损失部分应显示：
   - 总损失 ✅
   - 单只损失 ✅

### 在财务管理页面

1. 进入财务管理
2. 查看成本记录
3. 应该能看到对应的死亡损失记录

## 总结

修复后的流程：

```
创建死亡记录
  ↓
保存到数据库 (获得 deathRecordId)
  ↓
调用财务云函数 (createDeathLoss)
  ↓
创建财务记录 (获得 financeRecordId)
  ↓
更新死亡记录的 financialLoss.financeRecordId
  ↓
完成关联 ✅
```

如果仍有问题，请查看云函数日志获取详细错误信息。

