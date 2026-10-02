import type {
  SqlDatabase,
  SqlParams,
  SqlRunResult,
  SqlTransactionOptions,
  SqlValue,
} from '@cashu/coco-sql-storage';

export interface DurableObjectSqlDbOptions {
  /** The `ctx.storage` of a SQLite-backed Durable Object. */
  storage: DurableObjectStorage;
}

interface RootState {
  readonly storage: DurableObjectStorage;
  transactionQueue: Promise<void>;
  currentScope: symbol | null;
  pendingTransactionCount: number;
}

// Every SqlDatabase on one Durable Object storage shares a queue, because they share one database.
const roots = new WeakMap<DurableObjectStorage, RootState>();

function rootFor(storage: DurableObjectStorage): RootState {
  let root = roots.get(storage);
  if (!root) {
    root = {
      storage,
      transactionQueue: Promise.resolve(),
      currentScope: null,
      pendingTransactionCount: 0,
    };
    roots.set(storage, root);
  }
  return root;
}

// ensureSchema sets connection tuning that Durable Objects manage themselves and reject (SQLITE_AUTH).
const MANAGED_PRAGMAS = /PRAGMA\s+(journal_mode|synchronous|busy_timeout)\b[^;]*;?/gi;

function toBinding(value: SqlValue): SqlStorageValue {
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    // INTEGER affinity stores an integer-looking string losslessly.
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  if (value instanceof Uint8Array) {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
  }
  return value;
}

function fromRow<Row extends object>(row: Record<string, SqlStorageValue>): Row {
  const converted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    converted[key] = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  }
  return converted as Row;
}

/**
 * SqlDatabase over the SQLite storage of a Durable Object.
 *
 * Durable Object SQLite rejects `BEGIN`, so transactions use `storage.transaction()`, which rolls
 * back every write made in the closure when it throws. Calls must run inside the Durable Object.
 */
export class DurableObjectSqlDb implements SqlDatabase {
  private readonly root: RootState;
  private readonly scopeToken: symbol | null;

  constructor(
    optionsOrRoot: DurableObjectSqlDbOptions | RootState,
    scopeToken: symbol | null = null,
  ) {
    this.root =
      'transactionQueue' in optionsOrRoot ? optionsOrRoot : rootFor(optionsOrRoot.storage);
    this.scopeToken = scopeToken;
  }

  private async waitForActiveTransaction(): Promise<void> {
    while (
      this.root.pendingTransactionCount > 0 &&
      (!this.scopeToken || this.root.currentScope !== this.scopeToken)
    ) {
      await this.root.transactionQueue;
    }
  }

  private execute(sql: string, params: SqlParams): Record<string, SqlStorageValue>[] {
    return this.root.storage.sql.exec(sql, ...params.map(toBinding)).toArray();
  }

  async exec(sql: string): Promise<void> {
    await this.waitForActiveTransaction();
    const statements = sql.replace(MANAGED_PRAGMAS, '');
    if (statements.trim() !== '') this.execute(statements, []);
  }

  async run(sql: string, params: SqlParams = []): Promise<SqlRunResult> {
    await this.waitForActiveTransaction();
    this.execute(sql, params);
    const [result] = this.execute('SELECT changes() AS changes, last_insert_rowid() AS id', []);
    return { lastInsertRowId: Number(result?.id ?? 0), changes: Number(result?.changes ?? 0) };
  }

  async get<Row extends object = Record<string, unknown>>(
    sql: string,
    params: SqlParams = [],
  ): Promise<Row | undefined> {
    await this.waitForActiveTransaction();
    const [row] = this.execute(sql, params);
    return row ? fromRow<Row>(row) : undefined;
  }

  async all<Row extends object = Record<string, unknown>>(
    sql: string,
    params: SqlParams = [],
  ): Promise<Row[]> {
    await this.waitForActiveTransaction();
    return this.execute(sql, params).map((row) => fromRow<Row>(row));
  }

  /**
   * Runs `fn` in one storage transaction. Nested calls on the same scope join the outer
   * transaction; root calls on the same storage run one at a time. `options.mode` is ignored
   * because a Durable Object already has a single writer.
   */
  async transaction<T>(
    fn: (tx: DurableObjectSqlDb) => Promise<T>,
    _options?: SqlTransactionOptions,
  ): Promise<T> {
    const { root } = this;
    if (this.scopeToken && root.currentScope === this.scopeToken) return fn(this);

    const scopeToken = Symbol('durable-object-transaction');
    const previousTransaction = root.transactionQueue;
    let release!: () => void;
    root.transactionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    root.pendingTransactionCount++;

    try {
      await previousTransaction;
      root.currentScope = scopeToken;
      return await root.storage.transaction(() => fn(new DurableObjectSqlDb(root, scopeToken)));
    } finally {
      root.currentScope = null;
      root.pendingTransactionCount--;
      release();
    }
  }
}
