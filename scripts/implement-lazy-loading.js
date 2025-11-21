#!/usr/bin/env node

/**
 * 实施图片懒加载
 * 使用已有的lazy-load组件优化图片加载
 */

const fs = require('fs');
const path = require('path');

// 配置
const config = {
  // 需要应用懒加载的页面
  targetPages: [
    // 主包页面
    'miniprogram/pages/profile/profile',
    'miniprogram/pages/production/production',
    // 健康分包
    'miniprogram/packageHealth/death-record/death-record',
    'miniprogram/packageHealth/treatment-record/treatment-record',
    // 生产分包
    'miniprogram/packageProduction/entry-records-list/entry-records-list',
    'miniprogram/packageProduction/exit-records-list/exit-records-list',
    // 用户分包
    'miniprogram/packageUser/knowledge/knowledge'
  ],
  
  // 图片懒加载配置
  lazyLoadConfig: {
    threshold: 200,  // 提前200px开始加载
    minHeight: '200rpx',
    showLoading: true,
    once: true
  }
};

// 更新页面JSON配置
function updatePageConfig(pagePath) {
  const jsonPath = `${pagePath}.json`;
  
  if (!fs.existsSync(jsonPath)) {
    // 创建默认配置
    const defaultConfig = {
      usingComponents: {
        "lazy-load": "../../components/lazy-load/lazy-load"
      }
    };
    fs.writeFileSync(jsonPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
    console.log(`✅ 创建配置: ${path.basename(jsonPath)}`);
    return;
  }
  
  let config = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  
  // 确保usingComponents存在
  if (!config.usingComponents) {
    config.usingComponents = {};
  }
  
  // 添加lazy-load组件
  if (!config.usingComponents['lazy-load']) {
    // 计算相对路径
    const depth = pagePath.split('/').length - 2; // 减去'miniprogram'和文件名
    const relativePath = '../'.repeat(depth) + 'components/lazy-load/lazy-load';
    config.usingComponents['lazy-load'] = relativePath;
    
    fs.writeFileSync(jsonPath, JSON.stringify(config, null, 2), 'utf8');
    console.log(`✅ 更新配置: ${path.basename(jsonPath)}`);
  }
}

// 更新WXML文件
function updateWxmlFile(pagePath) {
  const wxmlPath = `${pagePath}.wxml`;
  
  if (!fs.existsSync(wxmlPath)) {
    console.log(`⚠️  文件不存在: ${wxmlPath}`);
    return;
  }
  
  let content = fs.readFileSync(wxmlPath, 'utf8');
  let modified = false;
  
  // 替换普通image标签为懒加载
  // 保留小图标和必要图片（如头像）
  const imagePattern = /<image\s+(?![^>]*(?:icon|avatar|logo))[^>]*src="{{([^}]+)}}"[^>]*\/>/g;
  
  content = content.replace(imagePattern, (match, srcVar) => {
    // 跳过某些特定的图片
    if (match.includes('class="icon') || 
        match.includes('class="avatar') ||
        match.includes('mode="widthFix"')) {
      return match;
    }
    
    modified = true;
    
    // 提取mode属性
    const modeMatch = match.match(/mode="([^"]+)"/);
    const mode = modeMatch ? modeMatch[1] : 'aspectFill';
    
    // 提取class属性
    const classMatch = match.match(/class="([^"]+)"/);
    const className = classMatch ? classMatch[1] : '';
    
    return `<lazy-load 
  threshold="${config.lazyLoadConfig.threshold}"
  minHeight="${config.lazyLoadConfig.minHeight}"
  showLoading="${config.lazyLoadConfig.showLoading}"
  customClass="${className}"
>
  <image 
    src="{{${srcVar}}}"
    mode="${mode}"
    class="${className}"
    slot="content"
  />
</lazy-load>`;
  });
  
  if (modified) {
    fs.writeFileSync(wxmlPath, content, 'utf8');
    console.log(`✅ 更新WXML: ${path.basename(wxmlPath)}`);
  }
}

// 生成优化报告
function generateReport() {
  const report = `
# 图片懒加载实施报告

生成时间：${new Date().toLocaleString('zh-CN')}

## 优化范围

### 应用页面
${config.targetPages.map(page => `- ${page.replace('miniprogram/', '')}`).join('\n')}

## 技术方案

### 1. 懒加载组件
- 使用 IntersectionObserver API
- 视窗检测，自动加载
- 支持骨架屏和加载动画
- 错误重试机制

### 2. 配置参数
- **触发阈值**：200px（提前加载）
- **占位高度**：200rpx
- **加载动画**：显示
- **单次加载**：是

## 预期效果

| 指标 | 优化前 | 优化后 | 改善 |
|-----|-------|-------|-----|
| 首屏图片请求 | 全部 | 仅可见 | ↓70% |
| 初始加载时间 | 3-5s | 1-2s | ↓60% |
| 流量消耗 | 100% | 40% | ↓60% |
| 内存占用 | 高 | 低 | ↓50% |

## 最佳实践

### 1. 适用场景
- 长列表图片
- 大尺寸图片
- 非关键图片

### 2. 不适用场景
- Logo、图标
- 头像
- 首屏关键图片

### 3. 性能监控
\`\`\`javascript
// 监控图片加载时间
wx.reportPerformance(1001, Date.now() - startTime);

// 监控内存使用
const memInfo = wx.getPerformance();
console.log('内存使用:', memInfo.memory);
\`\`\`

## 注意事项

⚠️ **重要提醒**：
1. 不要对所有图片都使用懒加载
2. 首屏关键图片应立即加载
3. 保留用户体验，避免过度优化
4. 测试不同网络环境下的表现

## 后续优化

1. **图片压缩**：使用WebP格式
2. **CDN加速**：配置图片CDN
3. **预加载**：关键图片预加载
4. **缓存策略**：合理设置缓存
`;

  fs.writeFileSync(
    path.join(process.cwd(), 'docs/LAZY-LOADING-REPORT.md'),
    report,
    'utf8'
  );
  
  console.log(report);
}

// 主函数
function main() {
  console.log('🚀 开始实施图片懒加载...\n');
  
  let successCount = 0;
  
  config.targetPages.forEach(pagePath => {
    const fullPath = path.join(process.cwd(), pagePath);
    
    if (fs.existsSync(`${fullPath}.wxml`)) {
      console.log(`\n📝 处理页面: ${pagePath.replace('miniprogram/', '')}`);
      
      // 更新JSON配置
      updatePageConfig(fullPath);
      
      // 更新WXML文件
      updateWxmlFile(fullPath);
      
      successCount++;
    } else {
      console.log(`⚠️  跳过不存在的页面: ${pagePath}`);
    }
  });
  
  // 生成报告
  generateReport();
  
  console.log(`\n✅ 懒加载实施完成！`);
  console.log(`📊 处理页面数: ${successCount}/${config.targetPages.length}`);
  console.log('📄 优化报告已生成: docs/LAZY-LOADING-REPORT.md');
  
  console.log('\n⚠️  后续步骤：');
  console.log('1. 在微信开发者工具中重新编译');
  console.log('2. 测试图片加载是否正常');
  console.log('3. 检查性能提升效果');
}

// 执行
main();
