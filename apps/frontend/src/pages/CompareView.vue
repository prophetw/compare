<template>
  <section class="compare-page">
    <div class="viewer-stack" ref="viewerHostRef">
      <div id="engineContainer" class="viewer primary"></div>
      <div
        id="engineContainer2"
        class="viewer secondary"
        ref="secondContainerRef"
        :style="sliderVisible ? undefined : secondaryHiddenStyle"
      ></div>
      <div
        v-show="sliderVisible"
        ref="sliderRef"
        class="slider"
        :class="{ vertical: sliderDirection === 'vertical' }"
      ></div>
    </div>

    <div class="toolbar">
      <span class="description">双视口 视口同步</span>
      <span class="controls">
        <select v-model="sliderDirection" :disabled="!sliderVisible">
          <option value="vertical">上下方向</option>
          <option value="horizontal">左右方向</option>
        </select>
        <button type="button" @click="mountPrimary" :disabled="loading.primary">
          {{ loading.primary ? '加载主场景…' : '打开主场景' }}
        </button>
        <button type="button" @click="mountSecondary" :disabled="loading.secondary">
          {{ loading.secondary ? '加载卷帘副场景…' : '打开卷帘副场景' }}
        </button>
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
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';

type BimEngineModule = typeof import('BimEngine');
type BimEngineNamespace = BimEngineModule['default'];

declare global {
  interface Window {
    BimEngine?: BimEngineNamespace;
  }
}

const ENGINE_SCRIPT_SRC = '/engine-sdk/BimEngine.js';
const DEFAULT_BASE_URL = 'https://szsp.suitbim.com.cn:7201';
const APP_ID = 'cda91b54847a41dd824dc8770d58cfc9';
const SECRET = '7300a518eac34f2bad99fc88726536b8';
const PRIMARY_PROJECT_ID = '6b59b9a0f2c6414d871d0752551914e9';
const SECONDARY_PROJECT_ID = 'a22756c408d34a9c8d508e0b198cfe91';
const USE_UE = false;

const statusMessage = ref('');
const sliderDirection = ref<'vertical' | 'horizontal'>('vertical');
const sliderVisible = ref(false);
const sliderPercent = ref(50);
const secondaryHiddenStyle = Object.freeze({ clipPath: 'none' });

const viewerHostRef = ref<HTMLDivElement | null>(null);
const sliderRef = ref<HTMLDivElement | null>(null);
const secondContainerRef = ref<HTMLDivElement | null>(null);

const loading = reactive({
  primary: false,
  secondary: false,
  teardown: false
});

let enginePromise: Promise<BimEngineNamespace> | null = null;
let cachedEngine: BimEngineNamespace | null = null;

const globalStore = {
  firstMotorViewerInstance: null as MotorViewerInstance | null,
  secondMotorViewerInstance: null as MotorViewerInstance | null,
  cameraSyncEvt: null as ReturnType<typeof syncCameras> | null
};

class MotorViewerInstance {
  public viewer?: InstanceType<BimEngineModule['Viewer']>;
  public project?: InstanceType<BimEngineModule['Project']>;
  public readonly isUseUE: boolean;
  public readonly openId: string;
  private readonly container: string;
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly secret: string;
  private readonly token?: string;
  private readonly websocketUrl?: string;
  private readonly streamUrl?: string;

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
    const project = await viewer.queryProject(this.openId);
    if (!project) {
      throw new Error('未找到项目');
    }
    await project.open();
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
};

async function ensureEngine() {
  if (cachedEngine) {
    return cachedEngine;
  }
  if (window.BimEngine) {
    cachedEngine = window.BimEngine;
    cachedEngine.setBaseUrl('/engine-sdk');
    return cachedEngine;
  }
  if (!enginePromise) {
    enginePromise = new Promise<BimEngineNamespace>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-bimengine]');
      if (existing) {
        existing.addEventListener('load', () => {
          if (window.BimEngine) {
            window.BimEngine.setBaseUrl('/engine-sdk');
            cachedEngine = window.BimEngine;
            resolve(window.BimEngine);
          }
        });
        existing.addEventListener('error', () => reject(new Error('BimEngine 脚本加载失败')));
        return;
      }
      const script = document.createElement('script');
      script.src = ENGINE_SCRIPT_SRC;
      script.async = true;
      script.dataset.bimengine = 'true';
      script.onload = () => {
        if (window.BimEngine) {
          window.BimEngine.setBaseUrl('/engine-sdk');
          cachedEngine = window.BimEngine;
          resolve(window.BimEngine);
        } else {
          reject(new Error('无法初始化 BimEngine')); 
        }
      };
      script.onerror = () => reject(new Error('BimEngine 脚本加载失败'));
      document.head.appendChild(script);
    }).catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

async function mountPrimary() {
  if (loading.primary) {
    return;
  }
  try {
    loading.primary = true;
    statusMessage.value = '正在打开主场景…';
    const engine = await ensureEngine();
    let instance = globalStore.firstMotorViewerInstance;
    if (!instance) {
      instance = new MotorViewerInstance(engine, {
        baseUrl: DEFAULT_BASE_URL,
        appId: APP_ID,
        secret: SECRET,
        openId: PRIMARY_PROJECT_ID,
        container: 'engineContainer',
        useUE: USE_UE
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
  if (!globalStore.firstMotorViewerInstance?.project) {
    statusMessage.value = '请先打开主场景';
    return;
  }
  try {
    loading.secondary = true;
    statusMessage.value = '正在打开卷帘副场景…';
    const engine = await ensureEngine();
    if (globalStore.secondMotorViewerInstance?.project) {
      statusMessage.value = '副场景已打开';
      return;
    }
    const instance = new MotorViewerInstance(engine, {
      baseUrl: DEFAULT_BASE_URL,
      appId: APP_ID,
      secret: SECRET,
      openId: SECONDARY_PROJECT_ID,
      container: 'engineContainer2',
      useUE: USE_UE
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

onBeforeUnmount(async () => {
  sliderEventsCleanup?.();
  resizeCleanup?.();
  await teardownViewers();
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
  font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

.viewer-stack {
  position: relative;
  width: 100%;
  height: 100%;
}

.viewer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
}

.viewer.primary {
  z-index: 1;
}

.viewer.secondary {
  z-index: 2;
}

.slider {
  position: absolute;
  top: 0;
  left: 50%;
  width: 4px;
  height: 100%;
  background-color: #000;
  cursor: ew-resize;
  z-index: 5;
  transform: translateX(-50%);
}

.slider.vertical {
  width: 100%;
  height: 4px;
  cursor: ns-resize;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
}

.slider::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  background-color: #fff;
  border: 2px solid #000;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.toolbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 10;
}

.description {
  font-size: 14px;
}

.controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.controls select,
.controls button {
  height: 28px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: transparent;
  color: #fff;
  padding: 0 10px;
  font-size: 13px;
}

.controls button:hover:enabled {
  background: #fff;
  color: #000;
}

.controls button:disabled,
.controls select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status {
  position: absolute;
  bottom: 16px;
  left: 16px;
  margin: 0;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  font-size: 14px;
}
</style>
