import { SqlStorageRepositories } from '@cashu/coco-sql-storage';
import { DurableObjectSqlDb } from './db.ts';

export { DurableObjectSqlDb, type DurableObjectSqlDbOptions } from './db.ts';

export interface DurableObjectRepositoriesOptions {
  /** The `ctx.storage` of a SQLite-backed Durable Object. */
  storage: DurableObjectStorage;
  mintSwap?: boolean;
}

/** Coco repositories stored in the SQLite storage of a Durable Object. */
export class DurableObjectRepositories extends SqlStorageRepositories {
  constructor(options: DurableObjectRepositoriesOptions) {
    super({ database: new DurableObjectSqlDb(options), mintSwap: options.mintSwap });
  }
}
