import { describe, expect } from 'vitest';
import {
  runAuthSessionRepositoryContract,
  runKeypairAllocationContract,
  runKeysetRepositoryContract,
  runMeltOperationRepositoryContract,
  runMeltQuoteRepositoryContract,
  runMintOperationRepositoryContract,
  runMintQuoteRepositoryContract,
  runMintSwapPersistenceContract,
  runPaymentRequestReceiveRepositoryContract,
  runProofRepositoryContract,
  runReceiveOperationRepositoryContract,
  runRepositoryTransactionContract,
  runSendOperationRepositoryContract,
} from '@cashu/coco-adapter-tests';
import { runSqlDatabaseContract } from '@cashu/coco-sql-storage/test';
import { DurableObjectSqlDb } from '../db.ts';
import { DurableObjectRepositories } from '../index.ts';
import { it, storage } from './harness.ts';

async function createRepositories(mintSwap = false) {
  const repositories = new DurableObjectRepositories({ storage: storage(), mintSwap });
  await repositories.init();
  return { repositories, dispose: async () => {} };
}

async function createSharedRepositories() {
  const first = new DurableObjectRepositories({ storage: storage() });
  const second = new DurableObjectRepositories({ storage: storage() });
  await first.init();
  await second.init();
  return { first, second, dispose: async () => {} };
}

const runner = { describe, it, expect };

runSqlDatabaseContract(
  {
    createDatabase() {
      return { database: new DurableObjectSqlDb({ storage: storage() }), dispose: () => {} };
    },
  },
  runner,
);

runRepositoryTransactionContract(
  { createRepositories: () => createRepositories(), createSharedRepositories },
  runner,
);
runKeypairAllocationContract(
  { createRepositories: () => createRepositories(), createSharedRepositories },
  runner,
);
runMintSwapPersistenceContract(
  {
    createRepositories: () => createRepositories(true),
    createDisabledRepositories: () => createRepositories(),
  },
  runner,
);

for (const run of [
  runAuthSessionRepositoryContract,
  runProofRepositoryContract,
  runKeysetRepositoryContract,
  runMintOperationRepositoryContract,
  runMintQuoteRepositoryContract,
  runReceiveOperationRepositoryContract,
  runSendOperationRepositoryContract,
  runMeltOperationRepositoryContract,
  runMeltQuoteRepositoryContract,
  runPaymentRequestReceiveRepositoryContract,
]) {
  run({ createRepositories: () => createRepositories() }, runner);
}
