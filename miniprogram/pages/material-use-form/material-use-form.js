"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// material-use-form.ts - 物料领用表单页面逻辑
const navigation_1 = require("../../utils/navigation");
const pageConfig = {
    data: {
        // 表单数据
        formData: {
            applicationId: '',
            useDate: '',
            materialName: '',
            purpose: '',
            quantity: '',
            remarks: ''
        },
        // 日期选择器相关
        showDate: false,
        dateValue: '',
        // 物料选择器相关
        showMaterialPicker: false,
        availableMaterials: [], // 可选择的已采购物料
        materialOptions: [], // 物料选择器选项（显示用）
        materialActionItems: [], // ActionSheet组件数据格式
        // 提交状态
        submitting: false,
        // 验证错误
        validationErrors: []
    },
    onLoad() {
        // 初始化表单
        this.initializeForm();
        // 加载可选择的物料
        this.loadAvailableMaterials();
    },
    // 初始化表单
    initializeForm() {
        const today = new Date();
        const dateString = this.formatDate(today);
        const applicationId = this.generateApplicationId(dateString);
        this.setData({
            'formData.useDate': dateString,
            'formData.applicationId': applicationId,
            dateValue: today.getTime()
        });
    },
    // 生成申请单号 (APP-日期格式，APP表示申请)
    generateApplicationId(dateString) {
        const formattedDate = dateString.replace(/-/g, '');
        // 添加随机数确保唯一性
        const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        return `APP-${formattedDate}-${randomSuffix}`;
    },
    // 加载可选择的库存物料
    async loadAvailableMaterials() {
        try {
            // 调用云函数获取真实库存物料数据
            const materials = await this.getRealInventoryMaterials();
            const materialOptions = materials.map((material) => `${material.materialName} (库存: ${material.totalQuantity}${material.unit || ''})`);
            this.setData({
                availableMaterials: materials,
                materialOptions: materialOptions,
                materialActionItems: materials.map((material, index) => ({
                    label: `${material.materialName} (库存: ${material.totalQuantity}${material.unit || ''})`,
                    value: index,
                    disabled: material.totalQuantity <= 0
                }))
            });
            console.log('可选择的库存物料:', materials);
            console.log('数据设置完成，materialOptions长度:', materialOptions.length);
        }
        catch (error) {
            console.error('加载物料数据失败:', error);
            wx.showToast({
                title: '加载库存数据失败',
                icon: 'none',
                duration: 2000
            });
        }
    },
    // 获取真实库存物料数据
    async getRealInventoryMaterials() {
        try {
            console.log('🔍 调用云函数获取物料列表...');
            const result = await wx.cloud.callFunction({
                name: 'production-material',
                data: {
                    action: 'list_materials'
                }
            });
            if (!result.result.success) {
                throw new Error('获取物料数据失败');
            }
            const materials = result.result.data.materials || [];
            console.log('📦 获取到真实物料数据:', materials.length, '个');
            console.log('📦 原始物料数据样本:', materials[0]);
            // 转换为表单需要的格式
            const inventoryMaterials = materials.map(material => {
                console.log('🔄 转换物料:', material.name, 'ID:', material._id, 'ID类型:', typeof material._id);
                return {
                    materialId: material._id,
                    materialName: material.name,
                    unit: material.unit || '', // 保留unit字段用于显示，但表单不再使用
                    totalQuantity: Number(material.currentStock) || 0,
                    safetyStock: 5, // 默认安全库存
                    isLowStock: Number(material.currentStock) <= 5,
                    batchCount: 1, // 简化处理
                    latestPurchaseDate: material.createTime ? material.createTime.split('T')[0] : new Date().toISOString().split('T')[0]
                };
            });
            console.log('📦 转换后的库存物料样本:', inventoryMaterials[0]);
            return inventoryMaterials;
        }
        catch (error) {
            console.error('❌ 获取物料数据失败:', error);
            wx.showToast({
                title: '获取物料数据失败',
                icon: 'none'
            });
            return [];
        }
    },
    // 格式化日期
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    // 显示日期选择器
    showDatePicker() {
        this.setData({
            showDate: true
        });
    },
    // 隐藏日期选择器
    hideDatePicker() {
        this.setData({
            showDate: false
        });
    },
    // 日期选择变化
    onDateChange(e) {
        const { value } = e.detail;
        this.setData({
            dateValue: value
        });
    },
    // 确认选择日期
    onDateConfirm(e) {
        const { value } = e.detail;
        const date = new Date(value);
        const dateString = this.formatDate(date);
        const batchId = this.generateBatchId(dateString);
        this.setData({
            'formData.useDate': dateString,
            'formData.batchId': batchId,
            dateValue: value,
            showDate: false
        });
        console.log('选择日期:', dateString, '生成批次ID:', batchId);
    },
    // 表单字段变化
    onFieldChange(e) {
        const { value } = e.detail;
        const { field } = e.currentTarget.dataset;
        this.setData({
            [`formData.${field}`]: value
        });
        console.log(`字段 ${field} 更新为:`, value);
    },
    // 显示物料选择器
    showMaterialPicker() {
        console.log('点击显示物料选择器');
        console.log('当前materialOptions:', this.data.materialOptions);
        console.log('当前materialOptions长度:', this.data.materialOptions.length);
        if (this.data.materialOptions.length === 0) {
            console.log('没有可选择的库存物料');
            wx.showToast({
                title: '暂无库存物料',
                icon: 'none',
                duration: 2000
            });
            return;
        }
        console.log('准备显示原生ActionSheet');
        wx.showActionSheet({
            itemList: this.data.materialOptions,
            success: (res) => {
                console.log('选择了物料，索引:', res.tapIndex);
                this.onMaterialSelected(res.tapIndex);
            },
            fail: (res) => {
                console.log('取消选择物料');
            }
        });
    },
    // 隐藏物料选择器
    hideMaterialPicker() {
        this.setData({
            showMaterialPicker: false
        });
    },
    // 选择物料
    onMaterialSelected(selectedIndex) {
        const selectedMaterial = this.data.availableMaterials[selectedIndex];
        if (selectedMaterial) {
            this.setData({
                'formData.materialName': selectedMaterial.materialName
            });
            console.log('选择物料:', selectedMaterial);
            // 提示库存数量
            wx.showToast({
                title: `当前库存: ${selectedMaterial.totalQuantity}${selectedMaterial.unit || ''}`,
                icon: 'none',
                duration: 2000
            });
        }
    },
    // 表单验证
    validateForm() {
        const { formData } = this.data;
        const errors = [];
        // 检查必填字段
        if (!formData.useDate) {
            errors.push('请选择领用日期');
        }
        if (!formData.materialName.trim()) {
            errors.push('请选择物料名称');
        }
        if (!formData.purpose.trim()) {
            errors.push('请输入领用用途');
        }
        if (!formData.quantity.trim()) {
            errors.push('请输入领用数量');
        }
        // 验证数值字段
        if (formData.quantity && (isNaN(Number(formData.quantity)) || Number(formData.quantity) <= 0)) {
            errors.push('领用数量必须为正数');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    },
    // 提交表单
    async onSubmit() {
        // 验证表单
        const validation = this.validateForm();
        if (!validation.isValid) {
            wx.showToast({
                title: validation.errors[0],
                icon: 'none',
                duration: 2000
            });
            return;
        }
        // 设置提交状态
        this.setData({
            submitting: true
        });
        try {
            // 准备提交数据
            const submitData = {
                ...this.data.formData,
                type: '领用',
                createTime: new Date().toISOString(),
                status: '已审批'
            };
            console.log('提交物料领用数据:', submitData);
            // 调用云函数提交物料使用记录
            await this.submitToCloudFunction(submitData);
            // 提交成功
            wx.showToast({
                title: '物料领用申请提交成功',
                icon: 'success',
                duration: 2000
            });
            // 延迟返回上一页
            setTimeout(() => {
                wx.navigateBack({
                    delta: 1
                });
            }, 2000);
        }
        catch (error) {
            console.error('提交物料领用申请失败:', error);
            wx.showToast({
                title: '提交失败，请重试',
                icon: 'none',
                duration: 2000
            });
        }
        finally {
            this.setData({
                submitting: false
            });
        }
    },
    // 提交到云函数 - 使用正确的领用出库流程
    async submitToCloudFunction(data) {
        try {
            console.log('🚀 调用云函数进行物料领用:', data);
            // 根据物料名称找到对应的物料ID
            console.log('🔍 当前可用物料列表:', this.data.availableMaterials);
            console.log('🔍 要查找的物料名称:', data.materialName);
            const selectedMaterial = this.data.availableMaterials.find(material => material.materialName === data.materialName);
            if (!selectedMaterial) {
                console.error('❌ 找不到物料，可用物料:', this.data.availableMaterials.map(m => m.materialName));
                throw new Error('找不到选定的物料信息');
            }
            console.log('🎯 找到选定物料:', selectedMaterial);
            console.log('🎯 物料ID:', selectedMaterial.materialId);
            console.log('🎯 物料ID类型:', typeof selectedMaterial.materialId);
            // 直接创建物料使用记录（会自动检查库存并更新）
            const recordResult = await wx.cloud.callFunction({
                name: 'production-material',
                data: {
                    action: 'create_record',
                    recordData: {
                        materialId: selectedMaterial.materialId,
                        type: 'use',
                        quantity: Number(data.quantity),
                        targetLocation: data.purpose, // 使用用途作为目标位置
                        operator: '用户',
                        status: '已完成',
                        notes: `用途：${data.purpose}${data.remarks ? '，备注：' + data.remarks : ''}`,
                        recordDate: data.useDate
                    }
                }
            });
            if (!recordResult.result.success) {
                throw new Error('创建使用记录失败: ' + recordResult.result.error);
            }
            console.log('✅ 物料领用成功:', {
                recordNumber: recordResult.result.data.recordNumber,
                newStock: recordResult.result.data.newStock,
                usedQuantity: data.quantity,
                material: data.materialName
            });
        }
        catch (error) {
            console.error('❌ 物料领用失败:', error);
            throw error;
        }
    },
    // 重置表单
    onReset() {
        wx.showModal({
            title: '确认重置',
            content: '确定要重置表单吗？所有已填写的数据将被清空。',
            success: (res) => {
                if (res.confirm) {
                    // 重置表单数据（保留日期和申请单号）
                    const currentDate = this.data.formData.useDate;
                    const currentApplicationId = this.data.formData.applicationId;
                    this.setData({
                        formData: {
                            applicationId: currentApplicationId,
                            useDate: currentDate,
                            materialName: '',
                            purpose: '',
                            quantity: '',
                            remarks: ''
                        }
                    });
                    wx.showToast({
                        title: '表单已重置',
                        icon: 'success',
                        duration: 1500
                    });
                }
            }
        });
    },
    // 页面分享
    onShareAppMessage() {
        return {
            title: '物料领用申请表单',
            path: '/pages/material-use-form/material-use-form',
            imageUrl: '' // 可以设置分享图片
        };
    }
};
// 使用导航栏适配工具创建页面
Page((0, navigation_1.createPageWithNavbar)(pageConfig));
