import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

const isResizeObserverError = (message: any): boolean => {
  if (typeof message === 'string') {
    return message.includes('ResizeObserver loop') || 
           message.includes('ResizeObserver loop completed') ||
           message.includes('undelivered notifications');
  }
  if (message instanceof Error) {
    return message.message.includes('ResizeObserver loop') || 
           message.message.includes('ResizeObserver loop completed') ||
           message.message.includes('undelivered notifications');
  }
  return false;
};

const originalConsoleError = console.error;
console.error = (...args) => {
  if (isResizeObserverError(args[0])) {
    return;
  }
  originalConsoleError(...args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  if (isResizeObserverError(args[0])) {
    return;
  }
  originalConsoleWarn(...args);
};

window.addEventListener('error', (event) => {
  if (isResizeObserverError(event.message) || isResizeObserverError(event.error)) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && isResizeObserverError(event.reason)) {
    event.preventDefault();
  }
});

const debounce = (callback: Function, delay: number) => {
  let timeoutId: number;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
};

if (typeof window !== 'undefined' && window.ResizeObserver) {
  const OriginalResizeObserver = window.ResizeObserver;
  
  window.ResizeObserver = class extends OriginalResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      const wrappedCallback: ResizeObserverCallback = (entries, observer) => {
        window.requestAnimationFrame(() => {
          try {
            callback(entries, observer);
          } catch (error) {
            if (!isResizeObserverError(error)) {
              throw error;
            }
          }
        });
      };
      super(wrappedCallback);
    }
  };
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <App />
   </ErrorBoundary>
)
