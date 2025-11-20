# 资源与字段 Schema 优化规划

## 1. 资源与分包策略

- **主包目标**：≤1.5MB，主包仅包含首页、生产、健康、个人页以及共用组件
- **大文件迁移**：所有 >100KB 的图片转存云/CDN 或移至分包按需加载
- **分包预下载**：保持 health/production/finance 分包预加载，评估是否对 user 分包启用按需预下载
- **静态资源治理**：
  1. 运行 `scripts/optimize-images.sh` 压缩 `assets/icons` 及其他位图
  2. 建立资源白名单，确保主包仅引用必要图标
  3. 优先使用 SVG/iconfont 替代位图

## 2. 字段 Schema 统一

- **集中定义**：在 `typings/types/` 下新增 `health-schema.d.ts`、`finance-schema.d.ts`，统一定义 costInfo、preventionRecord、treatmentRecord 等实体
- **云函数共享**：云函数通过 `require('../shared-schema/xxx')` 或 TS 引用复用同一结构，避免字段拼写不一致
- **关键字段检查**：
  - `_openid`、`userId`、`shouldSyncToFinance` 等标志必须在云函数层补齐
  - 金额、数量字段统一 `Number()` 转换后存储
  - `is_deleted`/`isDeleted` 命名统一且查询时带上过滤条件
- **自动校验**：编写脚本扫描集合文档，检测缺失字段或类型异常，输出报告

## 3. 执行路线

1. 建立字段 Schema 文件，并更新云函数/前端 import
2. 运行资源压缩脚本 + 清理未用图片
3. 重新评估主包与分包体积，确保符合微信限制
4. 在 CI/脚本中集成字段校验与资源体积检测
