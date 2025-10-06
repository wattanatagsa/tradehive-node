import prisma from './prisma';

async function main() {
  // ดึงข้อมูลทั้งหมดจากตาราง users
  const users = await prisma.users.findMany();
  console.log('📦 Users:', users);
}

main()
  .catch((e) => console.error('❌ Error:', e))
  .finally(async () => await prisma.$disconnect());
