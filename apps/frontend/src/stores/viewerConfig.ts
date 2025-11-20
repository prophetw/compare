import { reactive, toRefs } from 'vue';

export type ViewerConfig = {
  appName: string;
  serverUrl: string;
  appId: string;
  secret: string;
  sdkUrl: string;
};

const CONFIG_STORAGE_KEY = 'viewer-config';
const CONFIRMED_STORAGE_KEY = 'viewer-config-confirmed';

export const defaultViewerConfig: ViewerConfig = {
  appName: '浦东大道VR测试',
  serverUrl: 'https://szsp.suitbim.com.cn:7201',
  appId: '1a16da7bce17484fb7bb1e3c6b6b692a',
  secret: 'cfd8efe7467d42d39505c2cafbed2d29',
  sdkUrl: '/bimv3d/data/proj/page/common/ignore'
};

const persisted = loadPersistedState();

const state = reactive({
  config: persisted?.config ?? { ...defaultViewerConfig },
  confirmed: persisted?.confirmed ?? false
});

export function useViewerConfig() {
  return toRefs(state);
}

export function setViewerConfig(newConfig: ViewerConfig) {
  Object.assign(state.config, newConfig);
  state.confirmed = true;
  persistState();
}

export function resetViewerConfig() {
  Object.assign(state.config, defaultViewerConfig);
  state.confirmed = false;
  clearPersistedState();
}

function persistState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(state.config));
  window.localStorage.setItem(CONFIRMED_STORAGE_KEY, state.confirmed ? 'true' : 'false');
}

function clearPersistedState() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.removeItem(CONFIG_STORAGE_KEY);
  window.localStorage.removeItem(CONFIRMED_STORAGE_KEY);
}

function loadPersistedState():
  | {
      config: ViewerConfig;
      confirmed: boolean;
    }
  | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const rawConfig = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!rawConfig) {
      return null;
    }
    const parsed = JSON.parse(rawConfig);
    if (!isValidConfig(parsed)) {
      return null;
    }
    const confirmed = window.localStorage.getItem(CONFIRMED_STORAGE_KEY) === 'true';
    return { config: parsed, confirmed };
  } catch (error) {
    console.warn('[viewerConfig] failed to parse stored config', error);
    return null;
  }
}

function isValidConfig(value: unknown): value is ViewerConfig {
  if (typeof value !== 'object' || !value) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return ['appName', 'serverUrl', 'appId', 'secret', 'sdkUrl'].every(
    (key) => typeof record[key] === 'string' && record[key] !== ''
  );
}
