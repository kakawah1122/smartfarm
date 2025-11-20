/**
 * 云函数性能监控脚本
 * 功能：监控新旧云函数的性能对比
 * 使用：在微信开发者工具控制台执行
 */

class CloudFunctionMonitor {
  constructor() {
    this.metrics = {
      oldFunction: [],
      newFunctions: {
        'health-cost': [],
        'health-overview': []
      }
    };
    this.isMonitoring = false;
  }
  
  // 开始监控
  async startMonitoring(duration = 60000) {
    console.log('📊 开始云函数性能监控...');
    console.log(`监控时长: ${duration / 1000}秒\n`);
    
    this.isMonitoring = true;
    const endTime = Date.now() + duration;
    
    // 定义测试actions
    const testActions = [
      // health-cost的action
      { action: 'calculate_health_rate', module: 'health-cost' },
      { action: 'calculate_batch_cost', module: 'health-cost', data: { batchId: 'all' } },
      
      // health-overview的action
      { action: 'get_homepage_health_overview', module: 'health-overview' },
      { action: 'get_dashboard_snapshot', module: 'health-overview', data: { batchId: 'all' } }
    ];
    
    let testCount = 0;
    
    while (Date.now() < endTime && this.isMonitoring) {
      // 随机选择一个测试
      const test = testActions[Math.floor(Math.random() * testActions.length)];
      
      try {
        const startTime = Date.now();
        
        const result = await wx.cloud.callFunction({
          name: 'health-management',
          data: {
            action: test.action,
            ...(test.data || {})
          }
        });
        
        const responseTime = Date.now() - startTime;
        
        // 记录指标
        const metric = {
          action: test.action,
          responseTime,
          success: result.result?.success || false,
          timestamp: new Date().toISOString()
        };
        
        // 根据响应时间判断是否使用了新云函数
        if (responseTime < 500) {
          // 可能是新云函数（更快）
          this.metrics.newFunctions[test.module].push(metric);
          console.log(`✅ [${test.module}] ${test.action}: ${responseTime}ms`);
        } else {
          // 可能是旧云函数
          this.metrics.oldFunction.push(metric);
          console.log(`⏱️ [旧函数] ${test.action}: ${responseTime}ms`);
        }
        
        testCount++;
        
      } catch (error) {
        console.error(`❌ 测试失败: ${test.action}`, error.message);
      }
      
      // 间隔2秒进行下一次测试
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    this.isMonitoring = false;
    console.log(`\n监控完成，共执行 ${testCount} 次测试`);
    
    return this.generateReport();
  }
  
  // 停止监控
  stopMonitoring() {
    this.isMonitoring = false;
    console.log('⏹️ 监控已停止');
  }
  
  // 生成报告
  generateReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 云函数性能监控报告');
    console.log('='.repeat(50));
    
    // 计算平均响应时间
    const calculateAverage = (metrics) => {
      if (metrics.length === 0) return 0;
      const sum = metrics.reduce((acc, m) => acc + m.responseTime, 0);
      return Math.round(sum / metrics.length);
    };
    
    // 计算成功率
    const calculateSuccessRate = (metrics) => {
      if (metrics.length === 0) return 0;
      const successCount = metrics.filter(m => m.success).length;
      return (successCount / metrics.length * 100).toFixed(1);
    };
    
    // 旧函数统计
    if (this.metrics.oldFunction.length > 0) {
      console.log('\n📦 旧函数 (health-management)');
      console.log(`  调用次数: ${this.metrics.oldFunction.length}`);
      console.log(`  平均响应时间: ${calculateAverage(this.metrics.oldFunction)}ms`);
      console.log(`  成功率: ${calculateSuccessRate(this.metrics.oldFunction)}%`);
      console.log(`  最慢: ${Math.max(...this.metrics.oldFunction.map(m => m.responseTime))}ms`);
      console.log(`  最快: ${Math.min(...this.metrics.oldFunction.map(m => m.responseTime))}ms`);
    }
    
    // 新函数统计
    Object.keys(this.metrics.newFunctions).forEach(module => {
      const metrics = this.metrics.newFunctions[module];
      if (metrics.length > 0) {
        console.log(`\n📦 新函数 (${module})`);
        console.log(`  调用次数: ${metrics.length}`);
        console.log(`  平均响应时间: ${calculateAverage(metrics)}ms`);
        console.log(`  成功率: ${calculateSuccessRate(metrics)}%`);
        console.log(`  最慢: ${Math.max(...metrics.map(m => m.responseTime))}ms`);
        console.log(`  最快: ${Math.min(...metrics.map(m => m.responseTime))}ms`);
      }
    });
    
    // 性能对比
    const oldAvg = calculateAverage(this.metrics.oldFunction);
    const newCostAvg = calculateAverage(this.metrics.newFunctions['health-cost']);
    const newOverviewAvg = calculateAverage(this.metrics.newFunctions['health-overview']);
    
    console.log('\n📈 性能对比');
    if (oldAvg > 0 && newCostAvg > 0) {
      const improvement = ((oldAvg - newCostAvg) / oldAvg * 100).toFixed(1);
      console.log(`  health-cost 性能提升: ${improvement}%`);
    }
    if (oldAvg > 0 && newOverviewAvg > 0) {
      const improvement = ((oldAvg - newOverviewAvg) / oldAvg * 100).toFixed(1);
      console.log(`  health-overview 性能提升: ${improvement}%`);
    }
    
    // 建议
    console.log('\n💡 建议');
    const allNewMetrics = [
      ...this.metrics.newFunctions['health-cost'],
      ...this.metrics.newFunctions['health-overview']
    ];
    
    if (allNewMetrics.length > this.metrics.oldFunction.length) {
      console.log('✅ 新云函数调用占比较高，拆分效果良好');
    } else if (allNewMetrics.length === 0) {
      console.log('⚠️ 未检测到新云函数调用，请检查部署状态');
    } else {
      console.log('🔄 新旧云函数混合调用中，继续观察');
    }
    
    console.log('='.repeat(50));
    
    return {
      oldFunction: this.metrics.oldFunction,
      newFunctions: this.metrics.newFunctions,
      summary: {
        oldAvgResponse: oldAvg,
        newCostAvgResponse: newCostAvg,
        newOverviewAvgResponse: newOverviewAvg
      }
    };
  }
  
  // 清除数据
  clearMetrics() {
    this.metrics = {
      oldFunction: [],
      newFunctions: {
        'health-cost': [],
        'health-overview': []
      }
    };
    console.log('📊 监控数据已清除');
  }
}

// 创建监控实例
const monitor = new CloudFunctionMonitor();

// 使用说明
console.log('🔍 云函数性能监控工具');
console.log('====================');
console.log('使用方法:');
console.log('1. 开始监控60秒: monitor.startMonitoring(60000)');
console.log('2. 开始监控30秒: monitor.startMonitoring(30000)');
console.log('3. 停止监控: monitor.stopMonitoring()');
console.log('4. 生成报告: monitor.generateReport()');
console.log('5. 清除数据: monitor.clearMetrics()');
console.log('\n建议在用户活跃时段运行监控，以获得真实数据');
