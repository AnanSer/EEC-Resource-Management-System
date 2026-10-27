import { Employee } from '../types';
import { mockStore } from '../mock/store';

export const employeeService = {
  async getAll(): Promise<Employee[]> {
    return mockStore.getEmployees();
  },

  async getById(id: string): Promise<Employee | undefined> {
    const emps = await mockStore.getEmployees();
    return emps.find(e => e.id === id);
  },

  async getByDepartment(departmentId: string): Promise<Employee[]> {
    const emps = await mockStore.getEmployees();
    return emps.filter(e => e.departmentId === departmentId);
  }
};
