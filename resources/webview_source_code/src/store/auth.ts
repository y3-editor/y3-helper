import { create } from 'zustand';

export interface AuthUser {
  fullname: string;
  name: string;
  email: string;
  status: number;
  type: number;
}

interface AuthExtendStore {
  department: string;
  department_code: string;
  c_unrestrict: boolean;
}

interface Project {
  code: string;
  name: string;
  fullname: string;
  description: string;
  project: string;
}
interface AuthStore {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  username: string | null;
  setUsername: (username: string | null) => void;
  displayName: string | null;
  setDisplayName: (name: string | null) => void;
  loginFrom: string | null;
  setLoginFrom: (from: string | null) => void;
  authExtends: AuthExtendStore;
  setAuthExtends: (data: AuthExtendStore) => void;
  authUsers: AuthUser[];
  setAuthUser: (data: AuthUser[]) => void;
  projects: Project[];
  setProjects: (data: Project[]) => void;
  pkgNamespace: string;
  setPkgNamespace: (pkgNamespace: string) => void;
}

const DEFAULT_AUTH_STORE = {
  username: null,
  accessToken: null,
  authExtends: {
    department: '',
    department_code: '',
    c_unrestrict: false
  },
  projects: [],
  loginFrom: null,
};

export const useAuthStore = create<AuthStore>()((set) => ({
  ...DEFAULT_AUTH_STORE,
  accessToken: null,
  setAccessToken: (token: string | null) => {
    set({ accessToken: token });
    (window as any).ACCESS_TOKEN = token;
  },
  username: null,
  setUsername: (name: string | null) => {
    set({ username: name });
    (window as any).AUTH_USER = name;
  },
  displayName: null,
  setDisplayName: (name: string | null) => {
    set({ displayName: name });
  },
  setLoginFrom: (from: string | null) => {
    set({ loginFrom: from });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).login_from = from;
  },
  setAuthExtends: (data: AuthExtendStore) => {
    set({ authExtends: data });
  },
  authUsers: [],
  setAuthUser: (data: AuthUser[]) => {
    set({ authUsers: data });
  },
  projects: [],
  setProjects: (data: Project[]) => {
    set({ projects: data });
  },
  pkgNamespace: 'prod',
  setPkgNamespace: (pkgNamespace: string) => {
    set({ pkgNamespace });
  }
}));

const SPEC_STAGING_NAMESPACE = 'spec';

// STAGING: 暂时通过 pkgNamespace 判断来屏蔽非灰度用户使用 spec 功能
export const selectIsSpecStaging = (state: AuthStore) => state.pkgNamespace === SPEC_STAGING_NAMESPACE;

export const authStore = useAuthStore;
