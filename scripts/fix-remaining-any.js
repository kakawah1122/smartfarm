#!/usr/bin/env node

/**
 * 批量处理剩余的any类型文件
 * 安全且智能地替换any类型
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 统计
const stats = {
  totalFiles: 0,
  processedFiles: 0,
  skippedFiles: 0,
  totalReplacements: 0,
  errorFiles: [],
  fileDetails: []
};

// 获取包含any的文件列表
function getFilesWithAny() {
  try {
    const result = execSync(
      'find miniprogram -name "*.ts" -exec grep -l ": any" {} \\;',
      { encoding: 'utf8', cwd: process.cwd() }
    );
    return result.trim().split('\n').filter(f => f);
  } catch (e) {
    console.log('未找到包含any的文件');
    return [];
  }
}

// 安全的替换规则
const SAFE_REPLACEMENTS = [
  // 1. 事件参数
  {
    pattern: /\(e:\s*any\)/g,
    replacement: '(e: CustomEvent)',
    description: '事件参数'
  },
  
  // 2. 简单的any声明
  {
    pattern: /:\s*any\s*(?=[,;}\)])/g,
    replacement: ': unknown',
    description: '简单any'
  },
  
  // 3. any数组
  {
    pattern: /:\s*any\[\]/g,
    replacement: ': unknown[]',
    description: 'any数组'
  },
  
  // 4. as any
  {
    pattern: /as\s+any\b/g,
    replacement: 'as unknown',
    description: '类型断言'
  },
  
  // 5. Promise<any>
  {
    pattern: /Promise<any>/g,
    replacement: 'Promise<unknown>',
    description: 'Promise类型'
  },
  
  // 6. Array<any>
  {
    pattern: /Array<any>/g,
    replacement: 'Array<unknown>',
    description: 'Array类型'
  },
  
  // 7. Record<string, any>
  {
    pattern: /Record<([^,]+),\s*any>/g,
    replacement: 'Record<$1, unknown>',
    description: 'Record类型'
  },
  
  // 8. 函数返回值
  {
    pattern: /\):\s*any\s*{/g,
    replacement: '): unknown {',
    description: '函数返回值'
  },
  
  // 9. 泛型参数
  {
    pattern: /<any>/g,
    replacement: '<unknown>',
    description: '泛型参数'
  }
];

// 处理单个文件
function processFile(filePath) {
  stats.totalFiles++;
  
  // 跳过特殊文件
  if (filePath.includes('.backup') || 
      filePath.includes('node_modules') ||
      filePath.includes('miniprogram_npm') ||
      filePath.includes('.d.ts')) {
    console.log(`  ⏭️  跳过: ${path.basename(filePath)}`);
    stats.skippedFiles++;
    return 0;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let replacements = 0;
    
    // 应用安全替换规则
    SAFE_REPLACEMENTS.forEach(rule => {
      const matches = content.match(rule.pattern);
      if (matches) {
        content = content.replace(rule.pattern, rule.replacement);
        replacements += matches.length;
      }
    });
    
    // 如果有修改，保存文件
    if (content !== originalContent) {
      // 创建备份
      const backupPath = filePath + '.any-backup';
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(filePath, backupPath);
      }
      
      // 保存修改
      fs.writeFileSync(filePath, content, 'utf8');
      
      stats.processedFiles++;
      stats.totalReplacements += replacements;
      stats.fileDetails.push({
        file: filePath,
        replacements: replacements
      });
      
      console.log(`  ✅ ${path.basename(filePath)}: ${replacements}处`);
      return replacements;
    } else {
      console.log(`  ℹ️  ${path.basename(filePath)}: 无需修改`);
      return 0;
    }
  } catch (error) {
    console.error(`  ❌ ${path.basename(filePath)}: ${error.message}`);
    stats.errorFiles.push(filePath);
    return 0;
  }
}

// 批量处理目录
function processDirectory(dirName, fileList) {
  console.log(`\n📁 处理 ${dirName} 目录...`);
  
  const dirFiles = fileList.filter(f => f.includes(`/${dirName}/`));
  console.log(`  发现 ${dirFiles.length} 个文件`);
  
  dirFiles.forEach(file => {
    processFile(file);
  });
}

// 处理utils目录
function processUtils() {
  console.log('\n🔧 处理utils目录...');
  
  const utilsDir = path.join(process.cwd(), 'miniprogram/utils');
  if (!fs.existsSync(utilsDir)) {
    console.log('  utils目录不存在');
    return;
  }
  
  const files = fs.readdirSync(utilsDir)
    .filter(f => f.endsWith('.ts') && !f.includes('backup'))
    .map(f => path.join('miniprogram/utils', f));
  
  files.forEach(file => {
    processFile(file);
  });
}

// 处理packageHealth目录
function processPackageHealth() {
  console.log('\n🏥 处理packageHealth目录...');
  
  const healthDir = path.join(process.cwd(), 'miniprogram/packageHealth');
  if (!fs.existsSync(healthDir)) {
    console.log('  packageHealth目录不存在');
    return;
  }
  
  // 递归获取所有ts文件
  function getAllTsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory() && !file.includes('node_modules')) {
        getAllTsFiles(fullPath, fileList);
      } else if (file.endsWith('.ts') && !file.includes('backup')) {
        fileList.push(fullPath.replace(process.cwd() + '/', ''));
      }
    });
    return fileList;
  }
  
  const files = getAllTsFiles(healthDir);
  files.forEach(file => {
    processFile(file);
  });
}

// 生成详细报告
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 批量优化报告');
  console.log('='.repeat(60));
  
  console.log('\n📈 统计数据:');
  console.log(`  扫描文件: ${stats.totalFiles}`);
  console.log(`  处理文件: ${stats.processedFiles}`);
  console.log(`  跳过文件: ${stats.skippedFiles}`);
  console.log(`  错误文件: ${stats.errorFiles.length}`);
  console.log(`  替换总数: ${stats.totalReplacements}`);
  
  if (stats.fileDetails.length > 0) {
    console.log('\n🏆 Top 10 优化文件:');
    stats.fileDetails
      .sort((a, b) => b.replacements - a.replacements)
      .slice(0, 10)
      .forEach((item, index) => {
        const fileName = path.basename(item.file);
        console.log(`  ${index + 1}. ${fileName}: ${item.replacements}处`);
      });
  }
  
  if (stats.errorFiles.length > 0) {
    console.log('\n⚠️  处理失败的文件:');
    stats.errorFiles.slice(0, 5).forEach(file => {
      console.log(`  - ${path.basename(file)}`);
    });
  }
  
  // 重新统计剩余的any
  console.log('\n🔍 重新检查剩余的any类型...');
  try {
    const remaining = execSync(
      'find miniprogram -name "*.ts" -exec grep -l ": any" {} \\; | wc -l',
      { encoding: 'utf8', cwd: process.cwd() }
    );
    console.log(`  剩余包含any的文件: ${remaining.trim()}`);
  } catch (e) {
    console.log('  无法统计剩余文件');
  }
  
  console.log('\n💡 建议:');
  console.log('1. 检查编译是否正常');
  console.log('2. 测试主要功能');
  console.log('3. 逐步替换unknown为具体类型');
  console.log('4. 考虑启用TypeScript严格模式');
  
  console.log('\n📁 备份说明:');
  console.log('  所有修改的文件都创建了.any-backup备份');
  console.log('  恢复命令: cp file.ts.any-backup file.ts');
  
  console.log('='.repeat(60));
}

// 主函数
function main() {
  console.log('🚀 批量处理剩余any类型');
  console.log('='.repeat(60));
  
  // 获取文件列表
  console.log('\n🔍 扫描包含any的文件...');
  const fileList = getFilesWithAny();
  console.log(`  找到 ${fileList.length} 个文件`);
  
  if (fileList.length === 0) {
    console.log('\n✅ 没有找到包含any的文件！');
    return;
  }
  
  // 按目录分类处理
  processDirectory('utils', fileList);
  processDirectory('packageHealth', fileList);
  processDirectory('packageFinance', fileList);
  processDirectory('packageProduction', fileList);
  processDirectory('packageAI', fileList);
  
  // 处理其他散落的文件
  console.log('\n📄 处理其他文件...');
  const processedDirs = ['utils', 'packageHealth', 'packageFinance', 'packageProduction', 'packageAI'];
  const otherFiles = fileList.filter(f => {
    return !processedDirs.some(dir => f.includes(`/${dir}/`));
  });
  
  otherFiles.forEach(file => {
    processFile(file);
  });
  
  // 生成报告
  generateReport();
}

// 执行
main();
