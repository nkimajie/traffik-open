import { Logger } from "@nestjs/common";
import { Connection } from "mongoose";
import { TransactionsService } from "./transactions.service";

describe("TransactionsService", () => {
  const build = (hello: () => Promise<Record<string, unknown>>) => {
    const session = {
      withTransaction: jest.fn(async (fn: () => Promise<void>) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    const command = jest.fn(hello);
    const connection = {
      db: { admin: () => ({ command }) },
      startSession: jest.fn().mockResolvedValue(session),
    };
    return {
      service: new TransactionsService(connection as unknown as Connection),
      session,
      command,
      connection,
    };
  };
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("runs the work in a transaction on a replica set and returns its result", async () => {
    const { service, session, connection } = build(async () => ({
      setName: "atlas-abc",
    }));

    const result = await service.run(async (given) => {
      expect(given).toBe(session);
      return "saved";
    });

    expect(result).toBe("saved");
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalled();
    expect(connection.startSession).toHaveBeenCalledTimes(1);
  });

  it("treats a sharded cluster as supporting transactions", async () => {
    const { service, session } = build(async () => ({ msg: "isdbgrid" }));

    await service.run(async () => undefined);

    expect(session.withTransaction).toHaveBeenCalled();
  });

  it("lets the work's error abort the transaction, and still ends the session", async () => {
    const { service, session } = build(async () => ({ setName: "rs0" }));

    await expect(
      service.run(async () => {
        throw new Error("not enough stock");
      }),
    ).rejects.toThrow("not enough stock");
    expect(session.endSession).toHaveBeenCalled();
  });

  it("runs without a transaction on a standalone server, warning once", async () => {
    const { service, command, connection } = build(async () => ({
      isWritablePrimary: true,
    }));

    await service.run(async (given) => expect(given).toBeUndefined());
    await service.run(async (given) => expect(given).toBeUndefined());

    expect(connection.startSession).not.toHaveBeenCalled();
    expect(command).toHaveBeenCalledTimes(1); // asked once
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/not crash-safe/);
  });

  it("runs without a transaction when it cannot tell yet, and asks again next time", async () => {
    const { service, command, session } = build(async () => ({
      setName: "rs0",
    }));
    command.mockRejectedValueOnce(new Error("not connected"));

    await service.run(async (given) => expect(given).toBeUndefined());
    await service.run(async (given) => expect(given).toBe(session));

    expect(command).toHaveBeenCalledTimes(2);
  });
});
