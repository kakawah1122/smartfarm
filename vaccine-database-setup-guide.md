# 疫苗接种功能数据库创建指南

## 🎯 目标
为疫苗接种功能创建必要的数据库集合和权限配置。

## 📋 必需集合
- `prevention_records` - 预防记录
- `finance_records` - 财务记录  
- `overview_stats` - 概览统计

## 🔧 创建步骤

### 步骤 1: 登录微信云开发控制台
1. 访问：https://console.cloud.tencent.com/tcb
2. 选择你的小程序环境
3. 进入"数据库"模块

### 步骤 2: 创建集合
1. 点击"新建集合"
2. 逐个创建以下集合：
   - `prevention_records`
   - `finance_records` 
   - `overview_stats`

### 步骤 3: 配置权限
对每个集合：
1. 点击集合名称进入详情
2. 切换到"权限设置"标签  
3. 复制对应的权限配置代码：
   - `prevention_records`: `database-configs/prevention_records_permissions.json`
   - `finance_records`: `database-configs/finance_records_permissions.json`
   - `overview_stats`: `database-configs/overview_stats_permissions.json`

### 步骤 4: 创建索引
对每个集合：
1. 进入"索引"标签
2. 点击"新建索引"
3. 根据对应的索引配置文件创建索引：
   - `prevention_records`: `database-configs/prevention_records_indexes.js`
   - `finance_records`: `database-configs/finance_records_indexes.js`
   - `overview_stats`: `database-configs/overview_stats_indexes.js`

### 步骤 5: 测试验证
1. 在云函数中部署测试代码：`test-functions/test-vaccine-collections.js`
2. 调用测试云函数验证集合创建成功
3. 检查返回结果确保所有集合都可访问

## ✅ 验证清单
- [ ] prevention_records 集合已创建
- [ ] finance_records 集合已创建  
- [ ] overview_stats 集合已创建
- [ ] 所有集合权限已配置
- [ ] 必要索引已创建
- [ ] 测试验证通过

## 🚨 注意事项
1. 财务记录权限较严格，只有管理员和财务人员可访问
2. 所有记录都需要包含 _openid 字段
3. 建议定期备份重要数据
4. 索引创建可能需要几分钟时间

## 📞 问题排查
如果遇到问题，请检查：
1. 用户角色是否正确配置
2. 权限规则是否正确复制
3. 集合名称是否拼写正确
4. 云函数是否有足够权限
