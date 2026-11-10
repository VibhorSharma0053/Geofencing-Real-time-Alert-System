export const CATEGORIES = {
  delivery_zone: {
    id: 'delivery_zone',
    label: 'Delivery Zone',
    color: '#10b981', // green
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    fillColor: '#10b981',
  },
  restricted_zone: {
    id: 'restricted_zone',
    label: 'Restricted Zone',
    color: '#ef4444', // red
    badgeClass: 'bg-red-500/10 text-red-400 border-red-500/30',
    fillColor: '#ef4444',
  },
  toll_zone: {
    id: 'toll_zone',
    label: 'Toll Zone',
    color: '#f59e0b', // amber
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    fillColor: '#f59e0b',
  },
  customer_area: {
    id: 'customer_area',
    label: 'Customer Area',
    color: '#3b82f6', // blue
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    fillColor: '#3b82f6',
  },
};

export const EVENT_TYPES = {
  entry: {
    id: 'entry',
    label: 'Entry',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  exit: {
    id: 'exit',
    label: 'Exit',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  both: {
    id: 'both',
    label: 'Entry & Exit',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
};

export const DEFAULT_MAP_CENTER = [37.7749, -122.4194]; // San Francisco
export const DEFAULT_MAP_ZOOM = 13;

export const VEHICLE_TYPES = [
  { value: 'truck', label: 'Truck' },
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Van' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'other', label: 'Other' },
];

