import { Test, TestingModule } from "@nestjs/testing";
import { UsersService } from "./users.service";
import { UsersRepository } from "../repositories/users.repository";
import { VendorsService } from "../../vendors/services/vendors.service";
import { ProductsService } from "../../products/services/products.service";
import { CategoriesService } from "../../categories/services/categories.service";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import { FilesService } from "../../files/services/files.service";
import { EmailService } from "src/modules/shared/services/email/email.service";

describe("UsersService", () => {
  let service: UsersService;

  beforeEach(async () => {
    const mockUsersRepository = {
      query: jest.fn(),
      updateOne: jest.fn(),
    };

    const mockVendorsService = {
      findForHome: jest.fn(),
      search: jest.fn(),
    };

    const mockProductsService = {
      findFeatured: jest.fn(),
      findDeals: jest.fn(),
      search: jest.fn(),
      findByCategory: jest.fn(),
      findBrands: jest.fn(),
      getPriceRange: jest.fn(),
      findWithFilters: jest.fn(),
    };

    const mockCategoriesService = {
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    const mockUtilsService = {
      // Add any methods that UtilsService might have
    };

    const mockFilesService = {
      uploadFile: jest.fn(),
      deleteFileByPublicId: jest.fn(),
      markFileAsInUse: jest.fn(),
    };

    const mockEmailService = {
      sendSafe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: mockUsersRepository,
        },
        {
          provide: VendorsService,
          useValue: mockVendorsService,
        },
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
        {
          provide: CategoriesService,
          useValue: mockCategoriesService,
        },
        {
          provide: UtilsService,
          useValue: mockUtilsService,
        },
        {
          provide: FilesService,
          useValue: mockFilesService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
