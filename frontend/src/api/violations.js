import { request } from './client';

export async function getViolationsHistory(params = {}) {
  return request('/violations/history', {
    params,
  });
}
