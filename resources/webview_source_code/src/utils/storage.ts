export const getLocalStorage = <T>(key: string): T | null => {
  const data = localStorage.getItem(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (e) {
    return data as unknown as T;
  }
};

export const setLocalStorage = <T>(key: string, value: T) => {
  const data = typeof value === 'object' ? JSON.stringify(value) : value;
  localStorage.setItem(key, data as string);
};
