import { Task, ResourceMetric, Alert } from './types';

export const TASKS: Task[] = [
  {
    id: '1',
    name: 'foundationPileCapping',
    location: 'Zone B Sector 2',
    team: ['A', 'K'],
    dueDate: 'Tomorrow',
    status: 'In Progress',
    progress: 100,
  },
  {
    id: '2',
    name: 'electricMainLinePull',
    location: 'Ground Floor Core',
    team: ['S'],
    dueDate: 'Aug 14',
    status: 'Upcoming',
    progress: 0,
  },
  {
    id: '3',
    name: 'plumbingPressureTest',
    location: 'Residential Unit 4A-D',
    team: ['M'],
    dueDate: 'Aug 15',
    status: 'Blocked',
    progress: 0,
  },
];

export const RESOURCE_DATA: ResourceMetric[] = [
  { week: 'WK 34', engineers: 500, laborers: 1000, operators: 750 },
  { week: 'WK 35', engineers: 400, laborers: 1100, operators: 850 },
  { week: 'WK 36', engineers: 750, laborers: 900, operators: 600 },
  { week: 'WK 37', engineers: 250, laborers: 1250, operators: 1000 },
  { week: 'WK 38', engineers: 400, laborers: 1000, operators: 750 },
  { week: 'WK 39', engineers: 500, laborers: 750, operators: 500 },
  { week: 'WK 40', engineers: 250, laborers: 600, operators: 400 },
];

export const ALERTS: Alert[] = [
  {
    id: '1',
    type: 'delay',
    title: 'Reinforcement Steel Delay',
    description: 'Shipment #284 stuck at port. Estimated 3-day impact on slab casting schedule.',
    priority: 'high',
  },
  {
    id: '2',
    type: 'shortage',
    title: 'HVAC Subcontractor Shortage',
    description: 'Crew attendance dropped 20% this week. Monitoring impact on ductwork installation.',
    priority: 'advisory',
  },
];

export const SCURVE_DATA = [
  { month: 'Mar', scheduled: 5, actual: 5 },
  { month: 'Apr', scheduled: 10, actual: 8 },
  { month: 'May', scheduled: 40, actual: 25 },
  { month: 'Jun', scheduled: 85, actual: 55 },
  { month: 'Jul', scheduled: 95, actual: null },
  { month: 'Aug', scheduled: 100, actual: null },
];
