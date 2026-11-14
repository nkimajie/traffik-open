import { HttpException, HttpStatus } from "@nestjs/common";
import { OtpController } from "./otp.controller";
import { OtpService } from "../services/otp.service";
import { UserRole } from "../../users/enums/user-role.enum";

describe("OtpController.verifyOtp", () => {
  const req = { user: { _id: "user-1", role: UserRole.USER } };

  it("returns success when the code is valid", async () => {
    const otpService = { verifyOtp: jest.fn().mockResolvedValue(true) };
    const controller = new OtpController(otpService as unknown as OtpService);

    await expect(controller.verifyOtp(req, "1234")).resolves.toEqual({
      status: HttpStatus.OK,
      message: "Email verified successfully",
    });
  });

  it("responds with an HTTP 400 (not a 2xx body) when the code is wrong", async () => {
    const otpService = { verifyOtp: jest.fn().mockResolvedValue(false) };
    const controller = new OtpController(otpService as unknown as OtpService);

    const attempt = controller.verifyOtp(req, "0000");
    await expect(attempt).rejects.toBeInstanceOf(HttpException);
    await attempt.catch((error: HttpException) => {
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.message).toBe("Invalid OTP");
    });
  });
});
