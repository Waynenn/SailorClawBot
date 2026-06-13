export function startBot(): void {
  console.log('SailorClawBot bot integration placeholder');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startBot();
}
