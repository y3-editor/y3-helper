export const Module = {
  chat: 'codeChat',
  search: 'search',
  review: 'codeReview',
  help: 'help',
} as const;

export type Module = keyof typeof Module;
