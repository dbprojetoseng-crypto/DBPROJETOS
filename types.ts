export interface Task {
  id: string;
  name: string;
  location: string;
  team: string[];
  dueDate: string;
  status: 'In Progress' | 'Upcoming' | 'Blocked' | 'Completed';
  progress: number;
}

export interface ResourceMetric {
  week: string;
  engineers: number;
  laborers: number;
  operators: number;
}

export interface Alert {
  id: string;
  type: 'delay' | 'shortage';
  title: string;
  description: string;
  priority: 'high' | 'advisory';
}
