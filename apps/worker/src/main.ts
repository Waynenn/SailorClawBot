export function startWorker(): void {
  console.log('SailorClawBot worker placeholder');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker();
}
