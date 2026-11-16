/** Add 80 units on each straight vertical leg. Both rounded corners retain their shape. */
export function stretchJourneyZ(z: number) {
  if (z <= 45) return z;
  if (z <= 110) return z + (z - 45) / 65 * 80;
  if (z <= 140) return z + 80 + (z - 110) / 30 * 80;
  return z + 160;
}
