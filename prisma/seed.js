const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Patel Samaj Private Admin Booking Database...");

  // 1. Create / Upsert the 3 Authorized Admin Accounts with Argon2id Hashing
  const superAdminPassword = process.env.INITIAL_SUPER_ADMIN_PASSWORD || "Admin@Patel2026";
  const admin2Password = process.env.INITIAL_ADMIN2_PASSWORD || "Admin2@Patel2026";
  const admin3Password = process.env.INITIAL_ADMIN3_PASSWORD || "Admin3@Patel2026";

  const superAdminHash = await argon2.hash(superAdminPassword, { type: argon2.argon2id });
  const admin2Hash = await argon2.hash(admin2Password, { type: argon2.argon2id });
  const admin3Hash = await argon2.hash(admin3Password, { type: argon2.argon2id });

  const adminUsers = [
    {
      name: "Trustee Office (Super Admin)",
      email: "superadmin@patelsamaj.com",
      passwordHash: superAdminHash,
      role: "SUPER_ADMIN",
      canExport: true,
      phone: "+91 98250 12345",
      isActive: true,
    },
    {
      name: "Admin 2 (View Only)",
      email: "admin2@patelsamaj.com",
      passwordHash: admin2Hash,
      role: "VIEW_ONLY_ADMIN",
      canExport: false,
      phone: "+91 98251 67890",
      isActive: true,
    },
    {
      name: "Admin 3 (View Only)",
      email: "admin3@patelsamaj.com",
      passwordHash: admin3Hash,
      role: "VIEW_ONLY_ADMIN",
      canExport: false,
      phone: "+91 98252 54321",
      isActive: true,
    },
  ];

  for (const u of adminUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        canExport: u.canExport,
        passwordHash: u.passwordHash,
        isActive: u.isActive,
      },
      create: u,
    });
  }

  // Update any existing users (manager/staff) to VIEW_ONLY_ADMIN if they exist
  await prisma.user.updateMany({
    where: { email: { in: ["manager@patelsamaj.com", "staff@patelsamaj.com"] } },
    data: { role: "VIEW_ONLY_ADMIN", canExport: false },
  });

  console.log("✓ Admin accounts initialized with Argon2id hashing.");

  // 2. Multipurpose Hall configurable time slots
  const multipurposeSlots = JSON.stringify([
    {
      id: "WHOLE_DAY",
      name: "Whole Day",
      startTime: "06:00",
      endTime: "24:00",
      description: "6:00 AM to 12:00 Midnight",
    },
    {
      id: "MORNING",
      name: "Morning Slot",
      startTime: "06:00",
      endTime: "14:00",
      description: "6:00 AM to 2:00 PM",
    },
    {
      id: "AFTERNOON",
      name: "Afternoon Slot",
      startTime: "15:00",
      endTime: "24:00",
      description: "3:00 PM to 12:00 Midnight",
    },
  ]);

  // Actual Facility Inventory (8 Physical Facilities)
  const facilities = [
    {
      name: "Outside Party Plot",
      code: "PLOT-OUTSIDE",
      type: "PLOT",
      resourceGroup: "RESOURCE_PARTY_PLOT",
      capacity: 1500,
      floor: "Open Ground Lawn",
      description: "Grand open-air landscaped party plot for wedding celebrations and family functions with lawn lighting, stage setup, and catering area.",
      amenities: "Lawn Area, High Mast Lighting, Stage Setup Area, Separate Catering Entry, Water Points, Power Backup Generator",
      baseRent: 0,
      weddingRent: 0,
      familyRent: 0,
      cautionDeposit: 0,
      cleaningCharge: 0,
      isRateConfigured: false,
      bookingDuration: "Full Day / Event Date (Wedding & Family Functions)",
      bookingUnit: "ENTIRE_FACILITY",
      order: 1,
    },
    {
      name: "Multipurpose Hall",
      code: "HALL-MULTIPURPOSE",
      type: "HALL",
      resourceGroup: "RESOURCE_MULTIPURPOSE_HALL",
      capacity: 600,
      floor: "1st Floor",
      description: "Spacious air-conditioned multipurpose hall suitable for community gatherings, exhibitions, engagements, and meetings. Available in Whole Day, Morning, or Afternoon slots.",
      amenities: "Central Air Conditioning, Audio Sound System, Stage, 400 Chairs, Changing Rooms, Elevator Access",
      baseRent: 0,
      cautionDeposit: 0,
      cleaningCharge: 0,
      isRateConfigured: false,
      bookingDuration: "Configurable Slot (Whole Day, Morning 6AM-2PM, Afternoon 3PM-12AM)",
      availableSlots: multipurposeSlots,
      bookingUnit: "ENTIRE_FACILITY",
      order: 2,
    },
    {
      name: "Ground Floor Hall",
      code: "HALL-GROUND-FLOOR",
      type: "HALL",
      resourceGroup: "RESOURCE_HALL_GROUND",
      capacity: 500,
      floor: "Ground Floor",
      description: "Independent multi-purpose ground floor community hall with direct entry and kitchen access.",
      amenities: "High Ceiling Fans, Attached Kitchen Facility, Handwash Area, Chairs, Easy Ground-Level Access",
      baseRent: 0,
      weddingRent: 0,
      familyRent: 0,
      cautionDeposit: 0,
      cleaningCharge: 0,
      isRateConfigured: false,
      bookingDuration: "Full Day / Slot Basis",
      bookingUnit: "ENTIRE_FACILITY",
      order: 3,
    },
    {
      name: "Dormitory — 28 Beds",
      code: "DORM-28-BEDS",
      type: "DORMITORY",
      resourceGroup: "RESOURCE_DORM_28",
      capacity: 28,
      floor: "3rd Floor",
      description: "Hygienic AC dormitory equipped with 28 individual beds and mattresses, personal lockers, and attached washrooms.",
      amenities: "28 Single Beds, Air Conditioning, Personal Lockers, Geysers & Hot Water, Filtered Water Cooler",
      baseRent: 0,
      weddingRent: 0,
      familyRent: 0,
      cautionDeposit: 0,
      cleaningCharge: 0,
      isRateConfigured: false,
      bookingDuration: "Per Night Stay (Check-in 11 AM / Check-out 10 AM)",
      bookingUnit: "PER_BED",
      order: 4,
    },
    {
      name: "Dormitory — 42 Beds",
      code: "DORM-42-BEDS",
      type: "DORMITORY",
      resourceGroup: "RESOURCE_DORM_42",
      capacity: 42,
      floor: "3rd Floor",
      description: "Spacious AC dormitory equipped with 42 individual beds and mattresses for outstation community guests and marriage parties.",
      amenities: "42 Single Beds, Air Conditioning, Individual Lockers, 8 Restrooms with Hot Water, RO Water",
      baseRent: 0,
      weddingRent: 0,
      familyRent: 0,
      cautionDeposit: 0,
      cleaningCharge: 0,
      isRateConfigured: false,
      bookingDuration: "Per Night Stay",
      bookingUnit: "PER_BED",
      order: 5,
    },
    {
      name: "AC Room — 8 Beds (Unit 1)",
      code: "ROOM-8BED-UNIT1",
      type: "ROOM",
      resourceGroup: "RESOURCE_ROOM_8BED_U1",
      capacity: 8,
      floor: "2nd Floor",
      description: "Unit 1: Fully air-conditioned family suite with 8 beds and attached private bathroom. Independent from Unit 2.",
      amenities: "8 Beds, Split AC, Attached Modern Bathroom with Geyser, Wardrobe, Intercom",
      baseRent: 0,
      weddingRent: 0,
      familyRent: 0,
      cautionDeposit: 0,
      cleaningCharge: 0,
      isRateConfigured: false,
      bookingDuration: "Per Night Stay",
      bookingUnit: "ENTIRE_ROOM",
      order: 6,
    },
    {
      name: "AC Room — 6 Beds",
      code: "ROOM-6BED",
      type: "ROOM",
      resourceGroup: "RESOURCE_ROOM_6BED",
      capacity: 6,
      floor: "2nd Floor",
      description: "Fully air-conditioned family room with 6 beds and attached private bathroom.",
      amenities: "6 Beds, Split AC, Attached Bathroom, Wardrobe, Geyser",
      baseRent: 0,
      weddingRent: 0,
      familyRent: 0,
      cautionDeposit: 0,
      cleaningCharge: 0,
      isRateConfigured: false,
      bookingDuration: "Per Night Stay",
      bookingUnit: "ENTIRE_ROOM",
      order: 7,
    },
    {
      name: "AC Room — 8 Beds (Unit 2)",
      code: "ROOM-8BED-UNIT2",
      type: "ROOM",
      resourceGroup: "RESOURCE_ROOM_8BED_U2",
      capacity: 8,
      floor: "2nd Floor",
      description: "Unit 2: Fully air-conditioned family suite with 8 beds and attached private bathroom. Independent physical room from Unit 1 with its own calendar.",
      amenities: "8 Beds, Split AC, Attached Modern Bathroom with Geyser, Wardrobe, Intercom",
      baseRent: 0,
      weddingRent: 0,
      familyRent: 0,
      cautionDeposit: 0,
      cleaningCharge: 0,
      isRateConfigured: false,
      bookingDuration: "Per Night Stay",
      bookingUnit: "ENTIRE_ROOM",
      order: 8,
    },
  ];

  for (const f of facilities) {
    await prisma.facility.upsert({
      where: { code: f.code },
      update: {
        name: f.name,
        type: f.type,
        resourceGroup: f.resourceGroup,
        capacity: f.capacity,
        floor: f.floor,
        description: f.description,
        amenities: f.amenities,
        weddingRent: f.weddingRent,
        familyRent: f.familyRent,
        bookingDuration: f.bookingDuration,
        availableSlots: f.availableSlots,
        bookingUnit: f.bookingUnit,
        order: f.order,
      },
      create: f,
    });
  }
  console.log(`✓ ${facilities.length} Actual facilities upserted with physical resource grouping.`);

  // 3. Add-on Services (Cleaning & Waste Food Collection)
  const services = [
    {
      name: "Cleaning Service",
      code: "SERVICE_CLEANING",
      description: "Post-event deep cleaning of hall, dining premises, stages, and waste disposal management by trust housekeeping team.",
      price: 0,
      isRateConfigured: false,
      isActive: true,
    },
    {
      name: "Waste Food Collection Service",
      code: "SERVICE_WASTE_FOOD",
      description: "Hygienic collection and eco-friendly clearance of leftover banquet food and kitchen organic waste per AMC trust norms.",
      price: 0,
      isRateConfigured: false,
      isActive: true,
    },
  ];

  for (const s of services) {
    await prisma.addonService.upsert({
      where: { code: s.code },
      update: {
        name: s.name,
        description: s.description,
      },
      create: s,
    });
  }
  console.log(`✓ ${services.length} Add-on Services upserted (Cleaning & Waste Food Collection).`);

  // 4. Discount Rules
  const discountRules = [
    {
      name: "Trustee — Option 1",
      code: "TRUSTEE_OPT_1",
      percentage: 25.0,
      description: "Trustee category discount option (25% off on facility rent charges).",
      isActive: true,
    },
    {
      name: "Trustee — Option 2",
      code: "TRUSTEE_OPT_2",
      percentage: 5.0,
      description: "Trustee category discount option (5% off on facility rent charges).",
      isActive: true,
    },
    {
      name: "Room Donors",
      code: "ROOM_DONORS",
      percentage: 10.0,
      description: "Special recognition discount for Samaj Trust Room Donors (10% off on facility rent charges).",
      isActive: true,
    },
  ];

  for (const d of discountRules) {
    await prisma.discountRule.upsert({
      where: { code: d.code },
      update: {
        name: d.name,
        percentage: d.percentage,
        description: d.description,
      },
      create: d,
    });
  }
  console.log(`✓ ${discountRules.length} Discount Rules upserted (Trustee Opt 1: 25%, Trustee Opt 2: 5%, Room Donors: 10%).`);

  // 5. Update Trust Settings
  await prisma.trustSetting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      trustName: "Shree Saurashtra Leuva Patel Samaj, Nikol - Naroda",
      address: "Near Nikol Lake & Ring Road, Nikol - Naroda, Ahmedabad, Gujarat 382350",
      phone: "+91 79 2298 5600 / +91 98250 12345",
      email: "info@saurashtrapatelsamajnikol.org",
      officeHours: "8:30 AM - 1:00 PM & 3:30 PM - 8:00 PM (Monday to Sunday)",
      trustRegNo: "E/15894/Ahmedabad (Charity Commissioner)",
      gstNumber: "Pending Registration",
      rules: "1. Strictly Vegetarian Food (Pure Veg) & No Alcohol inside Samaj Premises.\n2. Music & DJ must stop by 10:00 PM per Ahmedabad Police guidelines.\n3. Cleanliness must be maintained; damages will be deducted from caution deposit.\n4. Original ID proof required at the time of key handover.",
    },
  });
  console.log("✓ Trust settings verified.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
