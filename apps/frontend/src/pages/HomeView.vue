<template>
  <main class="home">
    <section class="panel">
      <header>
        <h1>通用管理系统</h1>
        <p>通过 Express API 登录，示例演示如何串联前后端。</p>
      </header>
      <LoginForm @success="handleSuccess" />
      <p v-if="message" class="message">{{ message }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import LoginForm from '@/components/LoginForm.vue';

const message = ref('');
const emit = defineEmits<{
  'login-success': [payload: { token: string; user: { email: string } }];
}>();

function handleSuccess(payload: { token: string; user: { email: string } }) {
  message.value = `欢迎 ${payload.user.email}，令牌：${payload.token}`;
  emit('login-success', payload);
}
</script>

<style scoped>
.home {
  width: 100%;
  min-height: 100vh;
  padding: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.6s ease-out;
}

.panel {
  width: min(520px, 100%);
  padding: 40px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(37, 99, 235, 0.1);
  position: relative;
  overflow: hidden;
}

.panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--gradient-primary);
}

header {
  margin-bottom: 32px;
}

h1 {
  margin: 0 0 12px;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.6;
}

.message {
  margin-top: 20px;
  font-weight: 600;
  color: var(--color-success);
  padding: 16px 20px;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 12px;
  border-left: 4px solid var(--color-success);
  animation: slideUp 0.4s ease-out;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-all;
}
</style>
