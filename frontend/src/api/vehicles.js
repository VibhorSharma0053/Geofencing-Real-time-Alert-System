import { request } from './client';

export async function createVehicle(payload) {
  return request('/vehicles', {
    method: 'POST',
    body: payload,
  });
}

export async function getVehicles(params = {}) {
  return request('/vehicles', {
    params,
  });
}
