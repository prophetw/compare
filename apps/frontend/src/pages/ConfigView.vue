<template>
  <main class="config-page">
    <section class="panel">
      <header>
        <h1>配置参数</h1>
        <p>填写 BimEngine 相关配置或粘贴 JSON，一键进入对比页面。</p>
      </header>

      <div class="config-layout">
        <form class="form" @submit.prevent="handleSubmit">
          <label>
            应用名称
            <input v-model="form.appName" type="text" required placeholder="请输入应用名称" />
          </label>

          <label>
            Server URL
            <input v-model="form.serverUrl" type="url" required placeholder="https://example.com" />
          </label>

          <label>
            App ID
            <input v-model="form.appId" type="text" required placeholder="App ID" />
          </label>

          <label>
            Secret
            <input v-model="form.secret" type="text" required placeholder="Secret" />
          </label>

          <label>
            SDK URL
            <input v-model="form.sdkUrl" type="text" required placeholder="/engine-sdk" />
          </label>

          <button type="submit">确认，前往对比</button>
        </form>

        <section class="json-panel">
          <label>
            JSON 配置
            <textarea
              v-model="jsonInput"
              class="json-textarea"
              placeholder='{
  "appName": "示例"
}'
            ></textarea>
          </label>
          <p v-if="jsonError" class="json-error">{{ jsonError }}</p>
        </section>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { setViewerConfig, useViewerConfig, type ViewerConfig } from '@/stores/viewerConfig';

const router = useRouter();
const { config } = useViewerConfig();

const form = reactive<ViewerConfig>({ ...config.value });
const jsonInput = ref('');
const jsonError = ref('');
let syncingFromJson = false;
let syncingFromForm = false;

watch(
  form,
  () => {
    if (syncingFromJson) {
      return;
    }
    syncingFromForm = true;
    jsonError.value = '';
    jsonInput.value = JSON.stringify(form, null, 2);
    syncingFromForm = false;
  },
  { deep: true, immediate: true }
);

watch(jsonInput, (value) => {
  if (syncingFromForm) {
    return;
  }
  if (!value.trim()) {
    jsonError.value = 'JSON 不能为空';
    return;
  }
  try {
    const parsed = JSON.parse(value);
    const normalized = normalizeConfig(parsed);
    syncingFromJson = true;
    Object.assign(form, normalized);
    jsonError.value = '';
  } catch (error) {
    jsonError.value = error instanceof Error ? error.message : 'JSON 解析失败';
  } finally {
    syncingFromJson = false;
  }
});

function handleSubmit() {
  setViewerConfig({
    appName: form.appName.trim(),
    serverUrl: form.serverUrl.trim(),
    appId: form.appId.trim(),
    secret: form.secret.trim(),
    sdkUrl: form.sdkUrl.trim()
  });
  router.push({ name: 'compare' });
}

function normalizeConfig(input: unknown): ViewerConfig {
  if (!isRecord(input)) {
    throw new Error('JSON 必须是对象');
  }
  return {
    appName: pickString(input.appName) ?? form.appName,
    serverUrl: pickString(input.serverUrl) ?? form.serverUrl,
    appId: pickString(input.appId) ?? form.appId,
    secret: pickString(input.secret) ?? form.secret,
    sdkUrl: pickString(input.sdkUrl) ?? form.sdkUrl
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pickString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}
</script>

<style scoped>
.config-page {
  width: 100%;
  min-height: 100vh;
  padding: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
}

.panel {
  width: min(960px, 100%);
  padding: 32px;
  border-radius: 24px;
  background: white;
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.1);
}

header {
  margin-bottom: 24px;
}

header h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

header p {
  margin: 0;
  color: #475569;
}

.config-layout {
  display: flex;
  flex-direction: row;
  gap: 24px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1 1 50%;
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
  margin-top: 8px;
  cursor: pointer;
  border: none;
  border-radius: 999px;
  padding: 12px;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: white;
  font-weight: 700;
  transition: opacity 0.2s ease;
}

.json-panel {
  flex: 1 1 50%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.json-textarea {
  min-height: 320px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid #cbd5f5;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 14px;
  resize: vertical;
}

.json-error {
  margin: 0;
  color: #dc2626;
  font-size: 14px;
}

@media (max-width: 960px) {
  .config-layout {
    flex-direction: column;
  }

  .json-textarea {
    min-height: 200px;
  }
}
</style>
