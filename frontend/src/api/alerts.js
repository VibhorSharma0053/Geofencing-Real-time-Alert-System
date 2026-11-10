import { request } from './client';

export async function configureAlert(payload) {
  return request('/alerts/configure', {
    method: 'POST',
    body: payload,
  });
}

export async function getAlerts(params = {}) {
  return request('/alerts', {
    params,
  });
}

export async function deleteAlert(alertId) {
  return request(`/alerts/${encodeURIComponent(alertId)}`, {
    method: 'DELETE',
  });
}
