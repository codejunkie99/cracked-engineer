# MODULES.md

<!--
One contract per module. Start with the modules that own money, private data, or external calls.
A change to a contract needs an ADR in docs/adr/. Check the file with: node .cracked/check_system.mjs
-->

## module: <name>

### owns
- tables: <list>
- the only code that calls <external system>

### public interface
- `<function>(<args>) -> <results, failure results included>`

### consistency
- CONSISTENT or EVENTUAL. <where reads go>

### promises
- <what the module guarantees, as statements a test can check>

### failure behavior
- <dependency> timeout: <n> s (TARGET) -> <result>
- <dependency> down: <result>

### the hard part
- <the one failure that needs the most care>

### red tests
- `<test id>`

### not allowed
- Other modules read or write <name> tables directly.
- The contract changes without an ADR.
