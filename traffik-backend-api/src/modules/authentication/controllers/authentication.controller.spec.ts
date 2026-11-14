import { Test, TestingModule } from "@nestjs/testing";
import { AuthenticationController } from "./authentication.controller";
import { AuthenticationService } from "../services/authentication.service";
import { UsersRepository } from "src/modules/users/repositories/users.repository";
import { VendorsRepository } from "src/modules/vendors/repositories/vendors.repository";
import { UsersService } from "src/modules/users/services/users.service";
import { VendorsService } from "src/modules/vendors/services/vendors.service";
import { AdminService } from "../../admin/services/admin.service";
import { JwtService } from "@nestjs/jwt";
import { OtpService } from "../../otp/services/otp.service";

describe("AuthenticationController", () => {
  let controller: AuthenticationController;

  beforeEach(async () => {
    const mockUsersRepository = {
      exists: jest.fn(),
      create: jest.fn(),
      query: jest.fn(),
    };

    const mockVendorsRepository = {
      exists: jest.fn(),
      create: jest.fn(),
      query: jest.fn(),
    };

    const mockUsersService = {
      formatUserData: jest.fn(),
    };

    const mockVendorsService = {
      formatVendorData: jest.fn(),
    };

    const mockAdminService = {
      // Add any methods that AdminService might have
    };

    const mockJwtService = {
      sign: jest.fn(),
    };

    const mockOtpService = {
      // Add any methods that OtpService might have
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthenticationController],
      providers: [
        AuthenticationService,
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
        {
          provide: VendorsRepository,
          useValue: mockVendorsRepository,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: VendorsService,
          useValue: mockVendorsService,
        },
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: OtpService,
          useValue: mockOtpService,
        },
      ],
    }).compile();

    controller = module.get<AuthenticationController>(AuthenticationController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
