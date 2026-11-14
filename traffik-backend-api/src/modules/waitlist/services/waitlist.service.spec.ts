import { Test, TestingModule } from "@nestjs/testing";
import { WaitlistService } from "./waitlist.service";
import { WaitlistRepository } from "../repositories/waitlist.repository";

describe("WaitlistService", () => {
  let service: WaitlistService;

  beforeEach(async () => {
    const mockWaitlistRepository = {
      query: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        {
          provide: WaitlistRepository,
          useValue: mockWaitlistRepository,
        },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });
});
