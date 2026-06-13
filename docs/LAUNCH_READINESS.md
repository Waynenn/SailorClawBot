# Launch Readiness

Launch is blocked until these validation steps pass:

```sh
pnpm install
pnpm build
pnpm prisma validate
pnpm prisma generate
```

Additional launch gates:

- Discord credentials configured.
- PostgreSQL available.
- Database migrations applied.
- Bot login verified.
- Worker retry and DLQ behavior verified.
- Dashboard authentication verified.
