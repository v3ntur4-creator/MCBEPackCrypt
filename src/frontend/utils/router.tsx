import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import HomePage from '../pages/HomePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  // 可以在这里添加更多路由
  // {
  //   path: '/encrypt',
  //   element: <EncryptPage />,
  // },
  // {
  //   path: '/decrypt', 
  //   element: <DecryptPage />,
  // },
]);

export default router;