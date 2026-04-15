import axios from 'axios';
import { useAuthStore } from '../store/auth';
import { setDefaultHeaders } from './'

const userDashboardRequest = axios.create({
  baseURL: '/proxy/vega',
  timeout: 180000,
  headers: {},
});
userDashboardRequest.interceptors.request.use(setDefaultHeaders);

export interface UseDashboardData {
  user: string;
  // 代码补全接受率
  complete_accept_ratio: number | null;
  // 聊天次数
  gitchat_total: number | null;
  // 发起 AI review次数
  localreview_start_nums: number | null;
  // 反馈有效/无效问题数
  localreview_post_issue_nums: number | null;
  // 生成与应用代码行数
  gitchat_generate_lines: number | null;
  // 累计使用天数
  complete_use_days: number | null;
  // 累计采纳代码次数
  complete_accept_nums: number | null;
  // 上次访问时间
  last_access_time?: string | null;

}


export interface UserBillData {
  current_month: {
    date_range: {
      start: string, end: string,
    },
    results: { app_code: string, total_cost: number, token_amt: number, auth_user: number }[]
  },
  last_month: {
    date_range: {
      start: string, end: string,
    },
    results: { app_code: string, total_cost: number, token_amt: number, auth_user: number }[]
  },
  prev_month: {
    date_range: {
      start: string, end: string,
    },
    results: { app_code: string, total_cost: number, token_amt: number, auth_user: number }[]
  },
}

export async function getUserDashboard() {
  const params = {
    user: useAuthStore.getState().username,
  };
  const { data } = await userDashboardRequest.get<UseDashboardData>('/user_total_stat', {
    params,
  });
  return data;
}

export async function getUserBill() {
  const params = {
    least_cost: 0,
  }
  const { data } = await userDashboardRequest<UserBillData>('/user_cost', {
    params
  });
  return data;
}

