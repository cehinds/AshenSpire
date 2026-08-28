export function main() {
  console.log('HANDROLLED_URL_RAN');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
