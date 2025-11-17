// 临时修复脚本：重新生成所有批次的任务数据

export async function fixAllBatchTasks() {
  try {
    wx.showLoading({
      title: '修复中...',
      mask: true
    })

    // 第一步：修复批次模板信息
    const templateResult = await wx.cloud.callFunction({
      name: 'production-entry',
      data: {
        action: 'fix_batch_template_info'
      }
    })
    
    if (!templateResult.result?.success) {
      wx.hideLoading()
      wx.showToast({
        title: '修复批次信息失败',
        icon: 'none'
      })
      return
    }
    
    // 第二步：修复任务数据
    const result = await wx.cloud.callFunction({
      name: 'production-entry',
      data: {
        action: 'fix_all_batch_tasks'
      }
    })

    wx.hideLoading()

    if (result.result?.success) {
      const batchData = templateResult.result.data
      const taskData = result.result.data
      
      wx.showModal({
        title: '修复完成',
        content: `批次信息：修复 ${batchData.fixed} 个批次\n任务数据：修复 ${taskData.total} 个批次\n成功: ${taskData.success} 个\n失败: ${taskData.failed} 个`,
        showCancel: false,
        success: () => {
          // 刷新页面数据
          const pages = getCurrentPages()
          const currentPage = pages[pages.length - 1] as any
          if (currentPage && currentPage.loadAllData) {
            currentPage.loadAllData()
          }
        }
      })
    } else {
      wx.showToast({
        title: result.result?.message || '修复失败',
        icon: 'none',
        duration: 2000
      })
    }
  } catch (error: any) {
    wx.hideLoading()
    console.error('修复任务失败:', error)
    wx.showToast({
      title: error.message || '修复失败',
      icon: 'none',
      duration: 2000
    })
  }
}

// 修复单个批次的任务
export async function fixSingleBatchTasks(batchId: string) {
  try {
    wx.showLoading({
      title: '修复中...',
      mask: true
    })

    const result = await wx.cloud.callFunction({
      name: 'production-entry',
      data: {
        action: 'fix_batch_tasks',
        batchId
      }
    })

    wx.hideLoading()

    if (result.result?.success) {
      wx.showToast({
        title: '修复成功',
        icon: 'success',
        duration: 2000
      })
      
      // 刷新页面
      setTimeout(() => {
        const pages = getCurrentPages()
        const currentPage = pages[pages.length - 1] as any
        if (currentPage && currentPage.loadAllData) {
          currentPage.loadAllData()
        }
      }, 2000)
    } else {
      wx.showToast({
        title: result.result?.message || '修复失败',
        icon: 'none',
        duration: 2000
      })
    }
  } catch (error: any) {
    wx.hideLoading()
    console.error('修复任务失败:', error)
    wx.showToast({
      title: error.message || '修复失败',
      icon: 'none',
      duration: 2000
    })
  }
}
