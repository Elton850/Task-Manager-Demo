// Type declarations for node:sqlite (built-in since Node.js v22.5.0)
// These types will be replaced by @types/node@22.7.7+ if installed

declare module "node:sqlite" {
  export interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export type SupportedValueType =
    | null
    | number
    | bigint
    | string
    | Uint8Array
    | ArrayBuffer;

  export interface StatementSync {
    all(...params: SupportedValueType[]): unknown[];
    get(...params: SupportedValueType[]): unknown | undefined;
    run(...params: SupportedValueType[]): StatementResultingChanges;
    setAllowBareNamedParameters(enabled: boolean): void;
    setReadBigInts(enabled: boolean): void;
    readonly sourceSQL: string;
    readonly expandedSQL: string;
  }

  export interface DatabaseSyncOptions {
    open?: boolean;
    readOnly?: boolean;
    enableForeignKeyConstraints?: boolean;
    enableDoubleQuotedStringLiterals?: boolean;
    allowExtension?: boolean;
  }

  export class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions);
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    open(options?: { location?: string; readOnly?: boolean }): void;
  }
}
