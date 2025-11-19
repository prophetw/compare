import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
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
