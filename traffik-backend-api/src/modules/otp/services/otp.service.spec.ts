import { HttpException, HttpStatus } from "@nestjs/common";
import { getModelToken } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { authenticator } from "otplib";
import { OtpService } from "./otp.service";
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
} from "../constants/otp.constant";
import { Otp } from "../schemas/otp.schema";
import { User } from "../../users/schemas/user.schema";
import { Vendor } from "../../vendors/schemas/vendor.schema";
import { EmailService } from "../../shared/services/email/email.service";
import { UserRole } from "../../users/enums/user-role.enum";

/** Minimal chainable, awaitable stand-in for a Mongoose query. */
const query = <T>(result: T) => {
  const q = {
    sort: jest.fn(() => q),
    select: jest.fn(() => q),
    lean: jest.fn(() => Promise.resolve(result)),
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return q;
};

describe("OtpService", () => {
  let service: OtpService;
  let otpModel: Record<string, jest.Mock>;
  let userModel: Record<string, jest.Mock>;
  let emailService: { send: jest.Mock; sendSafe: jest.Mock };

  const secret = authenticator.generateSecret();
  const liveOtp = { _id: "otp-1", userId: "user-1", secret, isUsed: false };

  beforeEach(async () => {
    otpModel = {
      findOne: jest.fn().mockReturnValue(query(liveOtp)),
      findOneAndUpdate: jest
        .fn()
        .mockResolvedValue({ ...liveOtp, attempts: 1 }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ _id: "otp-new" }),
      deleteOne: jest.fn().mockResolvedValue({}),
    };
    userModel = {
      findById: jest.fn().mockReturnValue(
        query({
          _id: "user-1",
          email: "shopper@example.com",
          firstName: "Ada",
        }),
      ),
      findByIdAndUpdate: jest.fn().mockReturnValue(
        query({
          _id: "user-1",
          email: "shopper@example.com",
          firstName: "Ada",
        }),
      ),
    };
    emailService = {
      send: jest.fn().mockResolvedValue(undefined),
      sendSafe: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: getModelToken(Otp.name), useValue: otpModel },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: getModelToken(Vendor.name), useValue: {} },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("verifyOtp", () => {
    it("verifies the newest live code and marks the account verified", async () => {
      const token = authenticator.generate(secret);

      await expect(
        service.verifyOtp("user-1", token, UserRole.USER),
      ).resolves.toBe(true);

      const lookup = otpModel.findOne.mock.results[0].value;
      expect(lookup.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(otpModel.findByIdAndUpdate).toHaveBeenCalledWith("otp-1", {
        isUsed: true,
      });
      expect(userModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "user-1",
        { isVerified: true },
        { new: true },
      );
    });

    it("counts a wrong code as an attempt and returns false", async () => {
      await expect(
        service.verifyOtp("user-1", "0000", UserRole.USER),
      ).resolves.toBe(false);

      expect(otpModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: "otp-1" }),
        { $inc: { attempts: 1 } },
        { new: true },
      );
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("reports too many attempts on the final wrong guess", async () => {
      otpModel.findOneAndUpdate.mockResolvedValue({
        ...liveOtp,
        attempts: OTP_MAX_ATTEMPTS,
      });

      await expect(
        service.verifyOtp("user-1", "0000", UserRole.USER),
      ).rejects.toThrow(/Too many incorrect attempts/);
    });

    it("refuses further guesses once attempts are exhausted, even with the right code", async () => {
      otpModel.findOneAndUpdate.mockResolvedValue(null);
      const token = authenticator.generate(secret);

      await expect(
        service.verifyOtp("user-1", token, UserRole.USER),
      ).rejects.toThrow(/Too many incorrect attempts/);
      expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("rejects when there is no live code", async () => {
      otpModel.findOne.mockReturnValue(query(null));

      await expect(
        service.verifyOtp("user-1", "1234", UserRole.USER),
      ).rejects.toThrow("Invalid or expired OTP");
    });

    it("returns false for a non-string token without consuming an attempt", async () => {
      await expect(
        service.verifyOtp(
          "user-1",
          { $ne: "" } as unknown as string,
          UserRole.USER,
        ),
      ).resolves.toBe(false);
      expect(otpModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it("accepts a code issued late in one hour step and entered early in the next", async () => {
      jest.useFakeTimers({ now: new Date("2025-01-01T10:59:00Z") });
      const token = authenticator.generate(secret);
      jest.setSystemTime(new Date("2025-01-01T11:20:00Z"));

      await expect(
        service.verifyOtp("user-1", token, UserRole.USER),
      ).resolves.toBe(true);
    });

    it("no longer accepts codes from several steps ago", async () => {
      jest.useFakeTimers({ now: new Date("2025-01-01T06:30:00Z") });
      const token = authenticator.generate(secret);
      jest.setSystemTime(new Date("2025-01-01T11:30:00Z"));

      await expect(
        service.verifyOtp("user-1", token, UserRole.USER),
      ).resolves.toBe(false);
    });
  });

  describe("generateOtpForAccount", () => {
    it("invalidates earlier codes, stores the new one and emails it", async () => {
      otpModel.findOne.mockReturnValue(query(null));

      await service.generateOtpForAccount("user-1", UserRole.USER);

      expect(otpModel.updateMany).toHaveBeenCalledWith(
        { userId: "user-1", isUsed: false },
        { isUsed: true },
      );
      expect(otpModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1" }),
      );
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: "shopper@example.com" }),
      );
    });

    it("rejects a request inside the resend cooldown", async () => {
      otpModel.findOne.mockReturnValue(
        query({ createdAt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS / 2) }),
      );

      const attempt = service.generateOtpForAccount("user-1", UserRole.USER);
      await expect(attempt).rejects.toBeInstanceOf(HttpException);
      await attempt.catch((error: HttpException) =>
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS),
      );
      expect(otpModel.create).not.toHaveBeenCalled();
      expect(emailService.send).not.toHaveBeenCalled();
    });

    it("allows a new code once the cooldown has passed", async () => {
      otpModel.findOne.mockReturnValue(
        query({
          createdAt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS - 1000),
        }),
      );

      await expect(
        service.generateOtpForAccount("user-1", UserRole.USER),
      ).resolves.toBeUndefined();
      expect(emailService.send).toHaveBeenCalled();
    });

    it("drops the new code when the email fails so the user can retry at once", async () => {
      otpModel.findOne.mockReturnValue(query(null));
      emailService.send.mockRejectedValue(new Error("smtp down"));

      await expect(
        service.generateOtpForAccount("user-1", UserRole.USER),
      ).rejects.toThrow("smtp down");
      expect(otpModel.deleteOne).toHaveBeenCalledWith({ _id: "otp-new" });
    });
  });
});
