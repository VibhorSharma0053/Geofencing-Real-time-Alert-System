import { request } from './client';

export async function postLocation(payload) {
  return request('/vehicles/location', {
    method: 'POST',
    body: payload,
  });
}

export async function getVehicleLocation(vehicleId) {
  return request(`/vehicles/location/${encodeURIComponent(vehicleId)}`);
}
