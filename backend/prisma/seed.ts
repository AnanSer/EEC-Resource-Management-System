import prisma from '../src/lib/prisma';
import { hashPassword } from '../src/auth/password';

async function main() {
  console.log('[EEC-RMS Seed] Starting database seeding for auth accounts...');

  const defaultPassword = 'EEC-Secure2026!';
  const passwordHash = await hashPassword(defaultPassword);

  const seedUsers = [
    {
      email: 'admin@eec.gov.et',
      fullName: 'Abebe Bikila',
      role: 'ADMIN',
      status: 'APPROVED',
    },
    {
      email: 'storekeeper@eec.gov.et',
      fullName: 'Almaz Ayana',
      role: 'STORE_KEEPER',
      status: 'APPROVED',
    },
    {
      email: 'technician@eec.gov.et',
      fullName: 'Kenenisa Bekele',
      role: 'IT_TECHNICIAN',
      status: 'APPROVED',
    },
    {
      email: 'manager@eec.gov.et',
      fullName: 'Derartu Tulu',
      role: 'DEPARTMENT_MANAGER',
      status: 'APPROVED',
    },
    {
      email: 'employee@eec.gov.et',
      fullName: 'Haile Gebrselassie',
      role: 'EMPLOYEE',
      status: 'APPROVED',
    },
    {
      email: 'pending.applicant@eec.gov.et',
      fullName: 'Tirunesh Dibaba',
      role: 'EMPLOYEE',
      status: 'PENDING',
    },
  ];

  for (const u of seedUsers) {
    const record = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        role: u.role,
        status: u.status,
      },
      create: {
        email: u.email,
        fullName: u.fullName,
        passwordHash,
        role: u.role,
        status: u.status,
      },
    });
    console.log(`[EEC-RMS Seed] User seeded: ${record.email} (${record.role} - ${record.status})`);
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
