import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { authenticator } from "otplib";
import { Otp, OtpDocument } from "../schemas/otp.schema";
import { User, UserDocument } from "../../users/schemas/user.schema";
import { Vendor, VendorDocument } from "../../vendors/schemas/vendor.schema";
import { EmailTemplate } from "../../shared/services/email/enums/email_template.enum";
import { EmailService } from "../../shared/services/email/email.service";
import { getAppWebUrl } from "../../shared/services/email/email.helpers";
import { UserRole } from "../../users/enums/user-role.enum";
import { IOtpAccount } from "../interfaces/otp-account.interface";
import {
  OTP_DIGITS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_STEP_SECONDS,
  OTP_TTL_MS,
  OTP_VERIFY_WINDOW,
} from "../constants/otp.constant";

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectModel(Otp.name) private otpModel: Model<OtpDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Vendor.name) private vendorModel: Model<VendorDocument>,
    private emailService: EmailService,
  ) {
    authenticator.options = {
      digits: OTP_DIGITS,
      step: OTP_STEP_SECONDS,
      window: OTP_VERIFY_WINDOW,
    };
  }

  async generateOtpForAccount(
    accountId: string,
    role: UserRole,
  ): Promise<void> {
    const account = await this.findAccount(accountId, role);
    await this.generateOtp(account);
  }

  private async findAccount(
    accountId: string,
    role: UserRole,
  ): Promise<IOtpAccount> {
    if (role === UserRole.VENDOR) {
      const vendor = await this.vendorModel.findById(accountId).lean();
      if (!vendor) {
        throw new HttpException("Account not found", HttpStatus.NOT_FOUND);
      }
      return {
        _id: String(vendor._id),
        email: vendor.email,
        firstName: vendor.firstName,
      };
    }

    const user = await this.userModel.findById(accountId).lean();
    if (!user) {
      throw new HttpException("Account not found", HttpStatus.NOT_FOUND);
    }

    return {
      _id: String(user._id),
      email: user.email,
      firstName: user.firstName,
    };
  }

  private async generateOtp(account: IOtpAccount): Promise<string> {
    await this.assertResendAllowed(account._id);

    const secret = authenticator.generateSecret();
    const token = authenticator.generate(secret);

    // Only the newest code is valid, so a resend cannot leave several live.
    await this.otpModel.updateMany(
      { userId: account._id, isUsed: false },
      { isUsed: true },
    );

    const otp = await this.otpModel.create({
      userId: account._id,
      secret,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    try {
      await this.emailService.send({
        to: account.email,
        template: EmailTemplate.OTP_VERIFICATION,
        data: {
          name: account.firstName,
          otp: token,
          expiresInMinutes: OTP_TTL_MS / 60000,
        },
      });
    } catch (error) {
      // The code never reached the user; drop it so it does not hold the
      // resend cooldown and the user can retry straight away.
      await this.otpModel.deleteOne({ _id: otp._id });
      throw error;
    }

    return token;
  }

  private async assertResendAllowed(userId: string): Promise<void> {
    const latest = await this.otpModel
      .findOne({ userId })
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean<Pick<Otp, "createdAt">>();

    const createdAt = latest?.createdAt
      ? new Date(latest.createdAt).getTime()
      : 0;
    const waitMs = createdAt + OTP_RESEND_COOLDOWN_MS - Date.now();
    if (waitMs > 0) {
      throw new HttpException(
        `Please wait ${Math.ceil(waitMs / 1000)}s before requesting a new code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async verifyOtp(
    userId: string,
    token: string,
    role: UserRole,
  ): Promise<boolean> {
    if (typeof token !== "string" || !token.trim()) {
      return false;
    }

    // Newest live code; older ones are invalidated when a new one is issued.
    const otp = await this.otpModel
      .findOne({
        userId,
        isUsed: false,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 });

    if (!otp) {
      throw new HttpException("Invalid or expired OTP", HttpStatus.BAD_REQUEST);
    }

    // Claim an attempt atomically so parallel guesses cannot exceed the cap.
    // Codes issued before `attempts` existed have no counter yet.
    const claimed = await this.otpModel.findOneAndUpdate(
      {
        _id: otp._id,
        $or: [
          { attempts: { $lt: OTP_MAX_ATTEMPTS } },
          { attempts: { $exists: false } },
        ],
      },
      { $inc: { attempts: 1 } },
      { new: true },
    );

    if (!claimed) {
      throw this.tooManyAttemptsException();
    }

    const isValid = authenticator.verify({
      token: token.trim(),
      secret: otp.secret,
    });

    if (!isValid) {
      if (claimed.attempts >= OTP_MAX_ATTEMPTS) {
        throw this.tooManyAttemptsException();
      }
      return false;
    }

    await this.otpModel.findByIdAndUpdate(otp._id, { isUsed: true });

    if (role === UserRole.VENDOR) {
      const vendor = await this.vendorModel
        .findByIdAndUpdate(userId, { isVerified: true }, { new: true })
        .lean();
      if (vendor?.email) {
        await this.emailService.sendSafe({
          to: vendor.email,
          template: EmailTemplate.WELCOME,
          data: {
            name: vendor.firstName || "there",
            ctaUrl: getAppWebUrl("/create-business/step1"),
          },
        });
      }
    } else {
      const user = await this.userModel
        .findByIdAndUpdate(userId, { isVerified: true }, { new: true })
        .lean();
      if (user?.email) {
        await this.emailService.sendSafe({
          to: user.email,
          template: EmailTemplate.WELCOME,
          data: {
            name: user.firstName || "there",
            ctaUrl: getAppWebUrl("/"),
          },
        });
      }
    }

    return true;
  }

  private tooManyAttemptsException(): HttpException {
    return new HttpException(
      "Too many incorrect attempts. Please request a new code",
      HttpStatus.BAD_REQUEST,
    );
  }

  async isUserVerified(userId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    return user?.isVerified || false;
  }
}
