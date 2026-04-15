import axios from 'axios';
import { setDefaultHeaders } from '.';

export const codemakerReportsRequest = axios.create({
  baseURL: '/proxy/gpt',
  timeout: 40000,
});

codemakerReportsRequest.interceptors.request.use(setDefaultHeaders);

export async function batchReport(data: Array<unknown>) {
  return await codemakerReportsRequest.post('/u5/reports:batch', data);
}
