import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { SignupDto } from "../dto/signup.dto";
import { LoginDto } from "../dto/login.dto";
import { CreateAdminDto } from "../../admin/dto/create-admin.dto";
import { OtpService } from "../../otp/services/otp.service";
import { UsersRepository } from "src/modules/users/repositories/users.repository";
import { VendorsRepository } from "src/modules/vendors/repositories/vendors.repository";
import { IUser } from "src/modules/users/interfaces/users.interface";
import { IVendor } from "src/modules/vendors/interfaces/vendors.interface";
import { UsersService } from "src/modules/users/services/users.service";
import { VendorsService } from "src/modules/vendors/services/vendors.service";
import { UserRole } from "src/modules/users/enums/user-role.enum";
import { AdminService } from "../../admin/services/admin.service";
import { validateStructuredPhone } from "src/common/utils/phone-iso.util";

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(
    private readonly userRepository: UsersRepository,
    private readonly vendorRepository: VendorsRepository,
    private readonly usersService: UsersService,
    private readonly vendorsService: VendorsService,
    private readonly adminService: AdminService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
  ) {}

  async signup(signupDto: SignupDto) {
    const { password, ...rest } = signupDto;
    const hashedPassword = await bcrypt.hash(password, 10);

    let result;
    switch (signupDto?.role) {
      case UserRole.USER: {
        const user = await this.userRepository.exists({ email: rest.email });
        if (user) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: "User already exists",
              code: "USER_ALREADY_EXISTS",
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        const phoneCheck = validateStructuredPhone(rest.phone);
        if (phoneCheck.ok === false) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: phoneCheck.message,
              code: phoneCheck.code,
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        result = await this.userRepository.create({
          ...rest,
          phone: phoneCheck.normalized,
          password: hashedPassword,
          isVerified: false,
          countryISOCode: phoneCheck.countryISOCode,
        });

        if (!result) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: "User not created",
              code: "USER_NOT_CREATED",
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        break;
      }
      case UserRole.VENDOR: {
        const vendor = await this.vendorRepository.exists({
          email: rest.email,
        });
        if (vendor) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: "User already exists",
              code: "USER_ALREADY_EXISTS",
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        const phoneCheck = validateStructuredPhone(rest.phone);
        if (phoneCheck.ok === false) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: phoneCheck.message,
              code: phoneCheck.code,
            },
            HttpStatus.BAD_REQUEST,
          );
        }

        result = await this.vendorRepository.create({
          ...rest,
          phone: phoneCheck.normalized,
          password: hashedPassword,
          isVerified: false,
          countryISOCode: phoneCheck.countryISOCode,
        });

        if (!result) {
          throw new HttpException(
            {
              statusCode: HttpStatus.BAD_REQUEST,
              message: "Vendor not created",
              code: "VENDOR_NOT_CREATED",
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        break;
      }
      default:
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: "Invalid role",
            code: "INVALID_ROLE",
          },
          HttpStatus.BAD_REQUEST,
        );
    }

    if (signupDto.role === UserRole.USER) {
      try {
        await this.otpService.generateOtpForAccount(
          String(result._id),
          signupDto.role,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Verification email failed for ${signupDto.role} ${result.email}: ${message}`,
        );
      }
    }

    const token = this.generateToken(result);

    const userData =
      signupDto.role === UserRole.USER
        ? this.usersService.formatUserData(result)
        : this.vendorsService.formatVendorData(result);

    return {
      ...userData,
      token,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password, role } = loginDto;
    let result;
    let token;
    let userData;

    switch (role) {
      case UserRole.USER: {
        result = await this.userRepository.query({ email });
        if (!result) {
          throw new UnauthorizedException("Invalid credentials");
        }

        const isUserPasswordValid = await bcrypt.compare(
          password,
          result?.password,
        );
        if (!isUserPasswordValid) {
          throw new UnauthorizedException("Invalid credentials");
        }

        // Check if user is verified
        if (!result?.isVerified) {
          throw new HttpException(
            {
              statusCode: HttpStatus.PRECONDITION_REQUIRED,
              message: "Email not verified",
              code: "EMAIL_NOT_VERIFIED",
            },
            HttpStatus.PRECONDITION_REQUIRED,
          );
        }

        token = this.generateToken(result);
        userData = this.usersService.formatUserData(result);

        return {
          ...userData,
          token,
        };
      }

      case UserRole.VENDOR: {
        result = await this.vendorRepository.query({ email });
        if (!result) {
          throw new UnauthorizedException("Invalid credentials");
        }

        const isVendorPasswordValid = await bcrypt.compare(
          password,
          result?.password,
        );
        if (!isVendorPasswordValid) {
          throw new UnauthorizedException("Invalid credentials");
        }

        token = this.generateToken(result);
        userData = this.vendorsService.formatVendorData(result);

        return {
          ...userData,
          token,
        };
      }

      default:
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: "Invalid role",
            code: "INVALID_ROLE",
          },
          HttpStatus.BAD_REQUEST,
        );
    }
  }

  async googleLogin(profile: any) {
    const { email, role = UserRole.USER } = profile;
    let result;

    switch (role) {
      case UserRole.USER: {
        result = await this.userRepository.query({ email });
        if (!result) {
          // Create new user
          result = await this.userRepository.create({
            firstName: profile?.given_name,
            lastName: profile?.family_name,
            email: profile?.email,
            googleId: profile?.id,
            isVerified: true, // Google verified emails are trusted
            role,
          });
        }
        break;
      }

      case UserRole.VENDOR: {
        result = await this.vendorRepository.query({ email });
        if (!result) {
          // Create new vendor
          result = await this.vendorRepository.create({
            firstName: profile?.given_name,
            lastName: profile?.family_name,
            email: profile?.email,
            googleId: profile?.id,
            isVerified: true, // Google verified emails are trusted
            role,
          });
        }
        break;
      }

      default:
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: "Invalid role",
            code: "INVALID_ROLE",
          },
          HttpStatus.BAD_REQUEST,
        );
    }

    const token = this.generateToken(result);
    const userData =
      role === UserRole.USER
        ? this.usersService.formatUserData(result)
        : this.vendorsService.formatVendorData(result);

    return {
      ...userData,
      token,
    };
  }

  async appleLogin(profile: any) {
    const { email, role = UserRole.USER } = profile;
    let result;

    switch (role) {
      case UserRole.USER: {
        result = await this.userRepository.query({ email });
        if (!result) {
          // Create new user
          result = await this.userRepository.create({
            firstName: profile?.name?.firstName || "User",
            lastName: profile?.name?.lastName || profile?.sub,
            email: profile?.email,
            appleId: profile?.sub,
            isVerified: true, // Apple verified emails are trusted
            role,
          });
        }
        break;
      }

      case UserRole.VENDOR: {
        result = await this.vendorRepository.query({ email });
        if (!result) {
          // Create new vendor
          result = await this.vendorRepository.create({
            firstName: profile?.name?.firstName || "User",
            lastName: profile?.name?.lastName || profile?.sub,
            email: profile?.email,
            appleId: profile?.sub,
            isVerified: true, // Apple verified emails are trusted
            role,
          });
        }
        break;
      }

      default:
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            message: "Invalid role",
            code: "INVALID_ROLE",
          },
          HttpStatus.BAD_REQUEST,
        );
    }

    const token = this.generateToken(result);
    const userData =
      role === UserRole.USER
        ? this.usersService.formatUserData(result)
        : this.vendorsService.formatVendorData(result);

    return {
      ...userData,
      token,
    };
  }

  async adminLogin(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const admin = await this.adminService.findByEmail(email);

    if (!admin) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const token = this.generateToken({
      _id: admin._id,
      email: admin.email,
      role: UserRole.ADMIN,
    });

    return {
      _id: admin._id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: UserRole.ADMIN,
      token,
    };
  }

  async createAdmin(createAdminDto: CreateAdminDto) {
    const admin = await this.adminService.create(createAdminDto);

    const token = this.generateToken({
      _id: admin._id,
      email: admin.email,
      role: UserRole.ADMIN,
    });

    return {
      _id: admin._id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: UserRole.ADMIN,
      token,
    };
  }

  private generateToken(
    user: IUser | IVendor | { _id: string; email: string; role: UserRole },
  ) {
    const payload: any = {
      sub: user?._id,
      email: user?.email,
      role: user?.role,
    };
    
    // Include tokenVersion for token invalidation on logout (for users only)
    if (user?.role === UserRole.USER && (user as IUser)?.tokenVersion !== undefined) {
      payload.tokenVersion = (user as IUser).tokenVersion;
    }
    
    return this.jwtService.sign(payload);
  }
}
