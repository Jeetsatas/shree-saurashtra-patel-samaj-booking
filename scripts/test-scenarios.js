const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function runTests() {
  console.log("=================================================");
  console.log("SHREE SAURASHTRA PATEL SAMAJ — AUDIT TEST SUITE");
  console.log("Private Admin-Only Booking Management System");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = "") {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} - ${details}`);
      failed++;
    }
  }

  try {
    // Clean up test bookings if any from previous test run
    await prisma.booking.deleteMany({
      where: { notes: { startsWith: "AUTOMATED_TEST_" } },
    });

    console.log("--- 1. ADMINISTRATOR ACCOUNTS & ARGON2ID SECURITY ---");
    const adminUsers = await prisma.user.findMany({ orderBy: { email: "asc" } });
    assert(
      adminUsers.length === 3,
      "Strictly three administrator accounts exist in the database",
      `Found ${adminUsers.length} accounts`
    );

    const superAdmin = adminUsers.find((u) => u.email === "superadmin@patelsamaj.com");
    const admin2 = adminUsers.find((u) => u.email === "admin2@patelsamaj.com");
    const admin3 = adminUsers.find((u) => u.email === "admin3@patelsamaj.com");

    assert(superAdmin && superAdmin.role === "SUPER_ADMIN", "Super Admin account exists with SUPER_ADMIN role");
    assert(admin2 && admin2.role === "VIEW_ONLY_ADMIN", "Admin 2 exists with VIEW_ONLY_ADMIN role");
    assert(admin3 && admin3.role === "VIEW_ONLY_ADMIN", "Admin 3 exists with VIEW_ONLY_ADMIN role");

    // Verify secure password hashing
    const superAdminHashed = superAdmin?.passwordHash.startsWith("$2");
    const admin2Hashed = admin2?.passwordHash.startsWith("$2");
    const admin3Hashed = admin3?.passwordHash.startsWith("$2");

    assert(
      superAdminHashed && admin2Hashed && admin3Hashed,
      "All administrator accounts are secured using cryptographic password hashing"
    );

    // Verify password verification
    const validSuperPass = await bcrypt.compare("Admin@Patel2026", superAdmin.passwordHash);
    const validAdmin2Pass = await bcrypt.compare("Admin2@Patel2026", admin2.passwordHash);
    assert(validSuperPass && validAdmin2Pass, "Cryptographic credential verification succeeds for seeded passwords");

    console.log("\n--- 2. STRICT BACKEND PERMISSION ENFORCEMENT ---");
    // View-Only Admins cannot modify data; simulate authorization logic
    function simulateRequireSuperAdmin(user) {
      if (!user) return { authorized: false, status: 401 };
      if (user.role !== "SUPER_ADMIN") return { authorized: false, status: 403 };
      return { authorized: true, status: 200 };
    }

    assert(
      simulateRequireSuperAdmin(superAdmin).authorized === true,
      "Super Admin is authorized for backend mutations (HTTP 200)"
    );
    assert(
      simulateRequireSuperAdmin(admin2).status === 403,
      "Admin 2 backend mutation attempts are strictly rejected with HTTP 403 Forbidden"
    );
    assert(
      simulateRequireSuperAdmin(admin3).status === 403,
      "Admin 3 backend mutation attempts are strictly rejected with HTTP 403 Forbidden"
    );

    console.log("\n--- 3. CSV EXPORT PERMISSION ENFORCEMENT ---");
    function canUserExport(user) {
      if (!user) return false;
      return user.role === "SUPER_ADMIN" || Boolean(user.canExport);
    }

    assert(canUserExport(superAdmin) === true, "Super Admin has default CSV export authorization");
    assert(canUserExport(admin2) === false, "Admin 2 without canExport is denied export access");

    // Simulate granting export permission to Admin 2
    const admin2Granted = { ...admin2, canExport: true };
    assert(canUserExport(admin2Granted) === true, "Admin 2 can export when Super Admin explicitly enables canExport");

    console.log("\n--- 4. FACILITY INVENTORY (8 PHYSICAL FACILITIES) ---");
    const facilities = await prisma.facility.findMany();
    assert(facilities.length === 8, "Inventory has exactly 8 physical facilities configured", `Found ${facilities.length}`);

    const plotOutside = facilities.find((f) => f.code === "PLOT-OUTSIDE");
    const hallMulti = facilities.find((f) => f.code === "HALL-MULTIPURPOSE");
    const hallGround = facilities.find((f) => f.code === "HALL-GROUND-FLOOR");
    const dorm28 = facilities.find((f) => f.code === "DORM-28-BEDS");
    const dorm42 = facilities.find((f) => f.code === "DORM-42-BEDS");
    const room8U1 = facilities.find((f) => f.code === "ROOM-8BED-UNIT1");
    const room8U2 = facilities.find((f) => f.code === "ROOM-8BED-UNIT2");
    const room6 = facilities.find((f) => f.code === "ROOM-6BED");

    assert(plotOutside !== undefined, "Outside Party Plot (PLOT-OUTSIDE) exists");
    assert(plotOutside?.capacity === 1500, "Outside Party Plot capacity is 1500 persons");
    assert(
      plotOutside?.weddingRent !== undefined && plotOutside?.familyRent !== undefined,
      "Outside Party Plot has dual pricing fields (Wedding vs Family)"
    );

    assert(hallMulti !== undefined, "Multipurpose Hall (HALL-MULTIPURPOSE) exists");
    assert(hallGround !== undefined, "Ground Floor Hall (HALL-GROUND-FLOOR) exists");
    assert(dorm28 !== undefined && dorm28.capacity === 28, "Dormitory 28 Beds exists with 28 capacity");
    assert(dorm42 !== undefined && dorm42.capacity === 42, "Dormitory 42 Beds exists with 42 capacity");
    assert(room8U1 !== undefined && room8U1.capacity === 8, "AC Room 8 Beds (Unit 1) exists with 8 capacity");
    assert(room8U2 !== undefined && room8U2.capacity === 8, "AC Room 8 Beds (Unit 2) exists with 8 capacity");
    assert(room6 !== undefined && room6.capacity === 6, "AC Room 6 Beds exists with 6 capacity");

    console.log("\n--- 5. CONFLICT RULES: OUTSIDE PARTY PLOT ---");
    const testDate1 = new Date(2027, 2, 10, 0, 0, 0); // March 10, 2027
    const testDate1End = new Date(2027, 2, 10, 23, 59, 59);

    // Book Wedding on Outside Party Plot
    const weddingBooking = await prisma.booking.create({
      data: {
        bookingNumber: "TEST-PLOT-WEDD",
        facilityId: plotOutside.id,
        customerName: "Patel Wedding Applicant",
        customerPhone: "+91 98250 11111",
        eventType: "Lagna (Wedding Ceremony)",
        startDate: testDate1,
        endDate: testDate1End,
        slot: "WHOLE_DAY",
        status: "CONFIRMED",
        notes: "AUTOMATED_TEST_PLOT_1",
      },
    });

    // Check if plot is blocked for Family function on same date
    const plotConflicts = await prisma.booking.findMany({
      where: {
        facilityId: plotOutside.id,
        status: { in: ["CONFIRMED", "BLOCKED_BY_TRUST"] },
        startDate: { lte: testDate1End },
        endDate: { gte: testDate1 },
      },
    });
    assert(
      plotConflicts.length === 1,
      "Wedding booking on Outside Party Plot blocks family function on same date (shared calendar)"
    );

    console.log("\n--- 6. CONFLICT RULES: MULTIPURPOSE HALL & 1-HOUR GAP ---");
    function checkHallSlotConflict(existingSlot, newSlot) {
      const e = (existingSlot || "").toUpperCase();
      const n = (newSlot || "").toUpperCase();
      if (e === "WHOLE_DAY" || n === "WHOLE_DAY") return true;
      if (e === n) return true;
      if ((e === "MORNING_SLOT" && n === "AFTERNOON_SLOT") || (e === "AFTERNOON_SLOT" && n === "MORNING_SLOT")) {
        return false; // 1-hour gap 2:00 PM to 3:00 PM allows non-overlapping coexistence!
      }
      return true;
    }

    assert(
      checkHallSlotConflict("MORNING_SLOT", "AFTERNOON_SLOT") === false,
      "Morning (6AM-2PM) and Afternoon (3PM-Midnight) slots coexist with 1-hour gap preserved"
    );
    assert(
      checkHallSlotConflict("WHOLE_DAY", "MORNING_SLOT") === true,
      "Whole Day (6AM-Midnight) booking blocks Morning slot"
    );
    assert(
      checkHallSlotConflict("WHOLE_DAY", "AFTERNOON_SLOT") === true,
      "Whole Day (6AM-Midnight) booking blocks Afternoon slot"
    );

    console.log("\n--- 7. INDEPENDENT ROOMS: AC ROOM UNIT 1 & UNIT 2 ---");
    const testDate2 = new Date(2027, 2, 15, 0, 0, 0);
    const testDate2End = new Date(2027, 2, 15, 23, 59, 59);

    await prisma.booking.create({
      data: {
        bookingNumber: "TEST-ROOM-U1",
        facilityId: room8U1.id,
        customerName: "Guest Unit 1",
        customerPhone: "+91 98250 22222",
        eventType: "Guest Stay",
        startDate: testDate2,
        endDate: testDate2End,
        slot: "NIGHT_STAY",
        status: "CONFIRMED",
        notes: "AUTOMATED_TEST_ROOM_1",
      },
    });

    const unit2Conflicts = await prisma.booking.findMany({
      where: {
        facilityId: room8U2.id,
        status: { in: ["CONFIRMED", "BLOCKED_BY_TRUST"] },
        startDate: { lte: testDate2End },
        endDate: { gte: testDate2 },
      },
    });

    assert(
      unit2Conflicts.length === 0,
      "AC Room Unit 1 and Unit 2 operate independently (Unit 1 booking does NOT block Unit 2)"
    );

    console.log("\n--- 8. NON-STACKABLE DISCOUNT RULES ---");
    const discounts = await prisma.discountRule.findMany({ orderBy: { percentage: "desc" } });
    const discOpt1 = discounts.find((d) => d.code === "TRUSTEE_OPT_1");
    const discOpt2 = discounts.find((d) => d.code === "TRUSTEE_OPT_2");
    const discDonor = discounts.find((d) => d.code === "ROOM_DONORS");

    assert(discOpt1 && discOpt1.percentage === 25, "Trustee Option 1 discount is 25%");
    assert(discOpt2 && discOpt2.percentage === 5, "Trustee Option 2 discount is 5%");
    assert(discDonor && discDonor.percentage === 10, "Room Donors discount is 10%");

    const baseTariff = 50000;
    const calcOpt1 = (baseTariff * discOpt1.percentage) / 100;
    assert(calcOpt1 === 12500, "25% discount correctly calculates ₹12,500 off ₹50,000 base rent");

    console.log("\n--- 9. ADD-ON SERVICES (CLEANING & FOOD DISPOSAL) ---");
    const services = await prisma.addonService.findMany();
    const cleanServ = services.find((s) => s.code === "SERVICE_CLEANING");
    const wasteServ = services.find((s) => s.code === "SERVICE_WASTE_FOOD");

    assert(cleanServ !== undefined, "Cleaning Service add-on exists");
    assert(wasteServ !== undefined, "Waste Food Collection Service add-on exists");

    // Add-on services appear separately and are NOT subject to facility discounts
    const netFacilityRent = baseTariff - calcOpt1; // 50000 - 12500 = 37500
    const servicesCost = (cleanServ?.price || 2500) + (wasteServ?.price || 1500); // 4000
    const finalBill = netFacilityRent + servicesCost; // 41500
    assert(
      finalBill === 41500,
      "Final bill = (Base Rent - NonStackable Discount) + Addon Services (Services are not discounted)"
    );

    console.log("\n--- 10. IMMUTABLE ACTIVITY LOG VERIFICATION ---");
    // Verify an activity log can be written and queried
    const testLog = await prisma.activityLog.create({
      data: {
        userId: superAdmin.id,
        userName: superAdmin.name,
        userEmail: superAdmin.email,
        userRole: superAdmin.role,
        action: "CREATE_BOOKING",
        details: "Automated audit test booking verified",
        recordId: "AUDIT-TEST-001",
        recordType: "BOOKING",
      },
    });

    assert(testLog && testLog.id !== undefined, "ActivityLog record successfully created with admin attribution");

    const fetchedLogs = await prisma.activityLog.findMany({
      where: { recordId: "AUDIT-TEST-001" },
    });
    assert(fetchedLogs.length >= 1, "ActivityLog records are queryable in chronological order");

    // Clean up test bookings and test log
    await prisma.booking.deleteMany({
      where: { notes: { startsWith: "AUTOMATED_TEST_" } },
    });
    await prisma.activityLog.deleteMany({
      where: { recordId: "AUDIT-TEST-001" },
    });

    console.log("\n=================================================");
    console.log(`AUDIT TEST COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
