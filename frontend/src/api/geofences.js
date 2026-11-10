import { request } from './client';

export async function createGeofence(payload) {
  return request('/geofences', {
    method: 'POST',
    body: payload,
  });
}

export async function getGeofences(params = {}) {
  return request('/geofences', {
    params,
  });
}
