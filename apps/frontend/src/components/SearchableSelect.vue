<template>
  <div class="searchable-select" ref="containerRef">
    <button
      type="button"
      class="trigger"
      :class="{ active: isOpen }"
      @click="toggleDropdown"
      :disabled="disabled"
    >
      <span class="trigger-text">{{ selectedLabel || placeholder }}</span>
      <svg
        class="chevron"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>

    <div v-if="isOpen" class="dropdown-menu">
      <div class="search-box">
        <input
          ref="searchInputRef"
          type="text"
          v-model="searchQuery"
          placeholder="搜索场景..."
          @input="handleSearch"
        />
      </div>

      <div class="options-list" v-if="!loading">
        <div
          v-for="item in items"
          :key="item.value"
          class="option-item"
          :class="{ selected: item.value === modelValue }"
          @click="selectItem(item)"
        >
          <img
            v-if="item.image"
            :src="item.image"
            alt=""
            class="option-thumb"
            loading="lazy"
          />
          <span class="option-label">{{ item.label }}</span>
          <span v-if="item.value === modelValue" class="check-icon">✓</span>
        </div>
        <div v-if="items.length === 0" class="no-results">
          无匹配结果
        </div>
      </div>
      
      <div v-else class="loading-state">
        加载中...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';

export interface SelectItem {
  label: string;
  value: string;
  image?: string;
}

const props = defineProps<{
  modelValue?: string;
  items: SelectItem[];
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'search', query: string): void;
}>();

const isOpen = ref(false);
const searchQuery = ref('');
const containerRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);

const selectedLabel = computed(() => {
  const found = props.items.find(i => i.value === props.modelValue);
  return found ? found.label : '';
});

function toggleDropdown() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  }
}

function selectItem(item: SelectItem) {
  emit('update:modelValue', item.value);
  isOpen.value = false;
}

let searchTimeout: number | null = null;
function handleSearch() {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = window.setTimeout(() => {
    emit('search', searchQuery.value);
  }, 300);
}

// Close on click outside
function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.searchable-select {
  position: relative;
  width: 240px;
  font-family: 'Inter', sans-serif;
}

.trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.trigger:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.trigger.active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
}

.trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.trigger-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chevron {
  margin-left: 8px;
  opacity: 0.7;
  transition: transform 0.2s;
}

.trigger.active .chevron {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  width: 320px; /* Wider than trigger to show details */
  margin-top: 4px;
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  z-index: 50;
  overflow: hidden;
  animation: fadeIn 0.2s ease-out;
}

.search-box {
  padding: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.search-box input {
  width: 100%;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: white;
  font-size: 13px;
  outline: none;
}

.search-box input:focus {
  border-color: #3b82f6;
}

.options-list {
  max-height: 300px;
  overflow-y: auto;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
  gap: 10px;
}

.option-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.option-item.selected {
  background: rgba(59, 130, 246, 0.15);
}

.option-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  background: #334155;
}

.option-label {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.check-icon {
  color: #3b82f6;
  font-weight: bold;
}

.no-results, .loading-state {
  padding: 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Scrollbar styling */
.options-list::-webkit-scrollbar {
  width: 6px;
}
.options-list::-webkit-scrollbar-track {
  background: transparent;
}
.options-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}
</style>
