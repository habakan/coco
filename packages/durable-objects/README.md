# @cashu/coco-durable-objects (prototype)

Experimental coco storage adapter for the SQLite storage of a Cloudflare Durable Object.

```ts
import { DurableObject } from 'cloudflare:workers';
import { DurableObjectRepositories } from '@cashu/coco-durable-objects';

export class Wallet extends DurableObject {
  repositories = new DurableObjectRepositories({ storage: this.ctx.storage });
}
```

Transactions use `ctx.storage.transaction()`, because Durable Object SQLite rejects `BEGIN`.
Repositories must be used from inside the Durable Object.

Status: 83 of 84 adapter contract tests pass (`bun run test`). Known gaps:

- `ensureSchema` sets `journal_mode`, `synchronous`, and `busy_timeout`, which Durable Objects
  reject. The prototype skips those three pragmas in `exec`.
- Durable Object SQLite allows 100 bound parameters per query, below the 900-secret batch in
  `ProofRepository.getProofsBySecrets`.
