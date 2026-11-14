import { Test, TestingModule } from "@nestjs/testing";
import { WaitlistController } from "./waitlist.controller";
import { WaitlistService } from "../services/waitlist.service";
import { WaitlistRepository } from "../repositories/waitlist.repository";

describe("WaitlistController", () => {
  let controller: WaitlistController;

  beforeEach(async () => {
    const mockWaitlistRepository = {
      query: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaitlistController],
      providers: [
        WaitlistService,
        {
          provide: WaitlistRepository,
          useValue: mockWaitlistRepository,
        },
      ],
    }).compile();

    controller = module.get<WaitlistController>(WaitlistController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
