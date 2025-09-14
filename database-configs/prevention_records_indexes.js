// prevention_records 集合索引配置
// 在微信云开发控制台 -> 数据库 -> 索引 中创建

// 1. 批次查询索引（复合索引）
{
  "batchId": 1,
  "createdAt": -1
}

// 2. 任务关联索引
{
  "vaccination.taskId": 1
}

// 3. 记录类型索引
{
  "recordType": 1,
  "preventionType": 1
}

// 4. 时间范围查询索引
{
  "createdAt": -1
}
