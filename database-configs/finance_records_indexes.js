// finance_records 集合索引配置
// 在微信云开发控制台 -> 数据库 -> 索引 中创建

// 1. 批次和日期查询索引
{
  "batchId": 1,
  "date": -1
}

// 2. 类型和分类索引
{
  "type": 1,
  "category": 1,
  "date": -1
}

// 3. 关联记录索引
{
  "relatedRecord.recordId": 1
}

// 4. 金额排序索引
{
  "amount": -1,
  "date": -1
}
