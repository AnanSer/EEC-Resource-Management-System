import prisma from '../src/lib/prisma';
import { hashPassword } from '../src/auth/password';

async function main() {
  console.log('[EEC-RMS Seed] Starting database seeding for Departments, Users, and Employees...');

  const defaultPassword = 'EEC-Secure2026!';
  const passwordHash = await hashPassword(defaultPassword);

  // 1. Seed Core Corporate Departments
  const departmentsData = [
    {
      id: 'dept-101',
      name: 'Transport & Infrastructure Design',
      code: 'TID',
      description: 'Highway, rail, and bridge engineering consultancy and supervision',
      managerName: 'Derartu Tulu',
      location: 'Headquarters - Floor 4',
      budgetCode: 'BUD2026-TID1',
    },
    {
      id: 'dept-102',
      name: 'Water Resources & Irrigation',
      code: 'WRI',
      description: 'Dams, irrigation canals, hydrological studies and supervision',
      managerName: 'Dr. Amare Kassahun',
      location: 'Headquarters - Floor 3',
      budgetCode: 'BUD2026-WRI1',
    },
    {
      id: 'dept-103',
      name: 'Geotechnical & Surveying Engineering',
      code: 'GSE',
      description: 'Soil mechanics, geodetic surveying, drilling, and topographic mapping',
      managerName: 'Eng. Berhanu Tesfaye',
      location: 'Annex Building A | Lab Complex',
      budgetCode: 'BUD2026-GSE1',
    },
    {
      id: 'dept-104',
      name: 'Building & Urban Design',
      code: 'BUD',
      description: 'Architectural, structural, MEP, and civic infrastructure design',
      managerName: 'Arch. Friewotei Beleyneh',
      location: 'Headquarters - Floor 5',
      budgetCode: 'BUD2026-BUD1',
    },
    {
      id: 'dept-105',
      name: 'Energy & Power Engineering',
      code: 'EPE',
      description: 'Transmission lines, substations, hydropower, and renewable energy',
      managerName: 'Eng. Dawit Alemu',
      location: 'Headquarters - Floor 6',
      budgetCode: 'BUD2026-EPE1',
    },
    {
      id: 'dept-106',
      name: 'Construction Supervision & Management',
      code: 'CSM',
      description: 'Field project supervision, contract administration, and quality control',
      managerName: 'Eng. Yeshiwas Tessema',
      location: 'Central Project Office - Addis',
      budgetCode: 'BUD2026-CSM1',
    },
    {
      id: 'dept-107',
      name: 'Information & Communication Technology',
      code: 'ICT',
      description: 'Corporate IT infrastructure, software, networking, and system support',
      managerName: 'Ato Kebede Gurmu',
      location: 'Headquarters - Floor 1 | Server Room',
      budgetCode: 'BUD2026-ICT1',
    },
    {
      id: 'dept-108',
      name: 'Procurement & Property Administration',
      code: 'PPA',
      description: 'Warehouse management, central stores, procurement, and logistics',
      managerName: 'Almaz Ayana',
      location: 'Kersa Central Warehouse Complex',
      budgetCode: 'BUD2026-PPA1',
    },
  ];

  for (const dept of departmentsData) {
    const d = await prisma.department.upsert({
      where: { code: dept.code },
      update: {
        name: dept.name,
        description: dept.description,
        managerName: dept.managerName,
        location: dept.location,
        budgetCode: dept.budgetCode,
      },
      create: dept,
    });
    console.log(`[EEC-RMS Seed] Department seeded: ${d.code} - ${d.name} (${d.id})`);
  }

  // 2. Seed Users Connected to Departments
  const seedUsers = [
    {
      email: 'admin@eec.gov.et',
      fullName: 'Abebe Bikila',
      role: 'ADMIN',
      status: 'APPROVED',
      departmentId: 'dept-107',
    },
    {
      email: 'storekeeper@eec.gov.et',
      fullName: 'Almaz Ayana',
      role: 'STORE_KEEPER',
      status: 'APPROVED',
      departmentId: 'dept-108',
    },
    {
      email: 'technician@eec.gov.et',
      fullName: 'Kenenisa Bekele',
      role: 'IT_TECHNICIAN',
      status: 'APPROVED',
      departmentId: 'dept-107',
    },
    {
      email: 'manager@eec.gov.et',
      fullName: 'Derartu Tulu',
      role: 'DEPARTMENT_MANAGER',
      status: 'APPROVED',
      departmentId: 'dept-101',
    },
    {
      email: 'employee@eec.gov.et',
      fullName: 'Haile Gebrselassie',
      role: 'EMPLOYEE',
      status: 'APPROVED',
      departmentId: 'dept-101',
    },
    {
      email: 'pending.applicant@eec.gov.et',
      fullName: 'Tirunesh Dibaba',
      role: 'EMPLOYEE',
      status: 'PENDING',
      departmentId: 'dept-101',
    },
  ];

  const userMap: Record<string, string> = {};

  for (const u of seedUsers) {
    const record = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        role: u.role,
        status: u.status,
        departmentId: u.departmentId,
      },
      create: {
        email: u.email,
        fullName: u.fullName,
        passwordHash,
        role: u.role,
        status: u.status,
        departmentId: u.departmentId,
      },
    });
    userMap[record.email] = record.id;
    console.log(`[EEC-RMS Seed] User seeded: ${record.email} (${record.role} in ${record.departmentId})`);
  }

  // 3. Seed Employee Personnel Roster
  const employeesData = [
    {
      employeeId: 'EEC-EMP-001',
      name: 'Abebe Bikila',
      email: 'admin@eec.gov.et',
      phone: '+251 911 458290',
      departmentId: 'dept-107',
      designation: 'Senior Systems Administrator',
      role: 'ADMIN',
      userId: userMap['admin@eec.gov.et'],
    },
    {
      employeeId: 'EEC-EMP-015',
      name: 'Almaz Ayana',
      email: 'storekeeper@eec.gov.et',
      phone: '+251 912 884123',
      departmentId: 'dept-108',
      designation: 'Chief Store Keeper',
      role: 'STORE_KEEPER',
      userId: userMap['storekeeper@eec.gov.et'],
    },
    {
      employeeId: 'EEC-EMP-028',
      name: 'Kenenisa Bekele',
      email: 'technician@eec.gov.et',
      phone: '+251 913 235467',
      departmentId: 'dept-107',
      designation: 'IT Support & Network Technician',
      role: 'IT_TECHNICIAN',
      userId: userMap['technician@eec.gov.et'],
    },
    {
      employeeId: 'EEC-EMP-006',
      name: 'Derartu Tulu',
      email: 'manager@eec.gov.et',
      phone: '+251 911 890112',
      departmentId: 'dept-101',
      designation: 'Director, Transport & Infrastructure',
      role: 'DEPARTMENT_MANAGER',
      userId: userMap['manager@eec.gov.et'],
    },
    {
      employeeId: 'EEC-EMP-045',
      name: 'Haile Gebrselassie',
      email: 'employee@eec.gov.et',
      phone: '+251 911 556789',
      departmentId: 'dept-101',
      designation: 'Senior Highway Design Engineer',
      role: 'EMPLOYEE',
      userId: userMap['employee@eec.gov.et'],
    },
    {
      employeeId: 'EEC-EMP-042',
      name: 'Eng. Solomon Debebe',
      email: 'solomon.debebe@eec.gov.et',
      phone: '+251 911 345678',
      departmentId: 'dept-101',
      designation: 'Resident Highway Project Engineer',
      role: 'EMPLOYEE',
    },
    {
      employeeId: 'EEC-EMP-051',
      name: 'Tsedey Mekonnen',
      email: 'tsedey.mekonnen@eec.gov.et',
      phone: '+251 912 456789',
      departmentId: 'dept-101',
      designation: 'Bridge Design Specialist',
      role: 'EMPLOYEE',
    },
    {
      employeeId: 'EEC-EMP-007',
      name: 'Dr. Amare Kassahun',
      email: 'amare.kassahun@eec.gov.et',
      phone: '+251 911 778899',
      departmentId: 'dept-102',
      designation: 'Director, Water Resources Directorate',
      role: 'DEPARTMENT_MANAGER',
    },
    {
      employeeId: 'EEC-EMP-022',
      name: 'Eng. Meron Teshome',
      email: 'meron.teshome@eec.gov.et',
      phone: '+251 912 667788',
      departmentId: 'dept-102',
      designation: 'Irrigation Schemes Specialist',
      role: 'EMPLOYEE',
    },
    {
      employeeId: 'EEC-EMP-009',
      name: 'Eng. Berhanu Tesfaye',
      email: 'berhanu.tesfaye@eec.gov.et',
      phone: '+251 911 112233',
      departmentId: 'dept-103',
      designation: 'Director, Geotechnical Engineering',
      role: 'DEPARTMENT_MANAGER',
    },
    {
      employeeId: 'EEC-EMP-031',
      name: 'Yonas Tariku',
      email: 'yonas.tariku@eec.gov.et',
      phone: '+251 913 445566',
      departmentId: 'dept-103',
      designation: 'Senior Geodetic Surveyor',
      role: 'EMPLOYEE',
    },
  ];

  for (const emp of employeesData) {
    const e = await prisma.employee.upsert({
      where: { employeeId: emp.employeeId },
      update: {
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        departmentId: emp.departmentId,
        designation: emp.designation,
        role: emp.role,
        userId: emp.userId || null,
      },
      create: {
        employeeId: emp.employeeId,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        departmentId: emp.departmentId,
        designation: emp.designation,
        role: emp.role,
        userId: emp.userId || null,
      },
    });
    console.log(`[EEC-RMS Seed] Employee seeded: ${e.employeeId} - ${e.name} (${e.departmentId})`);
  }

  console.log('[EEC-RMS Seed] Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('[EEC-RMS Seed] Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
