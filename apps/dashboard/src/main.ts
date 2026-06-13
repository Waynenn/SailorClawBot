export function startDashboard(): void {
  console.log('SailorClawBot dashboard placeholder');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startDashboard();
}
