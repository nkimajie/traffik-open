import { Injectable, Logger } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { ClientSession, Connection } from "mongoose";

/**
 * Runs several database writes as one MongoDB transaction, so a crash (or a
 * Lambda timeout) part-way leaves none of them applied instead of some.
 *
 * Transactions need a replica set or sharded cluster (e.g. MongoDB Atlas). On
 * a standalone server, as in local development, the work runs without a
 * transaction: it behaves the same but is not crash-safe, and a warning is
 * logged once.
 */
@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  private supported?: Promise<boolean>;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  /**
   * Runs `work` in a transaction and returns its result. Every write in
   * `work` must pass the session it is given (undefined when transactions
   * are unavailable). `work` may be run again if the transaction hits a
   * transient conflict, so it must only write to the database. An error
   * thrown by `work` aborts the transaction and is rethrown.
   */
  async run<T>(work: (session?: ClientSession) => Promise<T>): Promise<T> {
    if (!(await this.isSupported())) {
      return work(undefined);
    }

    const session = await this.connection.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  private isSupported(): Promise<boolean> {
    this.supported ??= this.detectSupport();
    return this.supported;
  }

  private async detectSupport(): Promise<boolean> {
    try {
      const hello = await this.connection.db.admin().command({ hello: 1 });
      const supported = Boolean(hello.setName) || hello.msg === "isdbgrid";
      if (!supported) {
        this.logger.warn(
          "MongoDB is a standalone server, which has no transactions: stock and order changes are not crash-safe. Use a replica set (e.g. Atlas) in production.",
        );
      }
      return supported;
    } catch (error) {
      // Not known yet (e.g. not connected): ask again next time.
      this.supported = undefined;
      this.logger.warn(
        `Could not tell whether MongoDB supports transactions (${error instanceof Error ? error.message : String(error)}); running without one`,
      );
      return false;
    }
  }
}
