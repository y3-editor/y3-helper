import { create } from 'zustand';
enum ListView {
  Task = '任务',
  Worksheet = '工单',
}
interface CoverageStore {
  currentType: ListView;
  setCurrentType: (currentType?: ListView) => void;
  coverageInfo: any;
  setCoverageInfo: (coverageInfo?: any) => void;
  personTaskId: string | null;
  setPersonTaskId: (personTaskId?: string | null) => void;
  currentJob: string | null;
  setCurrentJob: (currentJob?: string | null) => void;
  projectOptsReady: boolean;
  setProjectOptsReady: (projectOptsReady?: boolean) => void;
  resetComplete: boolean;
  setResetComplete: (resetComplete?: boolean) => void;
  currentProject: string | null;
  setCurrentProject: (project?: string | null) => void;
  defaultBranch: string | null;
  setDefaultBranch: (defaultBranch?: string | null) => void;
  enableBranchView: boolean;
  setEnableBranchView: (enableBranchView?: boolean) => void;
  noneProject: boolean;
  setNoneProject: (noneProject?: boolean) => void;
  coverageMergeStrategy: any;
  setCoverageMergeStrategy: (coverageMergeStrategy?: any) => void;
  roles: string[];
  setRoles: (roles?: string[]) => void;
}

export const useCoverage = create<CoverageStore>()((set) => ({
  currentType: ListView.Task,
  setCurrentType: (currentType) => {
    set(() => ({ currentType: currentType }));
  },
  coverageInfo: {},
  setCoverageInfo: (coverageInfo) => {
    set(() => ({ coverageInfo: coverageInfo }));
  },
  personTaskId: null,
  setPersonTaskId: (personTaskId) => {
    set(() => ({ personTaskId: personTaskId }));
  },
  currentJob: null,
  setCurrentJob: (currentJob) => {
    set(() => ({ currentJob: currentJob }));
  },
  projectOptsReady: false,
  setProjectOptsReady: (projectOptsReady) => {
    set(() => ({ projectOptsReady: projectOptsReady }));
  },
  resetComplete: false,
  setResetComplete: (resetComplete) => {
    set(() => ({ resetComplete: resetComplete }));
  },
  currentProject: null,
  setCurrentProject: (project) => {
    set(() => ({ currentProject: project }));
  },
  defaultBranch: null,
  setDefaultBranch: (defaultBranch) => {
    set(() => ({ defaultBranch: defaultBranch }));
  },
  enableBranchView: false,
  setEnableBranchView: (enableBranchView) => {
    set(() => ({ enableBranchView: enableBranchView }));
  },
  noneProject: false,
  setNoneProject: (noneProject) => {
    set(() => ({ noneProject: noneProject }));
  },
  coverageMergeStrategy: {},
  setCoverageMergeStrategy: (coverageMergeStrategy) => {
    set(() => ({ coverageMergeStrategy: coverageMergeStrategy }));
  },
  roles: [],
  setRoles: (roles) => {
    set(() => ({ roles: roles }));
  },
}));
