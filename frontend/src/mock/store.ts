import { Department, Employee, Resource, NotificationItem } from '../types';
import { MOCK_DEPARTMENTS } from './departments.mock';
import { MOCK_EMPLOYEES } from './employees.mock';
import { MOCK_RESOURCES } from './resources.mock';

class MockDataStore {
  private departments: Department[] = [...MOCK_DEPARTMENTS];
  private employees: Employee[] = [...MOCK_EMPLOYEES];
  private resources: Resource[] = [...MOCK_RESOURCES];
  private notifications: NotificationItem[] = [
    {
      id: 'notif-001',
      title: 'Vehicle Bolo Inspection Due',
      message: 'Toyota Land Cruiser (3-45892 ET) inspection expires in 34 days.',
      type: 'WARNING',
      isRead: false,
      createdAt: '2026-10-26T08:00:00Z'
    },
    {
      id: 'notif-002',
      title: 'Surveying Calibration Approved',
      message: 'Leica TS20 Robotic Total Station successfully certified by NQI.',
      type: 'SUCCESS',
      isRead: true,
      createdAt: '2026-10-20T09:30:00Z'
    },
    {
      id: 'notif-003',
      title: 'Maintenance Request Pending',
      message: 'Trimble R12 GNSS unit is waiting for replacement UHF module.',
      type: 'ALERT',
      isRead: false,
      createdAt: '2026-10-18T14:00:00Z'
    }
  ];

  async getDepartments(): Promise<Department[]> {
    await this.latency();
    return [...this.departments];
  }

  async getEmployees(): Promise<Employee[]> {
    await this.latency();
    return [...this.employees];
  }

  async getResources(): Promise<Resource[]> {
    await this.latency();
    return [...this.resources];
  }

  async getResourceById(id: string): Promise<Resource | null> {
    await this.latency();
    const r = this.resources.find(item => item.id === id);
    return r ? { ...r } : null;
  }

  async addResource(resource: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>): Promise<Resource> {
    await this.latency();
    const newId = 'res-' + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();
    const newResource: Resource = {
      ...resource,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    this.resources.unshift(newResource);
    return newResource;
  }

  async updateResource(id: string, updates: Partial<Resource>): Promise<Resource | null> {
    await this.latency();
    const index = this.resources.findIndex(r => r.id === id);
    if (index === -1) return null;
    this.resources[index] = {
      ...this.resources[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return { ...this.resources[index] };
  }

  async getNotifications(): Promise<NotificationItem[]> {
    await this.latency();
    return [...this.notifications];
  }

  private latency(ms: number = 80): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const mockStore = new MockDataStore();
