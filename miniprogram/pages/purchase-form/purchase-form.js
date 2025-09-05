"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// purchase-form.ts - 采购入库表单页面逻辑
const navigation_1 = require("../../utils/navigation");
const pageConfig = {
    data: {
        // 表单数据
        formData: {
            batchId: '',
            purchaseDate: '',
            materialName: '',
            category: '',
            specification: '',
            supplier: '',
            quantity: '',
            unitPrice: '',
            remarks: ''
        },
        // 日期选择器相关
        showDate: false,
        dateValue: '',
        // 分类选择器相关
        categoryLabels: ['饲料', '药品', '设备', '耗材', '其他'],
        categoryIndex: -1, // -1表示未选择
        // 计算总金额
        totalAmount: '0.00',
        // 提交状态
        submitting: false,
        // 验证错误
        validationErrors: []
    },
    onLoad() {
        // 初始化表单
        this.initializeForm();
    },
    // 初始化表单
    initializeForm() {
        const today = new Date();
        const dateString = this.formatDate(today);
        const batchId = this.generateBatchId(dateString);
        this.setData({
            'formData.purchaseDate': dateString,
            'formData.batchId': batchId,
            dateValue: today.getTime()
        });
    },
    // 生成批次ID (CG-日期格式，CG表示采购)
    generateBatchId(dateString) {
        const formattedDate = dateString.replace(/-/g, '');
        return `CG-${formattedDate}`;
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
            'formData.purchaseDate': dateString,
            'formData.batchId': batchId,
            dateValue: value,
            showDate: false
        });
        console.log('选择日期:', dateString, '生成批次ID:', batchId);
    },
    // 分类选择变化
    onCategoryChange(e) {
        const index = e.detail.value;
        const category = this.data.categoryLabels[index];
        this.setData({
            'formData.category': category,
            categoryIndex: index
        });
        console.log('选择分类:', category);
    },
    // 表单字段变化
    onFieldChange(e) {
        const { value } = e.detail;
        const { field } = e.currentTarget.dataset;
        this.setData({
            [`formData.${field}`]: value
        });
        // 如果是数量、单价或单位变化，重新计算总金额
        if (field === 'quantity' || field === 'unitPrice') {
            this.calculateTotalAmount();
        }
        console.log(`字段 ${field} 更新为:`, value);
    },
    // 计算总金额
    calculateTotalAmount() {
        const { quantity, unitPrice } = this.data.formData;
        const quantityNum = parseFloat(quantity) || 0;
        const priceNum = parseFloat(unitPrice) || 0;
        const total = (quantityNum * priceNum).toFixed(2);
        this.setData({
            totalAmount: total
        });
    },
    // 根据物料名称智能推断分类
    getMaterialCategory(materialName) {
        const name = materialName.toLowerCase();
        // 饲料类
        if (name.includes('饲料') || name.includes('精料') || name.includes('玉米') || name.includes('豆粕') || name.includes('麸皮')) {
            return '饲料';
        }
        // 药品类
        if (name.includes('药') || name.includes('疫苗') || name.includes('消毒') || name.includes('抗生素') || name.includes('维生素')) {
            return '药品';
        }
        // 设备类
        if (name.includes('设备') || name.includes('器械') || name.includes('工具') || name.includes('机械')) {
            return '设备';
        }
        // 耗材类
        if (name.includes('耗材') || name.includes('用具') || name.includes('容器') || name.includes('包装')) {
            return '耗材';
        }
        // 其他类（默认）
        return '其他';
    },
    // 表单验证
    validateForm() {
        const { formData } = this.data;
        const errors = [];
        // 检查必填字段
        if (!formData.purchaseDate) {
            errors.push('请选择采购日期');
        }
        if (!formData.materialName.trim()) {
            errors.push('请输入物料名称');
        }
        if (!formData.category.trim()) {
            errors.push('请选择物料分类');
        }
        if (!formData.supplier.trim()) {
            errors.push('请输入供应商');
        }
        if (!formData.quantity.trim()) {
            errors.push('请输入采购数量');
        }
        if (!formData.unitPrice.trim()) {
            errors.push('请输入单价');
        }
        // 验证数值字段
        if (formData.quantity && (isNaN(Number(formData.quantity)) || Number(formData.quantity) <= 0)) {
            errors.push('采购数量必须为正数');
        }
        if (formData.unitPrice && (isNaN(Number(formData.unitPrice)) || Number(formData.unitPrice) <= 0)) {
            errors.push('单价必须为正数');
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
                totalAmount: this.data.totalAmount,
                type: '采购',
                createTime: new Date().toISOString(),
                status: '已完成',
                category: this.data.formData.category || this.getMaterialCategory(this.data.formData.materialName) // 使用用户选择的分类或智能推断
            };
            console.log('提交采购入库数据:', submitData);
            // 调用云函数提交物料数据
            await this.submitToCloudFunction(submitData);
            // 提交成功
            wx.showToast({
                title: '采购入库记录提交成功',
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
            console.error('提交采购入库记录失败:', error);
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
    // 提交到云函数 - 使用新的采购入库接口
    async submitToCloudFunction(data) {
        console.log('🚀 调用云函数进行采购入库:', data);
        try {
            // 使用新的采购入库接口，自动处理物料匹配和创建
            const result = await wx.cloud.callFunction({
                name: 'production-material',
                data: {
                    action: 'purchase_inbound',
                    materialData: {
                        name: data.materialName,
                        category: data.category,
                        specification: data.specification || '',
                        unit: '件',
                        supplier: data.supplier || '',
                        quantity: parseFloat(data.quantity),
                        unitPrice: parseFloat(data.unitPrice),
                        operator: '系统用户',
                        recordDate: data.purchaseDate,
                        notes: data.remarks || '',
                        batchId: data.batchId
                    }
                }
            });
            console.log('云函数返回结果:', result);
            if (!result.result?.success) {
                const errorMsg = result.result?.error || result.result?.message || '未知错误';
                throw new Error(errorMsg);
            }
            console.log('✅ 采购入库成功:', {
                materialId: result.result.data?.materialId,
                recordNumber: result.result.data?.recordNumber,
                newStock: result.result.data?.newStock,
                beforeStock: result.result.data?.beforeStock
            });
        }
        catch (error) {
            console.error('❌ 采购入库失败:', error);
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
                    // 重置表单数据（保留日期和批次ID）
                    const currentDate = this.data.formData.purchaseDate;
                    const currentBatchId = this.data.formData.batchId;
                    this.setData({
                        formData: {
                            batchId: currentBatchId,
                            purchaseDate: currentDate,
                            materialName: '',
                            category: '',
                            specification: '',
                            supplier: '',
                            quantity: '',
                            unitPrice: '',
                            remarks: ''
                        },
                        categoryIndex: -1,
                        totalAmount: '0.00'
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
            title: '采购入库表单',
            path: '/pages/purchase-form/purchase-form',
            imageUrl: '' // 可以设置分享图片
        };
    }
};
// 使用导航栏适配工具创建页面
Page((0, navigation_1.createPageWithNavbar)(pageConfig));
