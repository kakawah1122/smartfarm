/**
 * 首页图表服务模块
 * 负责处理首页各种图表的配置和数据处理
 */

/// <reference path="../../../typings/index.d.ts" />

/**
 * 图表配置接口
 */
export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'ring'
  title?: string
  data: unknown[]
  options?: unknown}

/**
 * 图表服务类
 */
export class IndexChartService {
  /**
   * 生成收支趋势图配置
   */
  static generateRevenueChart(data: unknown[]): ChartConfig {
    const categories = data.map(item => item.date)
    const revenueData = data.map(item => item.revenue || 0)
    const costData = data.map(item => item.cost || 0)
    const profitData = data.map(item => (item.revenue || 0) - (item.cost || 0))
    
    return {
      type: 'line',
      title: '收支趋势',
      data: data,
      options: {
        xAxis: {
          type: 'category',
          data: categories,
          axisLabel: {
            rotate: 45,
            interval: 0,
            fontSize: 10
          }
        },
        yAxis: {
          type: 'value',
          name: '金额(元)',
          axisLabel: {
            formatter: (value: number) => {
              if (value >= 10000) {
                return (value / 10000).toFixed(1) + '万'
              }
              return value
            }
          }
        },
        series: [
          {
            name: '收入',
            type: 'line',
            data: revenueData,
            smooth: true,
            itemStyle: { color: '#22C55E' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(34, 197, 94, 0.3)' },
                  { offset: 1, color: 'rgba(34, 197, 94, 0.01)' }
                ]
              }
            }
          },
          {
            name: '成本',
            type: 'line',
            data: costData,
            smooth: true,
            itemStyle: { color: '#EF4444' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
                  { offset: 1, color: 'rgba(239, 68, 68, 0.01)' }
                ]
              }
            }
          },
          {
            name: '利润',
            type: 'line',
            data: profitData,
            smooth: true,
            itemStyle: { color: '#3B82F6' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                  { offset: 1, color: 'rgba(59, 130, 246, 0.01)' }
                ]
              }
            }
          }
        ],
        tooltip: {
          trigger: 'axis',
          formatter: (params: unknown[]) => {
            let result = params[0].name + '<br/>'
            params.forEach(item => {
              const value = item.value >= 10000 
                ? (item.value / 10000).toFixed(2) + '万' 
                : item.value
              result += `${item.seriesName}: ¥${value}<br/>`
            })
            return result
          }
        },
        legend: {
          data: ['收入', '成本', '利润'],
          bottom: 0
        },
        grid: {
          top: 40,
          left: 50,
          right: 20,
          bottom: 50,
          containLabel: true
        }
      }
    }
  }
  
  /**
   * 生成存栏分布图配置
   */
  static generateInventoryChart(data: unknown[]): ChartConfig {
    const total = data.reduce((sum, item) => sum + item.value, 0)
    
    return {
      type: 'pie',
      title: '存栏分布',
      data: data,
      options: {
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            position: 'outside',
            formatter: (params: unknown) => {
              const percent = total > 0 
                ? ((params.value / total) * 100).toFixed(1) 
                : '0'
              return `${params.name}\n${params.value}只 (${percent}%)`
            }
          },
          labelLine: {
            show: true,
            length: 15,
            length2: 10
          },
          data: data.map((item, index) => ({
            ...item,
            itemStyle: {
              color: this.getColorByIndex(index)
            }
          }))
        }],
        tooltip: {
          trigger: 'item',
          formatter: (params: unknown) => {
            const percent = total > 0 
              ? ((params.value / total) * 100).toFixed(1) 
              : '0'
            return `${params.name}<br/>数量: ${params.value}只<br/>占比: ${percent}%`
          }
        },
        legend: {
          orient: 'vertical',
          left: 'left',
          data: data.map(item => item.name)
        }
      }
    }
  }
  
  /**
   * 生成成本构成图配置
   */
  static generateCostChart(data: unknown[]): ChartConfig {
    const total = data.reduce((sum, item) => sum + item.value, 0)
    
    return {
      type: 'ring',
      title: '成本构成',
      data: data,
      options: {
        series: [{
          type: 'pie',
          radius: ['50%', '70%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: false,
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: '16',
              fontWeight: 'bold',
              formatter: (params: unknown) => {
                const percent = total > 0 
                  ? ((params.value / total) * 100).toFixed(1) 
                  : '0'
                return `${params.name}\n¥${this.formatMoney(params.value)}\n${percent}%`
              }
            }
          },
          labelLine: {
            show: false
          },
          data: data.map((item, index) => ({
            ...item,
            itemStyle: {
              color: this.getCostColorByIndex(index)
            }
          }))
        }],
        tooltip: {
          trigger: 'item',
          formatter: (params: unknown) => {
            const percent = total > 0 
              ? ((params.value / total) * 100).toFixed(1) 
              : '0'
            return `${params.name}<br/>金额: ¥${this.formatMoney(params.value)}<br/>占比: ${percent}%`
          }
        },
        legend: {
          bottom: 0,
          data: data.map(item => item.name)
        }
      }
    }
  }
  
  /**
   * 获取颜色（按索引）
   */
  private static getColorByIndex(index: number): string {
    const colors = [
      '#22C55E', // 绿色
      '#3B82F6', // 蓝色
      '#8B5CF6', // 紫色
      '#F59E0B', // 橙色
      '#EF4444', // 红色
      '#06B6D4', // 青色
      '#EC4899', // 粉色
      '#10B981'  // 翠绿
    ]
    return colors[index % colors.length]
  }
  
  /**
   * 获取成本颜色（按索引）
   */
  private static getCostColorByIndex(index: number): string {
    const colors = [
      '#FF6B6B', // 饲料成本 - 红色
      '#4ECDC4', // 疫苗成本 - 青色
      '#45B7D1', // 人工成本 - 蓝色
      '#FFA07A', // 设备成本 - 橙色
      '#98D8C8', // 其他成本 - 绿色
      '#F7DC6F', // 运输成本 - 黄色
      '#BB8FCE', // 水电成本 - 紫色
      '#85C1E2'  // 管理成本 - 浅蓝
    ]
    return colors[index % colors.length]
  }
  
  /**
   * 格式化金额
   */
  private static formatMoney(value: number): string {
    if (value >= 100000000) {
      return (value / 100000000).toFixed(2) + '亿'
    }
    if (value >= 10000) {
      return (value / 10000).toFixed(2) + '万'
    }
    return value.toFixed(2)
  }
}
