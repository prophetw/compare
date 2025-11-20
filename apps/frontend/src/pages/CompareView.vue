<template>
  <section class="compare-page">
    <div class="viewer-stack" :class="viewerStackClasses" ref="viewerHostRef">
      <div id="engineContainer" class="viewer primary"></div>
      <div
        id="engineContainer2"
        class="viewer secondary"
        ref="secondContainerRef"
        :style="sliderVisible ? undefined : secondaryHiddenStyle"
      ></div>
      <div
        v-if="isOverlayMode && sliderVisible"
        ref="sliderRef"
        class="slider"
        :class="{ vertical: sliderDirection === 'vertical' }"
      ></div>
    </div>

    <div class="toolbar">
      <span class="description">{{ appDisplayName }} · 双视口视口同步</span>
      <span class="controls">
        <select v-model="comparisonMode">
          <option value="overlay">卷帘模式</option>
          <option value="split">分屏模式</option>
        </select>
        <select v-model="sliderDirection" :disabled="isOverlayMode && !sliderVisible">
          <option value="vertical">上下方向</option>
          <option value="horizontal">左右方向</option>
        </select>

        <div class="toggle-group">
          <label :class="{ active: projectType === 'model' }">
            <input type="radio" v-model="projectType" value="model" /> 模型列表
          </label>
          <label :class="{ active: projectType === 'scene' }">
            <input type="radio" v-model="projectType" value="scene" /> 场景列表
          </label>
        </div>
        
        <div class="group">
          <SearchableSelect
            v-model="selectedPrimaryId"
            :items="projectOptions"
            :loading="loading.projects"
            placeholder="选择主场景"
            @search="handleProjectSearch"
          />
          <button type="button" @click="mountPrimary" :disabled="loading.primary || !selectedPrimaryId">
            {{ loading.primary ? '加载...' : '加载' }}
          </button>
        </div>

        <div class="group">
          <SearchableSelect
            v-model="selectedSecondaryId"
            :items="projectOptions"
            :loading="loading.projects"
            placeholder="选择副场景"
            @search="handleProjectSearch"
          />
          <button type="button" @click="mountSecondary" :disabled="loading.secondary || !selectedSecondaryId">
            {{ loading.secondary ? '加载...' : '加载' }}
          </button>
        </div>

        <button type="button" @click="handleTeardown" :disabled="loading.teardown">
          {{ loading.teardown ? '卸载中…' : '卸载' }}
        </button>
        <button type="button" @click="compareNext" :disabled="!sliderVisible">
          对比点
        </button>
      </span>
    </div>

    <p v-if="statusMessage" class="status">{{ statusMessage }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import BimEngine from 'BimEngine';
import { defaultViewerConfig, useViewerConfig } from '@/stores/viewerConfig';
import { fetchToken, fetchProjects, getPreviewImageUrl, type ProjectItem } from '@/services/projectService';
import SearchableSelect, { type SelectItem } from '@/components/SearchableSelect.vue';

type BimEngineNamespace = typeof BimEngine;

const USE_UE = false;

const router = useRouter();
const { config: viewerConfig, confirmed } = useViewerConfig();

if (!confirmed.value) {
  router.replace({ name: 'config' });
}

const fallbackServerUrl = defaultViewerConfig.serverUrl;
const fallbackAppId = defaultViewerConfig.appId;
const fallbackSecret = defaultViewerConfig.secret;
const STATIC_SDK_BASE = './static';

const serverBaseUrl = computed(() => normalizeBaseUrl(viewerConfig.value.serverUrl, fallbackServerUrl));
const normalizedAppId = computed(() => ensureValue(viewerConfig.value.appId, fallbackAppId));
const normalizedSecret = computed(() => ensureValue(viewerConfig.value.secret, fallbackSecret));
const appDisplayName = computed(() => ensureValue(viewerConfig.value.appName, defaultViewerConfig.appName));

const statusMessage = ref('');
const sliderDirection = ref<'vertical' | 'horizontal'>('vertical');
const comparisonMode = ref<'overlay' | 'split'>('overlay');
const isOverlayMode = computed(() => comparisonMode.value === 'overlay');
const sliderVisible = ref(false);
const sliderPercent = ref(50);
const secondaryHiddenStyle = Object.freeze({ clipPath: 'none' });
const viewerStackClasses = computed(() => ({
  overlay: isOverlayMode.value,
  split: !isOverlayMode.value,
  'split-vertical': !isOverlayMode.value && sliderDirection.value === 'vertical',
  'split-horizontal': !isOverlayMode.value && sliderDirection.value === 'horizontal'
}));

const viewerHostRef = ref<HTMLDivElement | null>(null);
const sliderRef = ref<HTMLDivElement | null>(null);
const secondContainerRef = ref<HTMLDivElement | null>(null);

const loading = reactive({
  primary: false,
  secondary: false,
  teardown: false,
  projects: false
});

const projectType = ref<'model' | 'scene'>('model');
const projects = ref<ProjectItem[]>([]);
const accessToken = ref('');
const selectedPrimaryId = ref('');
const selectedSecondaryId = ref('');

const projectOptions = computed<SelectItem[]>(() => {
  return projects.value.map(p => ({
    label: p.name,
    value: p.guid,
    image: getPreviewImageUrl(serverBaseUrl.value, p.previewImage)
  }));
});

let engineBaseApplied: string | null = null;

const globalStore = {
  firstMotorViewerInstance: null as MotorViewerInstance | null,
  secondMotorViewerInstance: null as MotorViewerInstance | null,
  cameraSyncEvt: null as ReturnType<typeof syncCameras> | null
};

class MotorViewerInstance {
  public viewer?: InstanceType<BimEngineNamespace['Viewer']>;
  public project?: InstanceType<BimEngineNamespace['Project']>;
  public readonly isUseUE: boolean;
  public readonly openId: string;
  private readonly container: string;
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly secret: string;
  private readonly token?: string;
  private readonly websocketUrl?: string;
  private readonly streamUrl?: string;
  private readonly projectType: 'model' | 'scene';

  constructor(private readonly engine: BimEngineNamespace, options: MotorViewerOptions) {
    this.openId = options.openId;
    this.container = options.container;
    this.baseUrl = options.baseUrl;
    this.appId = options.appId;
    this.secret = options.secret;
    this.isUseUE = options.useUE;
    this.token = options.token;
    this.websocketUrl = options.websocketUrl;
    this.streamUrl = options.streamUrl;
    this.projectType = options.projectType || 'model';
  }

  initViewer() {
    if (this.viewer) {
      return this.viewer;
    }
    const viewer = new this.engine.Viewer({
      container: this.container,
      baseUrl: this.baseUrl,
      appId: this.appId,
      secret: this.secret,
      useUE: this.isUseUE,
      token: this.token,
      openId: this.openId,
      openType: 'project',
      websocketUrl: this.websocketUrl,
      streamUrl: this.streamUrl
    });
    this.viewer = viewer;
    return viewer;
  }

  async openProject() {
    if (this.project) {
      return this.project;
    }
    const viewer = this.initViewer();
    await viewer.Init();
    
    let project;
    if (this.projectType === 'model') {
      // Model Project opening logic
      const result = await viewer.openModelProject(this.openId, true, this.token || '');
      if (result) {
        project = result.project;
      }
    } else {
      // Scene Project opening logic
      project = await viewer.queryProject(this.openId);
      if (project) {
        await project.open();
      }
    }

    if (!project) {
      throw new Error('未找到项目');
    }
    this.project = project;
    return project;
  }

  destroy() {
    this.viewer?.destroy();
    this.viewer = undefined;
    this.project = undefined;
  }
}

type MotorViewerOptions = {
  baseUrl: string;
  appId: string;
  secret: string;
  openId: string;
  container: string;
  useUE: boolean;
  token?: string;
  websocketUrl?: string;
  streamUrl?: string;
  projectType?: 'model' | 'scene';
};

function ensureValue(value: string | undefined, fallback: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed || fallback;
}

function normalizeBaseUrl(value: string | undefined, fallback: string) {
  const ensured = ensureValue(value, fallback);
  if (ensured === '/') {
    return ensured;
  }
  return ensured.replace(/\/+$/, '');
}


function ensureEngine() {
  const baseUrl = STATIC_SDK_BASE;
  if (engineBaseApplied !== baseUrl) {
    BimEngine.setBaseUrl(baseUrl);
    engineBaseApplied = baseUrl;
  }
  return BimEngine;
}

async function mountPrimary() {
  if (loading.primary) {
    return;
  }
  if (!selectedPrimaryId.value) {
    statusMessage.value = '请先选择主场景';
    return;
  }
  try {
    loading.primary = true;
    statusMessage.value = '正在打开主场景…';
    const engine = ensureEngine();
    let instance = globalStore.firstMotorViewerInstance;
    if (!instance) {
      instance = new MotorViewerInstance(engine, {
        baseUrl: serverBaseUrl.value,
        appId: normalizedAppId.value,
        secret: normalizedSecret.value,
        openId: selectedPrimaryId.value,
        container: 'engineContainer',
        useUE: USE_UE,
        projectType: projectType.value
      });
      globalStore.firstMotorViewerInstance = instance;
    }
    await instance.openProject();
    statusMessage.value = '主场景已加载';
  } catch (error) {
    statusMessage.value = getErrorMessage(error);
  } finally {
    loading.primary = false;
  }
}

async function mountSecondary() {
  if (loading.secondary) {
    return;
  }
  if (!selectedSecondaryId.value) {
    statusMessage.value = '请先选择副场景';
    return;
  }
  if (!globalStore.firstMotorViewerInstance?.project) {
    statusMessage.value = '请先打开主场景';
    return;
  }
  try {
    loading.secondary = true;
    statusMessage.value = '正在打开卷帘副场景…';
    const engine = ensureEngine();
    if (globalStore.secondMotorViewerInstance?.project) {
      statusMessage.value = '副场景已打开';
      return;
    }
    const instance = new MotorViewerInstance(engine, {
      baseUrl: serverBaseUrl.value,
      appId: normalizedAppId.value,
      secret: normalizedSecret.value,
      openId: selectedSecondaryId.value,
      container: 'engineContainer2',
      useUE: USE_UE,
      projectType: projectType.value
    });
    globalStore.secondMotorViewerInstance = instance;
    const firstViewer = globalStore.firstMotorViewerInstance;
    instance.initViewer();

    const adjustInterval = window.setInterval(() => {
      if (firstViewer?.viewer) {
        adjustViewerCss(firstViewer, instance);
      }
    }, 50);

    await instance.openProject();
    window.clearInterval(adjustInterval);

    if (firstViewer?.viewer) {
      globalStore.cameraSyncEvt = syncCameras(firstViewer, instance);
      globalStore.cameraSyncEvt.addListeners();
    }

    await enableSlider();
    statusMessage.value = '卷帘副场景已加载';
  } catch (error) {
    statusMessage.value = getErrorMessage(error);
  } finally {
    loading.secondary = false;
  }
}

async function handleTeardown() {
  if (loading.teardown) {
    return;
  }
  try {
    loading.teardown = true;
    await teardownViewers();
    statusMessage.value = '已卸载场景';
  } catch (error) {
    statusMessage.value = getErrorMessage(error);
  } finally {
    loading.teardown = false;
  }
}

async function teardownViewers() {
  restoreViewerCss(globalStore.firstMotorViewerInstance, globalStore.secondMotorViewerInstance);
  globalStore.cameraSyncEvt?.removeListeners();
  globalStore.cameraSyncEvt = null;

  globalStore.secondMotorViewerInstance?.destroy();
  globalStore.secondMotorViewerInstance = null;

  globalStore.firstMotorViewerInstance?.destroy();
  globalStore.firstMotorViewerInstance = null;

  disableSlider();
}

function compareNext() {
  if (!sliderVisible.value) {
    statusMessage.value = '请先打开卷帘副场景';
    return;
  }
  statusMessage.value = '对比点功能暂未在 demo 中提供数据源';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return '操作失败';
}

let sliderEventsCleanup: (() => void) | null = null;
let resizeCleanup: (() => void) | null = null;
let isDragging = false;

async function enableSlider() {
  if (!isOverlayMode.value) {
    sliderVisible.value = false;
    clearClipPaths();
    return;
  }
  sliderVisible.value = true;
  sliderPercent.value = 50;
  await nextTick();
  registerSliderEvents();
  registerResizeListener();
  refreshSliderPosition();
}

function disableSlider() {
  sliderVisible.value = false;
  sliderPercent.value = 50;
  sliderEventsCleanup?.();
  sliderEventsCleanup = null;
  resizeCleanup?.();
  resizeCleanup = null;
  isDragging = false;
  clearClipPaths();
}

function registerSliderEvents() {
  const sliderEl = sliderRef.value;
  if (!sliderEl) {
    return;
  }
  sliderEventsCleanup?.();

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    isDragging = true;
    sliderEl.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!isDragging) {
      return;
    }
    if (sliderDirection.value === 'vertical') {
      setSliderPosition(event.clientY, true);
    } else {
      setSliderPosition(event.clientX, false);
    }
  };

  const stopDragging = (event: PointerEvent) => {
    if (!isDragging) {
      return;
    }
    isDragging = false;
    sliderEl.releasePointerCapture(event.pointerId);
  };

  sliderEl.addEventListener('pointerdown', onPointerDown);
  sliderEl.addEventListener('pointermove', onPointerMove);
  sliderEl.addEventListener('pointerup', stopDragging);
  sliderEl.addEventListener('pointercancel', stopDragging);

  sliderEventsCleanup = () => {
    sliderEl.removeEventListener('pointerdown', onPointerDown);
    sliderEl.removeEventListener('pointermove', onPointerMove);
    sliderEl.removeEventListener('pointerup', stopDragging);
    sliderEl.removeEventListener('pointercancel', stopDragging);
  };
}

function registerResizeListener() {
  resizeCleanup?.();
  const handler = () => refreshSliderPosition();
  window.addEventListener('resize', handler);
  resizeCleanup = () => window.removeEventListener('resize', handler);
}

function refreshSliderPosition() {
  const host = viewerHostRef.value;
  if (!host || !sliderVisible.value) {
    return;
  }
  const rect = host.getBoundingClientRect();
  if (sliderDirection.value === 'vertical') {
    const y = rect.top + (sliderPercent.value / 100) * rect.height;
    setSliderPosition(y, true);
  } else {
    const x = rect.left + (sliderPercent.value / 100) * rect.width;
    setSliderPosition(x, false);
  }
}

function setSliderPosition(clientPos: number, isVerticalDirection: boolean) {
  const host = viewerHostRef.value;
  const sliderEl = sliderRef.value;
  const secondContainer = secondContainerRef.value;
  if (!host || !sliderEl || !secondContainer) {
    return;
  }
  const rect = host.getBoundingClientRect();
  let percentage = 0;

  if (isVerticalDirection) {
    let offset = clientPos - rect.top;
    if (offset < 0) offset = 0;
    if (offset > rect.height) offset = rect.height;
    percentage = (offset / rect.height) * 100;
    sliderEl.style.top = `${percentage}%`;
    sliderEl.style.left = '0';
    sliderEl.style.transform = 'translateY(-50%)';
    secondContainer.style.clipPath = `inset(${percentage}% 0 0 0)`;
  } else {
    let offset = clientPos - rect.left;
    if (offset < 0) offset = 0;
    if (offset > rect.width) offset = rect.width;
    percentage = (offset / rect.width) * 100;
    sliderEl.style.left = `${percentage}%`;
    sliderEl.style.top = '0';
    sliderEl.style.transform = 'translateX(-50%)';
    secondContainer.style.clipPath = `inset(0 0 0 ${percentage}%)`;
  }

  sliderPercent.value = percentage;
  applyClipToUE(percentage, isVerticalDirection);
}

function applyClipToUE(percentage: number, isVerticalDirection: boolean) {
  const secondViewer = globalStore.secondMotorViewerInstance?.viewer;
  if (!secondViewer?.isUseUE) {
    return;
  }
  const ueContainer = secondViewer.ueViewer?.ueContainer as HTMLElement | undefined;
  if (!ueContainer) {
    return;
  }
  if (isVerticalDirection) {
    ueContainer.style.clipPath = `inset(${percentage}% 0 0 0)`;
  } else {
    ueContainer.style.clipPath = `inset(0 0 0 ${percentage}%)`;
  }
}

function clearClipPaths() {
  if (secondContainerRef.value) {
    secondContainerRef.value.style.clipPath = '';
  }
  const ueContainer = globalStore.secondMotorViewerInstance?.viewer?.ueViewer?.ueContainer as
    | HTMLElement
    | undefined;
  ueContainer && (ueContainer.style.clipPath = '');
}

function adjustViewerCss(viewer1: MotorViewerInstance, viewer2: MotorViewerInstance) {
  if (viewer1.viewer?.ueViewer && viewer1.isUseUE && viewer1.viewer.ueViewer.ueContainer) {
    viewer1.viewer.ueViewer.ueContainer.style.width = '100%';
  }
  if (viewer2.viewer?.ueViewer && viewer2.isUseUE && viewer2.viewer.ueViewer.ueContainer) {
    viewer2.viewer.ueViewer.ueContainer.style.width = '100%';
    viewer2.viewer.ueViewer.ueContainer.style.right = '0';
    viewer2.viewer.ueViewer.ueContainer.style.left = 'auto';
  }
}

function restoreViewerCss(viewer1?: MotorViewerInstance | null, viewer2?: MotorViewerInstance | null) {
  viewer1?.viewer && (viewer1.viewer.container.style.width = '100%');
  const second = viewer2?.viewer;
  if (second?.container) {
    second.container.style.width = '0';
    second.container.style.zIndex = '-999';
  }
  if (second?.ueViewer?.ueContainer) {
    second.ueViewer.ueContainer.style.width = '100%';
    second.ueViewer.ueContainer.remove();
  }
}

function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {
  let timeout: ReturnType<typeof window.setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) {
      window.clearTimeout(timeout);
    }
    timeout = window.setTimeout(() => {
      timeout = null;
      fn(...args);
    }, wait);
  };
}

function syncCameras(viewer1: MotorViewerInstance, viewer2: MotorViewerInstance) {
  let isSyncing = false;
  let handlers: Array<{ viewer: MotorViewerInstance; handler: () => void }> = [];

  const onViewChangedCesium = (source: MotorViewerInstance, target: MotorViewerInstance) => {
    if (isSyncing) {
      return;
    }
    isSyncing = true;
    const sourceViewer = source.viewer;
    const targetViewer = target.viewer;
    const sourceVp = sourceViewer?.camera?.getViewPosition?.();
    if (sourceVp && targetViewer?.camera?.setViewToViewPosition) {
      targetViewer.camera.setViewToViewPosition(sourceVp);
    }
    isSyncing = false;
  };

  const onViewChanged = async (source: MotorViewerInstance, target: MotorViewerInstance) => {
    if (isSyncing) {
      return;
    }
    isSyncing = true;
    try {
      const sourceViewer = source.viewer;
      const targetViewer = target.viewer;
      const sourceVp = await sourceViewer?.camera?.getViewPositionAdapter?.();
      if (sourceVp && targetViewer?.camera?.setViewToViewPosition) {
        targetViewer.camera.setViewToViewPosition(sourceVp);
      }
    } catch (error) {
      console.error('同步视角时出错', error);
    } finally {
      isSyncing = false;
    }
  };

  const debouncedOnViewChanged = debounce((source: MotorViewerInstance, target: MotorViewerInstance) => {
    void onViewChanged(source, target);
  }, 50);

  const addListeners = () => {
    const first = viewer1.viewer;
    const second = viewer2.viewer;
    if (!first || !second) {
      return;
    }

    const wrapHandler = (handler: () => void, viewer: MotorViewerInstance) => {
      viewer.viewer?.camera?.cameraChanged?.addEventListener(handler);
      handlers.push({ viewer, handler });
    };

    if (viewer1.isUseUE && viewer2.isUseUE) {
      wrapHandler(() => debouncedOnViewChanged(viewer1, viewer2), viewer1);
      wrapHandler(() => debouncedOnViewChanged(viewer2, viewer1), viewer2);
      return;
    }

    if (viewer1.isUseUE && !viewer2.isUseUE) {
      wrapHandler(() => debouncedOnViewChanged(viewer1, viewer2), viewer1);
      wrapHandler(() => onViewChangedCesium(viewer2, viewer1), viewer2);
      return;
    }

    if (!viewer1.isUseUE && viewer2.isUseUE) {
      wrapHandler(() => onViewChangedCesium(viewer1, viewer2), viewer1);
      wrapHandler(() => debouncedOnViewChanged(viewer2, viewer1), viewer2);
      return;
    }

    wrapHandler(() => onViewChangedCesium(viewer1, viewer2), viewer1);
    wrapHandler(() => onViewChangedCesium(viewer2, viewer1), viewer2);
  };

  const removeListeners = () => {
    handlers.forEach(({ viewer, handler }) => {
      viewer.viewer?.camera?.cameraChanged?.removeEventListener(handler);
    });
    handlers = [];
  };

  return { addListeners, removeListeners };
}

watch(sliderDirection, async () => {
  if (!sliderVisible.value) {
    return;
  }
  sliderPercent.value = 50;
  await nextTick();
  refreshSliderPosition();
});

watch(comparisonMode, async (mode) => {
  if (mode === 'overlay') {
    if (globalStore.secondMotorViewerInstance?.project) {
      await enableSlider();
    }
  } else {
    disableSlider();
  }
});

onBeforeUnmount(async () => {
  sliderEventsCleanup?.();
  resizeCleanup?.();
  await teardownViewers();
});

async function loadProjects(searchName = '') {
  if (loading.projects) return;
  loading.projects = true;
  try {
    if (!accessToken.value) {
      accessToken.value = await fetchToken(
        serverBaseUrl.value,
        normalizedAppId.value,
        normalizedSecret.value
      );
    }
    const list = await fetchProjects(
      serverBaseUrl.value,
      accessToken.value,
      normalizedAppId.value,
      1,
      50, // Fetch more to populate dropdown
      searchName,
      projectType.value
    );
    projects.value = list;
  } catch (error) {
    console.error('Failed to load projects', error);
    statusMessage.value = '获取项目列表失败';
  } finally {
    loading.projects = false;
  }
}

const handleProjectSearch = debounce((query: string) => {
  loadProjects(query);
}, 500);

onMounted(() => {
  loadProjects();
});

watch(projectType, () => {
  selectedPrimaryId.value = '';
  selectedSecondaryId.value = '';
  loadProjects();
});
</script>

<style scoped>
.compare-page {
  position: relative;
  width: 100%;
  height: 100vh;
  background: #000;
  overflow: hidden;
  color: #fff;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

.viewer-stack {
  width: 100%;
  height: 100%;
}

.viewer-stack.overlay {
  position: relative;
}

.viewer-stack.split {
  display: flex;
  width: 100%;
  height: 100%;
}

.viewer-stack.split-vertical {
  flex-direction: column;
}

.viewer-stack.split-horizontal {
  flex-direction: row;
}

.viewer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}

.viewer-stack.split .viewer {
  position: relative;
  flex: 1 1 0;
  width: 100%;
  height: 100%;
}

.viewer-stack.split-vertical .viewer {
  height: 50%;
}

.viewer-stack.split-horizontal .viewer {
  width: 50%;
}

.viewer.primary {
  z-index: 1;
}

.viewer.secondary {
  z-index: 2;
}

.viewer-stack.split .viewer.primary,
.viewer-stack.split .viewer.secondary {
  z-index: 1;
}

.slider {
  position: absolute;
  top: 0;
  left: 50%;
  width: 4px;
  height: 100%;
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.8), rgba(124, 58, 237, 0.8));
  cursor: ew-resize;
  z-index: 5;
  transform: translateX(-50%);
  transition: all var(--transition-base);
  box-shadow: 0 0 20px rgba(37, 99, 235, 0.6);
}

.slider:hover {
  width: 6px;
  box-shadow: 0 0 30px rgba(37, 99, 235, 0.8);
}

.slider.vertical {
  width: 100%;
  height: 4px;
  cursor: ns-resize;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  background: linear-gradient(90deg, rgba(37, 99, 235, 0.8), rgba(124, 58, 237, 0.8));
}

.slider.vertical:hover {
  height: 6px;
  width: 100%;
}

.slider::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg, hsl(221, 83%, 53%), hsl(271, 76%, 53%));
  border: 2px solid rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 20px rgba(37, 99, 235, 0.5);
  transition: all var(--transition-base);
}

.slider:hover::after {
  width: 24px;
  height: 24px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4), 0 0 30px rgba(37, 99, 235, 0.7);
}

.toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  z-index: 10;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  gap: 16px;
  flex-wrap: wrap;
}

.description {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: rgba(255, 255, 255, 0.9);
}

.controls {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.group {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  padding: 4px;
  border-radius: 8px;
}

.toggle-group {
  display: flex;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.toggle-group label {
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  color: rgba(255, 255, 255, 0.7);
}

.toggle-group label.active {
  background: #3b82f6;
  color: white;
  font-weight: 500;
}

.toggle-group input {
  display: none;
}

.controls select,
.controls button {
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  transition: all var(--transition-base);
  cursor: pointer;
}

.controls select:hover:not(:disabled),
.controls button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.controls button:hover:enabled {
  background: linear-gradient(135deg, hsl(221, 83%, 53%), hsl(271, 76%, 53%));
  border-color: transparent;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
}

.controls button:active:enabled {
  transform: translateY(0);
}

.controls button:disabled,
.controls select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.controls select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='white' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 32px;
}

.status {
  position: absolute;
  bottom: 20px;
  left: 20px;
  margin: 0;
  padding: 12px 20px;
  background: rgba(15, 23, 42, 0.9);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  animation: slideUp 0.3s ease-out;
  max-width: 400px;
}
</style>
