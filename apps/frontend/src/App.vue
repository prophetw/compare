<template>
  <RouterView @login-success="handleLoginSuccess" />
</template>

<script setup lang="ts">
import { RouterView, useRouter } from 'vue-router';

type LoginSuccessPayload = {
  token: string;
  user: {
    email: string;
  };
};

const router = useRouter();

function handleLoginSuccess(_payload: LoginSuccessPayload) {
  router.push({ name: 'config' });
}
</script>
