// Unconditional: project, environment, --force and --dry-run cannot authorize
// deployment of this emulator-only configuration. No imports or network access.
console.error('DEPLOYMENT_REFUSED: firebase.emulators.json is reserved for emulators. Use firebase.json for normal Hosting deployment.')
process.exitCode = 1
