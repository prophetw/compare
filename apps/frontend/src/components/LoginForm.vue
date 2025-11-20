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
  gap: 20px;
  animation: fadeIn 0.4s ease-out;
}

label {
  display: flex;
  flex-direction: column;
  font-weight: 600;
  gap: 8px;
  color: var(--color-text-primary);
  font-size: 14px;
  letter-spacing: -0.01em;
}

input {
  padding: 14px 16px;
  border-radius: 12px;
  border: 2px solid var(--color-border);
  font-size: 16px;
  font-family: inherit;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  transition: all var(--transition-base);
  box-shadow: var(--shadow-sm);
}

input:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1), var(--shadow-md);
  transform: translateY(-2px);
}

input::placeholder {
  color: var(--color-text-secondary);
  opacity: 0.6;
}

button {
  cursor: pointer;
  border: none;
  border-radius: 12px;
  padding: 14px 24px;
  background: var(--gradient-primary);
  color: white;
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.01em;
  transition: all var(--transition-base);
  box-shadow: var(--shadow-md);
  position: relative;
  overflow: hidden;
}

button::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), transparent);
  opacity: 0;
  transition: opacity var(--transition-base);
}

button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg), var(--shadow-glow);
}

button:hover:not(:disabled)::before {
  opacity: 1;
}

button:active:not(:disabled) {
  transform: translateY(0);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  animation: pulse 1.5s ease-in-out infinite;
}

.error {
  color: var(--color-error);
  font-size: 14px;
  font-weight: 500;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
  border-left: 3px solid var(--color-error);
  animation: slideUp 0.3s ease-out;
  margin: 0;
}
</style>

