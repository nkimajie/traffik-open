import { InternalServerErrorException, Logger } from "@nestjs/common";
import { KashiaService } from "./kashia.service";
import { UsersRepository } from "src/modules/users/repositories/users.repository";
import { VendorsRepository } from "src/modules/vendors/repositories/vendors.repository";
import { KASHIA_REQUEST_TIMEOUT_MS } from "../constants/kashia.constant";

describe("KashiaService requests", () => {
  const env = { ...process.env };
  let service: KashiaService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    process.env.KASHIA_API_KEY = "key";
    process.env.KASHIA_BASE_URL = "https://vault.example";
    service = new KashiaService({} as UsersRepository, {} as VendorsRepository);
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env = { ...env };
  });

  it("gives up on a call Kashia does not answer in time", async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation(
      (_url: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          signal = init?.signal ?? undefined;
          signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );

    const call = service.getPaymentLink("PL-1");
    const outcome = expect(call).rejects.toThrow(
      "Kashia did not respond in time",
    );
    await jest.advanceTimersByTimeAsync(KASHIA_REQUEST_TIMEOUT_MS);

    await outcome;
    expect(signal?.aborted).toBe(true);
  });

  it("returns the data of an answer in time, and cancels its timer", async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { reference: "PL-1" } }),
    } as Response);

    await expect(service.getPaymentLink("PL-1")).resolves.toEqual({
      reference: "PL-1",
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("reports Kashia being unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(service.getPaymentLink("PL-1")).rejects.toEqual(
      new InternalServerErrorException("Unable to reach Kashia"),
    );
  });
});
