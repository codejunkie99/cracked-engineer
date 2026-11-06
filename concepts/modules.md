# Modules

Read when the work draws or changes a module boundary, adds a service, moves shared state, or adds an import between modules.

## Decide

- The modules, and what each one owns. Write a contract in `MODULES.md` for each module that owns money, private data, or external calls.
- The default shape: a modular monolith. One deployable web process, one worker process, one shared database, and strict boundaries inside.
- A split into a separate service only for a named reason: a different scaling need, a different owner, or a different failure domain. Write the reason in an ADR.

## The boundary question

Ask one question of every group of code: should these pieces change together?

- Pieces that change together go in one module.
- Pieces that change for different reasons do not share a module.
- Each module depends on modules that change less often than it does.

## Design red flags

Check every proposed shape for these. Each flag assumes the next contributor is an agent that sees only the files it opens, copies the nearest example, and takes the shortest path that compiles.

- **Shallow module.** A large interface that hides little. Callers coordinate several calls to finish one operation.
- **Information leakage.** One internal decision (a format, a policy, a protocol detail) appears in several modules.
- **Split ownership.** More than one module writes the same state.
- **Two ways to do one task.** An agent copies whichever way it finds first, so both ways grow.
- **Importable internals.** A caller can import a module's internals, so the internals become part of the interface.
- **Hand-synced lists.** Two lists hold the same items, and adding an item means editing both.

## Rules

| Rule | Default | Enforcer (level) |
|---|---|---|
| Modules talk through their public interface only | internals cannot be imported from outside | Go `internal/` packages, Rust `pub(crate)` and crate boundaries, a package `exports` map in Node (architecture), an import checker (lint) |
| Each table has one writer | the owner module in `MODULES.md` | one database role or schema per module (permission), `single_writer_per_table` (test) |
| A new service or datastore has an ADR | the ADR names the reason for the split | PR review (doc) |
| A contract change has an ADR | the ADR names the callers that change | PR review (doc) |

## Red tests

### `module_boundaries_hold`

- Run: the import checker over the codebase (import-linter, dependency-cruiser, ArchUnit, or the compiler for Go `internal/`).
- Assert: no module imports another module's internal files.
- Break: import `billing/internal/plans` from `feed`.
- Expect: the checker names the forbidden import.

### `single_writer_per_table`

- Run: with each module's database role, try to write to a table that another module owns.
- Assert: the write is denied.
- Break: grant the feed role write access on `ledger_entries`.
- Expect: the write succeeds.

## Audit

- Imports of another module's internal paths.
- SQL against a table from a module that does not own it.
- Two modules that keep their own copy of the same data with no sync rule.
- Services split on day one with no ADR, and one giant file that holds every module.

## Traps

- A microservice split with shared tables is a distributed monolith: every deploy still moves together.
- Service discovery (Consul, etcd, ZooKeeper) and health checks are costs of a split. Count them in the ADR.
