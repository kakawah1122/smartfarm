"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// exit-form.ts - 出栏记录表单页面逻辑
const navigation_1 = require("../../utils/navigation");
const pageConfig = {
    data: {
        // 表单数据
        formData: {
            batchId: '',
            exitDate: '',
            type: '',
            customer: '',
            quantity: '',
            avgWeight: '',
            unitPrice: '',
            remarks: ''
        },
        // 日期选择器相关
        showDate: false,
        dateValue: '',
        // 批次选择器相关
        showBatchPicker: false,
        availableBatches: [], // 可选择的入栏批次
        batchOptions: [], // 批次选择器选项（显示用）
        batchActionItems: [], // ActionSheet组件数据格式
        // 计算结果
        totalWeight: '0.00', // 总重量
        totalRevenue: '0.00', // 总收入
        // 提交状态
        submitting: false,
        // 验证错误
        validationErrors: [],
        // 选择批次后的可用数量上限（用于前端输入约束）
        selectedBatchAvailable: 0
    },
    onLoad() {
        // 初始化表单
        this.initializeForm();
        // 加载可选择的批次
        this.loadAvailableBatches();
    },
    // 初始化表单
    initializeForm() {
        const today = new Date();
        const dateString = this.formatDate(today);
        this.setData({
            'formData.exitDate': dateString,
            dateValue: today.getTime()
        });
    },
    // 加载可选择的入栏批次
    async loadAvailableBatches() {
        try {
            // 从云函数获取已入栏且有剩余可出栏数量的批次（真实剩余量）
            const batches = await this.getEntryBatches();
            const batchOptions = batches.map((batch) => `${batch.batchId} (${batch.breed} - 可出栏: ${batch.availableQuantity}羽)`);
            // ActionSheet组件需要的数据格式
            const batchActionItems = batches.map((batch, index) => ({
                label: `${batch.batchId} (${batch.breed} - 可出栏: ${batch.availableQuantity}羽)`,
                value: index,
                disabled: batch.availableQuantity <= 0
            }));
            this.setData({
                availableBatches: batches,
                batchOptions: batchOptions,
                batchActionItems: batchActionItems
            });
            console.log('可选择的入栏批次:', batches);
            console.log('批次ActionSheet数据:', batchActionItems);
            console.log('批次数据设置完成，batchActionItems长度:', batchActionItems.length);
        }
        catch (error) {
            console.error('加载入栏批次失败:', error);
            wx.showToast({
                title: '加载批次数据失败',
                icon: 'none',
                duration: 2000
            });
        }
    },
    // 从云函数获取真实剩余量的入栏批次数据
    async getEntryBatches() {
        try {
            console.log('开始从云函数获取可用批次数据');
            // 调用出栏云函数，获取按批次聚合后的真实可用数量
            const result = await wx.cloud.callFunction({
                name: 'production-exit',
                data: {
                    action: 'available_batches'
                }
            });
            console.log('云函数返回结果:', result);
            if (result.result && result.result.success) {
                const availableBatches = result.result.data || [];
                // 转换为页面使用的数据结构
                const batches = availableBatches.map((item) => ({
                    batchId: item.batchNumber,
                    batchNumber: item.batchNumber,
                    breed: item.breed || '未知品种',
                    entryDate: item.entryDate || '未知日期',
                    quantity: String(item.totalQuantity || 0),
                    supplier: '未知供应商',
                    availableQuantity: String(item.availableQuantity || 0)
                }));
                console.log('转换后的批次数据:', batches);
                return batches;
            }
            else {
                console.error('云函数调用失败或返回success=false');
                // 如果云函数调用失败，返回空数组
                return [];
            }
        }
        catch (error) {
            console.error('获取可用批次数据失败:', error);
            // 如果是云函数不存在的错误，给出友好提示
            if (error.errMsg && error.errMsg.includes('function not found')) {
                wx.showModal({
                    title: '系统提示',
                    content: '出栏管理云函数尚未部署，无法获取批次数据。',
                    showCancel: false
                });
            }
            // 出错时返回空数组
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
        this.setData({
            'formData.exitDate': dateString,
            dateValue: value,
            showDate: false
        });
        console.log('选择日期:', dateString);
    },
    // 显示批次选择器
    showBatchPicker() {
        console.log('点击显示批次选择器');
        console.log('当前batchOptions:', this.data.batchOptions);
        console.log('当前batchOptions长度:', this.data.batchOptions.length);
        if (this.data.batchOptions.length === 0) {
            console.log('没有可选择的批次数据');
            wx.showToast({
                title: '暂无可选择的入栏批次',
                icon: 'none',
                duration: 2000
            });
            return;
        }
        console.log('准备显示原生批次ActionSheet');
        wx.showActionSheet({
            itemList: this.data.batchOptions,
            success: (res) => {
                console.log('选择了批次，索引:', res.tapIndex);
                this.onBatchSelected(res.tapIndex);
            },
            fail: (res) => {
                console.log('取消选择批次');
            }
        });
    },
    // 隐藏批次选择器
    hideBatchPicker() {
        this.setData({
            showBatchPicker: false
        });
    },
    // 选择批次
    onBatchSelected(selectedIndex) {
        const selectedBatch = this.data.availableBatches[selectedIndex];
        if (selectedBatch) {
            this.setData({
                'formData.batchId': selectedBatch.batchId,
                'formData.type': selectedBatch.breed, // 自动填充鹅的类型
                selectedBatchAvailable: Number(selectedBatch.availableQuantity) || 0
            });
            console.log('选择批次:', selectedBatch);
        }
    },
    // 表单字段变化
    onFieldChange(e) {
        const { value } = e.detail;
        const { field } = e.currentTarget.dataset;
        // 针对数量字段，进行不超过可用数量的前端约束（不弹窗，直接限制）
        if (field === 'quantity') {
            const max = Number(this.data.selectedBatchAvailable) || 0;
            let next = value;
            const num = parseInt(value);
            if (!isNaN(num) && max > 0 && num > max) {
                next = String(max);
            }
            this.setData({
                [`formData.${field}`]: next
            });
        }
        else {
            this.setData({
                [`formData.${field}`]: value
            });
        }
        // 如果是数量、重量或单价变化，重新计算总重量和总收入
        if (field === 'quantity' || field === 'avgWeight' || field === 'unitPrice') {
            this.calculateTotals();
        }
        console.log(`字段 ${field} 更新为:`, value);
    },
    // 计算总重量和总收入
    calculateTotals() {
        const { quantity, avgWeight, unitPrice } = this.data.formData;
        const quantityNum = parseFloat(quantity) || 0;
        const weightNum = parseFloat(avgWeight) || 0;
        const priceNum = parseFloat(unitPrice) || 0;
        // 总重量 = 数量 × 平均重量
        const totalWeight = (quantityNum * weightNum).toFixed(2);
        // 总收入 = 总重量 × 单价
        const totalRevenue = (parseFloat(totalWeight) * priceNum).toFixed(2);
        this.setData({
            totalWeight,
            totalRevenue
        });
    },
    // 获取提交时使用的批次号
    getBatchNumberForSubmission(displayBatchId) {
        // 从可用批次列表中查找对应的批次号
        const batch = this.data.availableBatches.find((b) => b.batchId === displayBatchId);
        if (batch && batch.batchNumber) {
            return batch.batchNumber;
        }
        // 如果没有找到，直接使用显示ID（向后兼容）
        console.warn('未找到批次号，使用显示ID:', displayBatchId);
        return displayBatchId;
    },
    // 表单验证
    validateForm() {
        const { formData } = this.data;
        const errors = [];
        // 检查必填字段
        if (!formData.batchId) {
            errors.push('请选择出栏批次');
        }
        if (!formData.exitDate) {
            errors.push('请选择出栏日期');
        }
        if (!formData.type.trim()) {
            errors.push('请输入鹅的类型');
        }
        if (!formData.customer.trim()) {
            errors.push('请输入客户信息');
        }
        if (!formData.quantity.trim()) {
            errors.push('请输入出栏数量');
        }
        if (!formData.avgWeight.trim()) {
            errors.push('请输入平均重量');
        }
        if (!formData.unitPrice.trim()) {
            errors.push('请输入单价');
        }
        // 验证数值字段
        if (formData.quantity && (isNaN(Number(formData.quantity)) || Number(formData.quantity) <= 0)) {
            errors.push('出栏数量必须为正数');
        }
        if (formData.avgWeight && (isNaN(Number(formData.avgWeight)) || Number(formData.avgWeight) <= 0)) {
            errors.push('平均重量必须为正数');
        }
        if (formData.unitPrice && (isNaN(Number(formData.unitPrice)) || Number(formData.unitPrice) <= 0)) {
            errors.push('单价必须为正数');
        }
        // 额外校验：若选择了批次，出栏数量不得超过可用数量（静默限制已做，此处兜底）
        const max = Number(this.data.selectedBatchAvailable) || 0;
        if (max > 0 && Number(formData.quantity) > max) {
            errors.push(`出栏数量不得超过${max}羽`);
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
                totalWeight: this.data.totalWeight,
                totalRevenue: this.data.totalRevenue,
                createTime: new Date().toISOString(),
                status: '已交付'
            };
            console.log('提交出栏记录数据:', submitData);
            // 调用出栏云函数提交数据
            const result = await wx.cloud.callFunction({
                name: 'production-exit',
                data: {
                    action: 'create',
                    recordData: {
                        batchNumber: this.getBatchNumberForSubmission(submitData.batchId), // 修复：获取正确的批次号
                        exitDate: submitData.exitDate,
                        type: submitData.type,
                        customer: submitData.customer,
                        quantity: submitData.quantity,
                        avgWeight: submitData.avgWeight,
                        unitPrice: submitData.unitPrice,
                        notes: submitData.remarks,
                        totalWeight: submitData.totalWeight,
                        totalRevenue: submitData.totalRevenue,
                        status: submitData.status
                    }
                }
            });
            if (!result.result.success) {
                throw new Error(result.result.message || '提交失败');
            }
            // 提交成功
            wx.showToast({
                title: '出栏记录提交成功',
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
            console.error('提交出栏记录失败:', error);
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
    // 重置表单
    onReset() {
        wx.showModal({
            title: '确认重置',
            content: '确定要重置表单吗？所有已填写的数据将被清空。',
            success: (res) => {
                if (res.confirm) {
                    // 重置表单数据（保留日期和批次ID）
                    const currentDate = this.data.formData.exitDate;
                    const currentBatchId = this.data.formData.batchId;
                    this.setData({
                        formData: {
                            batchId: currentBatchId,
                            exitDate: currentDate,
                            type: '',
                            customer: '',
                            quantity: '',
                            avgWeight: '',
                            unitPrice: '',
                            remarks: ''
                        },
                        totalWeight: '0.00',
                        totalRevenue: '0.00'
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
            title: '出栏记录表单',
            path: '/pages/exit-form/exit-form',
            imageUrl: '' // 可以设置分享图片
        };
    }
};
// 使用导航栏适配工具创建页面
Page((0, navigation_1.createPageWithNavbar)(pageConfig));
