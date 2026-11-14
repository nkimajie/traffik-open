import {
  Injectable,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { WaitlistRepository } from "../repositories/waitlist.repository";
import { CreateWaitlistDto } from "../dto/create-waitlist.dto";
import { WaitlistDocument } from "../schemas/waitlist.schema";
import { validateStructuredPhone } from "src/common/utils/phone-iso.util";

@Injectable()
export class WaitlistService {
  constructor(private readonly waitlistRepository: WaitlistRepository) {}

  async create(
    createWaitlistDto: CreateWaitlistDto,
  ): Promise<WaitlistDocument> {
    // Check if email already exists
    const existingEntry = await this.waitlistRepository.query({
      email: createWaitlistDto?.email,
    });
    if (existingEntry) {
      throw new ConflictException("Email already registered in waitlist");
    }

    let phone: CreateWaitlistDto["phone"] = undefined;
    if (createWaitlistDto?.phone) {
      const phoneCheck = validateStructuredPhone(createWaitlistDto.phone);
      if (phoneCheck.ok === false) {
        throw new BadRequestException(phoneCheck.message);
      }
      phone = phoneCheck.normalized;
    }

    return this.waitlistRepository.create({
      email: createWaitlistDto?.email,
      phone,
    });
  }
}
