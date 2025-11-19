import { reactive, toRefs } from 'vue';

export type ViewerConfig = {
  appName: string;
  serverUrl: string;
  appId: string;
  secret: string;
  sdkUrl: string;
};

export const defaultViewerConfig: ViewerConfig = {
  appName: '浦东大道VR测试',
  serverUrl: 'https://szsp.suitbim.com.cn:7201',
  appId: '1a16da7bce17484fb7bb1e3c6b6b692a',
  secret: 'cfd8efe7467d42d39505c2cafbed2d29',
  sdkUrl: '/bimv3d/data/proj/page/common/ignore'
};

const state = reactive({
  config: { ...defaultViewerConfig },
  confirmed: false
});

export function useViewerConfig() {
  return toRefs(state);
}

export function setViewerConfig(newConfig: ViewerConfig) {
  Object.assign(state.config, newConfig);
  state.confirmed = true;
}

export function resetViewerConfig() {
  Object.assign(state.config, defaultViewerConfig);
  state.confirmed = false;
}
