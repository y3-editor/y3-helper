// import './wdyr';
import './init.ts';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { SWRConfiguration, SWRConfig } from 'swr';
import { enableMapSet } from 'immer';
import './index.scss';
import App from './App.tsx';
import CodeChat from './routes/CodeChat';
import { Module } from './routes.ts';
import PostMessageProvider from './PostMessageProvider.tsx';
import Help from './routes/Help/index.tsx';
import AuthProvider from './routes/AuthProvider.tsx';
import EventProvider from './routes/EventProvider.tsx';
import EditorProvider from './routes/EditorProvider.tsx';
import ErrorCollector from './routes/ErrorCollector.tsx';
import ThemeProvider from './ThemeProvider.tsx';
import { addObjectHasOwnPolyfill } from './utils/common.ts';
import { PanelProvider } from './context/PanelContext.tsx';

enableMapSet();

// 调用函数以添加 polyfill
addObjectHasOwnPolyfill();

const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode');

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        path: Module.chat,
        element: <CodeChat />,
      },
      {
        path: Module.help,
        element: <Help />,
      },
    ],
  },
]);

const defaultSWRConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  shouldRetryOnError: false,
};

// eslint-disable-next-line react-refresh/only-export-components
const RootComponent =
  mode === 'panel' ? <App /> : <RouterProvider router={router} />;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SWRConfig value={defaultSWRConfig}>
      <AuthProvider />
      <ErrorCollector />
      <PostMessageProvider targetOrigin="*">
        <ThemeProvider>
          <EventProvider>
            <EditorProvider />
            <PanelProvider>{RootComponent}</PanelProvider>
          </EventProvider>
        </ThemeProvider>
      </PostMessageProvider>
    </SWRConfig>
  </React.StrictMode>,
);
