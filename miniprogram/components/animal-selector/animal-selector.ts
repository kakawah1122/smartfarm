// animal-selector.ts - 动物选择器组件
Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  properties: {
    // 选中的动物ID列表
    value: {
      type: Array,
      value: []
    },
    // 是否多选
    multiple: {
      type: Boolean,
      value: false
    },
    // 最大选择数量
    max: {
      type: Number,
      value: 0
    },
    // 是否显示搜索框
    showSearch: {
      type: Boolean,
      value: true
    },
    // 占位符文本
    placeholder: {
      type: String,
      value: '请选择动物'
    },
    // 是否禁用
    disabled: {
      type: Boolean,
      value: false
    }
  },

  data: {
    visible: false,
    searchValue: '',
    animalList: [],
    filteredList: [],
    selectedAnimals: [],
    loading: false
  },

  observers: {
    'value': function(newVal) {
      this.loadSelectedAnimals(newVal)
    }
  },

  lifetimes: {
    attached() {
      this.loadAnimals()
    }
  },

  methods: {
    // 加载动物列表
    async loadAnimals() {
      this.setData({ loading: true })
      
      try {
        const result = await wx.cloud.callFunction({
          name: 'animal-management',
          data: {
            action: 'list_animals',
            status: 'active' // 只获取存活的动物
          }
        })

        if (result.result && result.result.success) {
          const animals = result.result.data.animals || []
          this.setData({
            animalList: animals,
            filteredList: animals
          })
        }
      } catch (error) {
        // 已移除调试日志
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      } finally {
        this.setData({ loading: false })
      }
    },

    // 根据选中的ID加载动物详情
    async loadSelectedAnimals(animalIds) {
      if (!animalIds || animalIds.length === 0) {
        this.setData({ selectedAnimals: [] })
        return
      }

      try {
        const result = await wx.cloud.callFunction({
          name: 'animal-management',
          data: {
            action: 'get_animals_by_ids',
            animalIds: animalIds
          }
        })

        if (result.result && result.result.success) {
          this.setData({
            selectedAnimals: result.result.data.animals || []
          })
        }
      } catch (error) {
        // 已移除调试日志
      }
    },

    // 显示选择器
    show() {
      if (this.data.disabled) return
      
      this.setData({ 
        visible: true,
        searchValue: '',
        filteredList: this.data.animalList
      })
    },

    // 隐藏选择器
    hide() {
      this.setData({ visible: false })
    },

    // 搜索动物
    onSearch(e) {
      const { value } = e.detail
      this.setData({ searchValue: value })
      this.filterAnimals(value)
    },

    // 过滤动物列表
    filterAnimals(keyword) {
      const { animalList } = this.data
      
      if (!keyword.trim()) {
        this.setData({ filteredList: animalList })
        return
      }

      const filtered = animalList.filter(animal => {
        return animal.animalId.toLowerCase().includes(keyword.toLowerCase()) ||
               animal.breed?.toLowerCase().includes(keyword.toLowerCase()) ||
               animal.location?.toLowerCase().includes(keyword.toLowerCase())
      })

      this.setData({ filteredList: filtered })
    },

    // 选择动物
    onSelectAnimal(e) {
      const { animal } = e.currentTarget.dataset
      const { value, multiple, max } = this.data
      let newValue = [...value]

      if (multiple) {
        const index = newValue.indexOf(animal._id)
        if (index > -1) {
          // 取消选择
          newValue.splice(index, 1)
        } else {
          // 添加选择
          if (max > 0 && newValue.length >= max) {
            wx.showToast({
              title: `最多选择${max}个`,
              icon: 'none'
            })
            return
          }
          newValue.push(animal._id)
        }
      } else {
        // 单选
        newValue = [animal._id]
        this.hide()
      }

      this.triggerEvent('change', {
        value: newValue,
        animals: this.getAnimalsByIds(newValue)
      })
    },

    // 根据ID获取动物信息
    getAnimalsByIds(ids) {
      const { animalList } = this.data
      return animalList.filter(animal => ids.includes(animal._id))
    },

    // 确认选择
    onConfirm() {
      this.hide()
    },

    // 清空选择
    onClear() {
      this.triggerEvent('change', {
        value: [],
        animals: []
      })
    },

    // 检查是否选中
    isSelected(animalId) {
      return this.data.value.includes(animalId)
    },

    // 获取显示文本
    getDisplayText() {
      const { selectedAnimals, placeholder, multiple } = this.data
      
      if (selectedAnimals.length === 0) {
        return placeholder
      }

      if (multiple) {
        return `已选择${selectedAnimals.length}个动物`
      } else {
        return selectedAnimals[0]?.animalId || placeholder
      }
    }
  }
})
