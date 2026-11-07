const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const beforeCount = await prisma.booking.count();
  console.log(`Current bookings before deletion: ${beforeCount}`);

  // Delete all booking records
  const result = await prisma.booking.deleteMany({});
  console.log(`Deleted ${result.count} bookings from database.`);

  // Also clear any test booking activity logs
  const deletedLogs = await prisma.activityLog.deleteMany({
    where: { recordType: "BOOKING" }
  });
  console.log(`Cleaned up ${deletedLogs.count} booking activity logs.`);

  const afterCount = await prisma.booking.count();
  const facilityCount = await prisma.facility.count();
  const userCount = await prisma.user.count();

  console.log(`\nVerification:`);
  console.log(`- Bookings remaining: ${afterCount}`);
  console.log(`- Facilities preserved: ${facilityCount}`);
  console.log(`- Admin users preserved: ${userCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
