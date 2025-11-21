#!/usr/bin/env node

/**
 * 执行CSS清理
 * 安全地删除未使用的CSS类
 */

const fs = require('fs');
const path = require('path');

// 配置
const config = {
  backupDir: path.join(process.cwd(), 'backups', `css-cleanup-${Date.now()}`),
  dryRun: true,  // 默认只是预览，不实际删除
  safeMode: true, // 安全模式：保留可能动态使用的类
  batchSize: 50  // 每批处理的类数量
};

// 统计信息
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  classesRemoved: 0,
  classesSkipped: 0,
  errors: []
};

// 安全类列表（这些类可能通过动态方式使用）
const safeClasses = new Set([
  'active',
  'selected',
  'disabled',
  'loading',
  'error',
  'success',
  'hidden',
  'visible',
  'show',
  'hide',
  'open',
  'close',
  'expanded',
  'collapsed'
]);

// 读取未使用的CSS类列表
function loadUnusedClasses() {
  const reportPath = path.join(process.cwd(), 'docs/UNUSED-CSS-REPORT.md');
  if (!fs.existsSync(reportPath)) {
    throw new Error('未找到CSS清理报告，请先运行 node scripts/clean-unused-css.js');
  }
  
  const content = fs.readFileSync(reportPath, 'utf8');
  const classes = [];
  
  // 提取类名列表
  const lines = content.split('\n');
  let inList = false;
  
  for (const line of lines) {
    if (line.includes('## 未使用的CSS类列表')) {
      inList = true;
      continue;
    }
    
    if (inList && line.startsWith('- ')) {
      const className = line.substring(2).trim();
      if (className && !safeClasses.has(className)) {
        classes.push(className);
      } else if (safeClasses.has(className)) {
        stats.classesSkipped++;
      }
    }
    
    if (inList && line.startsWith('...')) {
      break;
    }
  }
  
  return classes;
}

// 创建备份
function createBackup(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  const backupPath = path.join(config.backupDir, relativePath);
  
  // 创建备份目录
  const backupDir = path.dirname(backupPath);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  // 复制文件
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

// 从CSS文件中删除类
function removeClassFromCSS(content, className) {
  // 匹配完整的CSS规则
  const patterns = [
    // 单独的类选择器
    new RegExp(`\\.${className}\\s*\\{[^}]*\\}`, 'g'),
    // 组合选择器中的类
    new RegExp(`[^\\s,{}]+\\.${className}[^\\s,{}]*\\s*\\{[^}]*\\}`, 'g'),
    // 多重选择器
    new RegExp(`\\.${className}\\s*,`, 'g'),
    new RegExp(`,\\s*\\.${className}`, 'g')
  ];
  
  let modified = content;
  let changeCount = 0;
  
  patterns.forEach(pattern => {
    const before = modified;
    modified = modified.replace(pattern, '');
    if (before !== modified) {
      changeCount++;
    }
  });
  
  // 清理多余的空行
  modified = modified.replace(/\n\n\n+/g, '\n\n');
  
  return { content: modified, changed: changeCount > 0 };
}

// 处理单个CSS文件
function processCSSFile(filePath, classes) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let totalChanges = 0;
  
  classes.forEach(className => {
    const result = removeClassFromCSS(content, className);
    if (result.changed) {
      content = result.content;
      totalChanges++;
      stats.classesRemoved++;
    }
  });
  
  if (totalChanges > 0) {
    if (!config.dryRun) {
      // 创建备份
      createBackup(filePath);
      // 保存修改
      fs.writeFileSync(filePath, content, 'utf8');
    }
    
    stats.filesModified++;
    console.log(`  ${config.dryRun ? '📝 将' : '✅'}处理: ${path.relative(process.cwd(), filePath)} (删除${totalChanges}个类)`);
  }
  
  stats.filesProcessed++;
}

// 扫描并处理所有CSS文件
function processAllCSS(classes) {
  const cssFiles = [];
  
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!['node_modules', '.git', 'miniprogram_npm', 'backups'].includes(item)) {
          scanDir(fullPath);
        }
      } else if (item.endsWith('.scss') || item.endsWith('.wxss')) {
        cssFiles.push(fullPath);
      }
    });
  }
  
  scanDir(path.join(process.cwd(), 'miniprogram'));
  
  console.log(`\n📁 找到 ${cssFiles.length} 个样式文件\n`);
  
  // 分批处理
  for (let i = 0; i < classes.length; i += config.batchSize) {
    const batch = classes.slice(i, i + config.batchSize);
    console.log(`\n🔄 处理第 ${Math.floor(i / config.batchSize) + 1} 批（${batch.length} 个类）:`);
    
    cssFiles.forEach(file => {
      processCSSFile(file, batch);
    });
    
    // 显示进度
    const progress = Math.min(100, Math.round(((i + config.batchSize) / classes.length) * 100));
    console.log(`\n📊 进度: ${progress}%`);
  }
}

// 生成清理报告
function generateReport(unusedClasses) {
  const reportPath = path.join(process.cwd(), 'docs/CSS-CLEANUP-REPORT.md');
  
  const report = `# CSS清理执行报告

生成时间：${new Date().toLocaleString('zh-CN')}

## 执行模式
- 模式：${config.dryRun ? '预览模式' : '实际执行'}
- 安全模式：${config.safeMode ? '开启' : '关闭'}
- 批处理大小：${config.batchSize}

## 统计信息
- 待清理CSS类：${unusedClasses.length}
- 跳过的安全类：${stats.classesSkipped}
- 扫描文件数：${stats.filesProcessed}
- 修改文件数：${stats.filesModified}
- 删除的类：${stats.classesRemoved}
- 错误数：${stats.errors.length}

## 备份位置
${config.dryRun ? '预览模式，未创建备份' : config.backupDir}

## 执行日志
${stats.errors.length > 0 ? stats.errors.join('\n') : '无错误'}

## 建议
${config.dryRun ? '1. 检查预览结果，确认无误后使用 --execute 参数执行实际清理' : '1. 已完成清理，建议全面测试样式表现'}
2. 如发现样式问题，可从备份恢复：cp -r ${config.backupDir}/* ./
3. 定期执行CSS清理，保持代码整洁
`;
  
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`\n📄 清理报告已生成: docs/CSS-CLEANUP-REPORT.md`);
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  config.dryRun = !args.includes('--execute');
  
  console.log('🧹 CSS清理工具\n');
  console.log(`模式: ${config.dryRun ? '🔍 预览模式' : '⚠️  执行模式'}`);
  
  if (!config.dryRun) {
    console.log('\n⚠️  警告：即将删除CSS类，请确保已备份！');
    console.log('按 Ctrl+C 取消，或等待5秒继续...\n');
    
    // 给用户5秒时间取消
    const delay = 5000;
    const start = Date.now();
    while (Date.now() - start < delay) {
      // 等待
    }
  }
  
  try {
    // 1. 加载未使用的类列表
    console.log('📋 加载未使用的CSS类列表...');
    const unusedClasses = loadUnusedClasses();
    console.log(`✅ 找到 ${unusedClasses.length} 个待清理的类`);
    
    // 2. 处理CSS文件
    console.log('\n🔧 开始处理CSS文件...');
    processAllCSS(unusedClasses);
    
    // 3. 生成报告
    generateReport(unusedClasses);
    
    // 4. 显示结果
    console.log('\n' + '='.repeat(50));
    console.log('📊 清理结果：');
    console.log(`  • 文件：${stats.filesProcessed} 个扫描，${stats.filesModified} 个修改`);
    console.log(`  • CSS类：${stats.classesRemoved} 个删除，${stats.classesSkipped} 个跳过`);
    
    if (config.dryRun) {
      console.log('\n💡 提示：当前是预览模式，使用以下命令执行实际清理：');
      console.log('   node scripts/execute-css-cleanup.js --execute');
    } else {
      console.log('\n✅ CSS清理完成！');
      console.log(`📁 备份已保存至: ${config.backupDir}`);
      console.log('\n⚠️  请全面测试样式表现，如有问题可从备份恢复');
    }
  } catch (error) {
    console.error('\n❌ 清理失败:', error.message);
    stats.errors.push(error.message);
    process.exit(1);
  }
}

// 执行
main();
