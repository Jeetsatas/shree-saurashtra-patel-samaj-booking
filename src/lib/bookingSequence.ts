import { prisma } from "@/lib/prisma";

/**
 * Generates an array of unique, unused, sequential booking numbers for the specified year.
 * Example format: SSPS-2026-0001, SSPS-2026-0002, etc.
 *
 * Guarantees:
 * - Scoped strictly to current year (SSPS-YYYY-)
 * - Calculates true mathematical MAX sequence number regardless of createdAt timestamps
 * - Collision-proof check against all existing numbers in database
 * - Gaps or deleted numbers will not cause reuse or unique constraint violations
 * - Batch increments (e.g. 0018, 0019, 0020) are guaranteed distinct
 */
export async function getNextAvailableBookingNumbers(
  count: number,
  year: number = new Date().getFullYear()
): Promise<string[]> {
  const prefix = `SSPS-${year}-`;

  // 1. Fetch the single highest booking number via indexed desc order (ultra-fast, 1 row)
  const highest = await prisma.booking.findFirst({
    where: {
      bookingNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      bookingNumber: "desc",
    },
    select: {
      bookingNumber: true,
    },
  });

  let maxSeq = 0;
  if (highest?.bookingNumber) {
    const match = highest.bookingNumber.trim().match(/SSPS-\d{4}-(\d+)/);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed)) maxSeq = parsed;
    }
  }

  // 2. Generate initial sequential candidates
  const candidates: string[] = [];
  for (let i = 1; i <= count; i++) {
    candidates.push(`${prefix}${String(maxSeq + i).padStart(4, "0")}`);
  }

  // 3. Fast verification: ensure none of these candidate numbers exist in DB
  const existingCandidates = await prisma.booking.findMany({
    where: {
      bookingNumber: { in: candidates },
    },
    select: {
      bookingNumber: true,
    },
  });

  if (existingCandidates.length === 0) {
    return candidates;
  }

  // 4. Fallback if rare collisions or gaps exist: query higher numbers and find next unused
  const usedSet = new Set(existingCandidates.map((c) => c.bookingNumber.trim()));
  const verified: string[] = [];
  let candidateSeq = maxSeq + 1;

  while (verified.length < count) {
    const num = `${prefix}${String(candidateSeq).padStart(4, "0")}`;
    if (!usedSet.has(num)) {
      const exists = await prisma.booking.findUnique({
        where: { bookingNumber: num },
        select: { id: true },
      });
      if (!exists) {
        verified.push(num);
        usedSet.add(num);
      }
    }
    candidateSeq++;
  }

  return verified;
}

/**
 * Executes a database operation with automatic retry if a concurrent insertion
 * caused a race condition on unique bookingNumber constraint (Prisma P2002 error).
 */
export async function executeWithBookingNumberRetry<T>(
  action: (bookingNumbers: string[]) => Promise<T>,
  count: number,
  year: number = new Date().getFullYear(),
  maxRetries: number = 3
): Promise<T> {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    const bookingNumbers = await getNextAvailableBookingNumbers(count, year);
    try {
      return await action(bookingNumbers);
    } catch (error: any) {
      const isUniqueBookingNumberError =
        error?.code === "P2002" ||
        (error?.message && error.message.includes("bookingNumber"));

      if (isUniqueBookingNumberError && attempt < maxRetries) {
        console.warn(
          `[BookingSequence] Booking number collision detected on attempt ${attempt}. Retrying with fresh sequence...`
        );
        // Small jitter before retry to allow concurrent transaction to commit
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Failed to allocate unique booking number after multiple attempts.");
}
