export function generateSpace(scaleSize: number): Record<string, string> {
  const space: Record<string, string> = {};
  for (let i = 1; i <= 50; i++) {
    space[i.toString()] = `${i * scaleSize}px`;
  }
  return space;
}
