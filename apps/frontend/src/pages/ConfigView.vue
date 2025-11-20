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
  animation: fadeIn 0.6s ease-out;
}

.panel {
  width: min(1000px, 100%);
  padding: 40px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.85);
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

header h1 {
  margin: 0 0 12px;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

header p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.6;
}

.config-layout {
  display: flex;
  flex-direction: row;
  gap: 32px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1 1 50%;
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

button {
  margin-top: 8px;
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

button:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg), var(--shadow-glow);
}

button:hover::before {
  opacity: 1;
}

button:active {
  transform: translateY(0);
}

.json-panel {
  flex: 1 1 50%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.json-textarea {
  min-height: 380px;
  padding: 16px;
  border-radius: 12px;
  border: 2px solid var(--color-border);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  transition: all var(--transition-base);
  box-shadow: var(--shadow-sm);
}

.json-textarea:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.json-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1), var(--shadow-md);
}

.json-error {
  margin: 0;
  color: var(--color-error);
  font-size: 14px;
  font-weight: 500;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
  border-left: 3px solid var(--color-error);
  animation: slideUp 0.3s ease-out;
}

@media (max-width: 960px) {
  .config-layout {
    flex-direction: column;
  }

  .json-textarea {
    min-height: 240px;
  }
  
  .panel {
    padding: 28px;
  }
}
</style>
