// material-use-form.ts - 物料领用表单页面逻辑
import { createPageWithNavbar } from '../../utils/navigation'

// 表单数据接口
interface MaterialUseFormData {
  applicationId: string;    // 申请单号
  useDate: string;          // 领用日期
  materialName: string;     // 物料名称
  purpose: string;          // 领用用途
  quantity: string;         // 领用数量
  unit: string;             // 计量单位
  recipient: string;        // 领用人员
  operator: string;         // 操作员
  remarks: string;          // 备注
}

const pageConfig = {
  data: {
    // 表单数据
    formData: {
      applicationId: '',
      useDate: '',
      materialName: '',
      purpose: '',
      quantity: '',
      unit: '',
      recipient: '',
      operator: '',
      remarks: ''
    } as MaterialUseFormData,
    
    // 日期选择器相关
    showDate: false,
    dateValue: '',
    
    // 物料选择器相关
    showMaterialPicker: false,
    availableMaterials: [] as any[],  // 可选择的已采购物料
    materialOptions: [] as string[],  // 物料选择器选项（显示用）
    materialActionItems: [] as any[], // ActionSheet组件数据格式
    
    // 提交状态
    submitting: false,
    
    // 验证错误
    validationErrors: [] as string[]
  },

  onLoad() {
    // 初始化表单
    this.initializeForm()
    // 加载可选择的物料
    this.loadAvailableMaterials()
  },

  // 初始化表单
  initializeForm() {
    const today = new Date()
    const dateString = this.formatDate(today)
    const applicationId = this.generateApplicationId(dateString)
    
    this.setData({
      'formData.useDate': dateString,
      'formData.applicationId': applicationId,
      dateValue: today.getTime()
    })
  },

  // 生成申请单号 (APP-日期格式，APP表示申请)
  generateApplicationId(dateString: string): string {
    const formattedDate = dateString.replace(/-/g, '')
    // 添加随机数确保唯一性
    const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0')
    return `APP-${formattedDate}-${randomSuffix}`
  },

  // 加载可选择的库存物料
  async loadAvailableMaterials() {
    try {
      // 这里应该调用云函数或API获取库存物料数据
      // 模拟获取库存物料数据
      const materials = await this.getInventoryMaterials()
      
      const materialOptions = materials.map((material: any) => 
        `${material.materialName} (库存: ${material.totalQuantity}${material.unit})`
      )
      
      this.setData({
        availableMaterials: materials,
        materialOptions: materialOptions,
        materialActionItems: materials.map((material: any, index: number) => ({
          label: `${material.materialName} (库存: ${material.totalQuantity}${material.unit})`,
          value: index,
          disabled: material.totalQuantity <= 0
        }))
      })
      
      console.log('可选择的库存物料:', materials)
      console.log('数据设置完成，materialOptions长度:', materialOptions.length)
    } catch (error) {
      console.error('加载物料数据失败:', error)
      wx.showToast({
        title: '加载库存数据失败',
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 模拟获取库存物料数据
  async getInventoryMaterials(): Promise<any[]> {
    return new Promise((resolve) => {
      // 模拟API调用 - 减少延迟以便测试
      setTimeout(() => {
        // 模拟汇总库存数据（从多个采购批次汇总而来）
        const mockInventory = [
          {
            materialId: 'INV001',
            materialName: '鹅用配合饲料',
            unit: '袋',
            totalQuantity: 60,  // 汇总了多个批次
            safetyStock: 20,
            isLowStock: false,
            batchCount: 2,      // 来自2个批次
            latestPurchaseDate: '2024-12-01'
          },
          {
            materialId: 'INV002',
            materialName: '玉米颗粒',
            unit: '袋',
            totalQuantity: 22,
            safetyStock: 10, 
            isLowStock: false,
            batchCount: 1,
            latestPurchaseDate: '2024-11-28'
          },
          {
            materialId: 'INV003',
            materialName: '鹅用维生素',
            unit: '瓶',
            totalQuantity: 17,
            safetyStock: 5,
            isLowStock: false,
            batchCount: 1,
            latestPurchaseDate: '2024-11-25'
          },
          {
            materialId: 'INV004',
            materialName: '消毒液',
            unit: '桶',
            totalQuantity: 9,
            safetyStock: 3,
            isLowStock: false,
            batchCount: 1,
            latestPurchaseDate: '2024-12-03'
          }
        ]
        console.log('模拟库存数据加载完成:', mockInventory)
        resolve(mockInventory)
      }, 100)
    })
  },

  // 格式化日期
  formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 显示日期选择器
  showDatePicker() {
    this.setData({
      showDate: true
    })
  },

  // 隐藏日期选择器
  hideDatePicker() {
    this.setData({
      showDate: false
    })
  },

  // 日期选择变化
  onDateChange(e: any) {
    const { value } = e.detail
    this.setData({
      dateValue: value
    })
  },

  // 确认选择日期
  onDateConfirm(e: any) {
    const { value } = e.detail
    const date = new Date(value)
    const dateString = this.formatDate(date)
    const batchId = this.generateBatchId(dateString)
    
    this.setData({
      'formData.useDate': dateString,
      'formData.batchId': batchId,
      dateValue: value,
      showDate: false
    })

    console.log('选择日期:', dateString, '生成批次ID:', batchId)
  },

  // 表单字段变化
  onFieldChange(e: any) {
    const { value } = e.detail
    const { field } = e.currentTarget.dataset
    
    this.setData({
      [`formData.${field}`]: value
    })

    console.log(`字段 ${field} 更新为:`, value)
  },

  // 显示物料选择器
  showMaterialPicker() {
    console.log('点击显示物料选择器')
    console.log('当前materialOptions:', this.data.materialOptions)
    console.log('当前materialOptions长度:', this.data.materialOptions.length)
    
    if (this.data.materialOptions.length === 0) {
      console.log('没有可选择的库存物料')
      wx.showToast({
        title: '暂无库存物料',
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    console.log('准备显示原生ActionSheet')
    wx.showActionSheet({
      itemList: this.data.materialOptions,
      success: (res) => {
        console.log('选择了物料，索引:', res.tapIndex)
        this.onMaterialSelected(res.tapIndex)
      },
      fail: (res) => {
        console.log('取消选择物料')
      }
    })
  },

  // 隐藏物料选择器
  hideMaterialPicker() {
    this.setData({
      showMaterialPicker: false
    })
  },

  // 选择物料
  onMaterialSelected(selectedIndex: number) {
    const selectedMaterial = this.data.availableMaterials[selectedIndex]
    
    if (selectedMaterial) {
      this.setData({
        'formData.materialName': selectedMaterial.materialName,
        'formData.unit': selectedMaterial.unit, // 自动填充计量单位
      })
      
      console.log('选择物料:', selectedMaterial)
      
      // 提示库存数量
      wx.showToast({
        title: `当前库存: ${selectedMaterial.totalQuantity}${selectedMaterial.unit}`,
        icon: 'none',
        duration: 2000
      })
    }
  },

  // 表单验证
  validateForm(): { isValid: boolean; errors: string[] } {
    const { formData } = this.data
    const errors: string[] = []

    // 检查必填字段
    if (!formData.useDate) {
      errors.push('请选择领用日期')
    }
    if (!formData.materialName.trim()) {
      errors.push('请选择物料名称')
    }
    if (!formData.purpose.trim()) {
      errors.push('请输入领用用途')
    }
    if (!formData.quantity.trim()) {
      errors.push('请输入领用数量')
    }
    if (!formData.unit.trim()) {
      errors.push('请输入计量单位')
    }
    if (!formData.recipient.trim()) {
      errors.push('请输入领用人员')
    }
    if (!formData.operator.trim()) {
      errors.push('请输入操作员姓名')
    }

    // 验证数值字段
    if (formData.quantity && (isNaN(Number(formData.quantity)) || Number(formData.quantity) <= 0)) {
      errors.push('领用数量必须为正数')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  },

  // 提交表单
  async onSubmit() {
    // 验证表单
    const validation = this.validateForm()
    if (!validation.isValid) {
      wx.showToast({
        title: validation.errors[0],
        icon: 'none',
        duration: 2000
      })
      return
    }

    // 设置提交状态
    this.setData({
      submitting: true
    })

    try {
      // 准备提交数据
      const submitData = {
        ...this.data.formData,
        type: '领用',
        createTime: new Date().toISOString(),
        status: '已审批'
      }

      console.log('提交物料领用数据:', submitData)

      // 这里应该调用云函数或API提交数据
      // 模拟API调用
      await this.submitToDatabase(submitData)

      // 提交成功
      wx.showToast({
        title: '物料领用申请提交成功',
        icon: 'success',
        duration: 2000
      })

      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack({
          delta: 1
        })
      }, 2000)

    } catch (error) {
      console.error('提交物料领用申请失败:', error)
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none',
        duration: 2000
      })
    } finally {
      this.setData({
        submitting: false
      })
    }
  },

  // 模拟数据库提交
  async submitToDatabase(data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      // 模拟网络请求延迟
      setTimeout(() => {
        // 模拟90%成功率
        if (Math.random() > 0.1) {
          resolve()
        } else {
          reject(new Error('网络错误'))
        }
      }, 1500)
    })
  },

  // 重置表单
  onReset() {
    wx.showModal({
      title: '确认重置',
      content: '确定要重置表单吗？所有已填写的数据将被清空。',
      success: (res) => {
        if (res.confirm) {
          // 重置表单数据（保留日期和申请单号）
          const currentDate = this.data.formData.useDate
          const currentApplicationId = this.data.formData.applicationId
          
          this.setData({
            formData: {
              applicationId: currentApplicationId,
              useDate: currentDate,
              materialName: '',
              purpose: '',
              quantity: '',
              unit: '',
              recipient: '',
              operator: '',
              remarks: ''
            }
          })

          wx.showToast({
            title: '表单已重置',
            icon: 'success',
            duration: 1500
          })
        }
      }
    })
  },

  // 页面分享
  onShareAppMessage() {
    return {
      title: '物料领用申请表单',
      path: '/pages/material-use-form/material-use-form',
      imageUrl: '' // 可以设置分享图片
    }
  }
}

// 使用导航栏适配工具创建页面
Page(createPageWithNavbar(pageConfig))
