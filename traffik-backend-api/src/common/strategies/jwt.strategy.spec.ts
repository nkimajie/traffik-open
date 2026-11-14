import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtStrategy } from "./jwt.strategy";
import { UsersRepository } from "../../modules/users/repositories/users.repository";
import { UserRole } from "../../modules/users/enums/user-role.enum";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;
  let usersRepository: { query: jest.Mock };

  beforeEach(async () => {
    usersRepository = { query: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { get: () => "test-secret" } },
        { provide: UsersRepository, useValue: usersRepository },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  const shopperPayload = (tokenVersion?: number) => ({
    sub: "user-1",
    email: "shopper@example.com",
    role: UserRole.USER,
    ...(tokenVersion !== undefined && { tokenVersion }),
  });

  it("accepts a shopper token whose tokenVersion is current", async () => {
    usersRepository.query.mockResolvedValue({ _id: "user-1", tokenVersion: 2 });

    await expect(strategy.validate(shopperPayload(2))).resolves.toEqual({
      _id: "user-1",
      email: "shopper@example.com",
      role: UserRole.USER,
    });
    expect(usersRepository.query).toHaveBeenCalledWith({ _id: "user-1" });
  });

  it("rejects a shopper token issued before logout", async () => {
    usersRepository.query.mockResolvedValue({ _id: "user-1", tokenVersion: 3 });

    await expect(strategy.validate(shopperPayload(2))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects a shopper token without tokenVersion once the account has one", async () => {
    usersRepository.query.mockResolvedValue({ _id: "user-1", tokenVersion: 0 });

    await expect(strategy.validate(shopperPayload())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects a shopper token for an account that no longer exists", async () => {
    usersRepository.query.mockResolvedValue(null);

    await expect(strategy.validate(shopperPayload(0))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("does not look up vendor or admin tokens (no tokenVersion for those roles)", async () => {
    await expect(
      strategy.validate({
        sub: "v-1",
        email: "v@example.com",
        role: UserRole.VENDOR,
      }),
    ).resolves.toEqual({
      _id: "v-1",
      email: "v@example.com",
      role: UserRole.VENDOR,
    });
    await expect(
      strategy.validate({
        sub: "a-1",
        email: "a@example.com",
        role: UserRole.ADMIN,
      }),
    ).resolves.toEqual({
      _id: "a-1",
      email: "a@example.com",
      role: UserRole.ADMIN,
    });
    expect(usersRepository.query).not.toHaveBeenCalled();
  });
});
