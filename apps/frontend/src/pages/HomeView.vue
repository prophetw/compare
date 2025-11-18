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

function handleSuccess(payload: { token: string; user: { email: string } }) {
  message.value = `欢迎 ${payload.user.email}，令牌：${payload.token}`;
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
}

.panel {
  width: min(480px, 100%);
  padding: 32px;
  border-radius: 24px;
  background: white;
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.15);
}

header {
  margin-bottom: 24px;
}

h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

p {
  margin: 0;
  color: #475569;
}

.message {
  margin-top: 16px;
  font-weight: 600;
  color: #059669;
}
</style>
