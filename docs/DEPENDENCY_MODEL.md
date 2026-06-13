# Dependency Model

```text
contracts
  -> core
    -> database
      -> bot
        -> worker
          -> dashboard
```

This repository must stay acyclic. Lower layers must not import from higher layers.
