import { createRouter, createWebHashHistory } from 'vue-router';

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: { name: 'config' }
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/pages/HomeView.vue')
    },
    {
      path: '/compare',
      name: 'compare',
      component: () => import('@/pages/CompareView.vue')
    },
    {
      path: '/config',
      name: 'config',
      component: () => import('@/pages/ConfigView.vue')
    }
  ]
});

export default router;
