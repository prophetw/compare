<template>
  <form class="form" @submit.prevent="handleSubmit">
    <label>
      邮箱
      <input v-model="state.email" type="email" required placeholder="demo@example.com" />
    </label>

    <label>
      密码
      <input v-model="state.password" type="password" required placeholder="••••••" />
    </label>

    <button type="submit" :disabled="state.loading">
      {{ state.loading ? '登录中...' : '登录' }}
    </button>

    <p v-if="state.error" class="error">{{ state.error }}</p>
  </form>
</template>

<script setup lang="ts">
import axios from 'axios';
import { reactive } from 'vue';

type LoginResponse = {
  token: string;
  user: {
    email: string;
  };
};

const emit = defineEmits<{
  success: [payload: LoginResponse];
}>();

const state = reactive({
  email: 'demo@example.com',
  password: 'secret',
  loading: false,
  error: ''
});

async function handleSubmit() {
  state.error = '';
  state.loading = true;
  try {
    const { data } = await axios.post<LoginResponse>('/api/auth/login', {
      email: state.email,
      password: state.password
    });
    emit('success', data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      state.error = (error.response?.data as { message?: string })?.message ?? '登录失败';
    } else {
      state.error = '网络错误，请稍后重试';
    }
  } finally {
    state.loading = false;
  }
}
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

label {
  display: flex;
  flex-direction: column;
  font-weight: 600;
  gap: 6px;
  color: #0f172a;
}

input {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #cbd5f5;
  font-size: 16px;
}

button {
  cursor: pointer;
  border: none;
  border-radius: 999px;
  padding: 12px;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: white;
  font-weight: 700;
  transition: opacity 0.2s ease;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #dc2626;
  font-size: 14px;
}
</style>
