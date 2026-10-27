import { Department } from '../types';
import { mockStore } from '../mock/store';

export const departmentService = {
  async getAll(): Promise<Department[]> {
    return mockStore.getDepartments();
  },

  async getById(id: string): Promise<Department | undefined> {
    const depts = await mockStore.getDepartments();
    return depts.find(d => d.id === id);
  }
};
