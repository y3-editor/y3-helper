declare module '*.png';
interface ObjectConstructor {
  hasOwn: (obj: any, prop: string | symbol) => boolean;
}

interface Window {
  scheduleWork: typeof import('./utils/scheduler').scheduleWork;
}
