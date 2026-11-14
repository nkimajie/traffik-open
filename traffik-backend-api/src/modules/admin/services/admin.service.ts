import { Injectable, Logger, ConflictException } from "@nestjs/common";
import { AdminRepository } from "../repositories/admin.repository";
import { CreateAdminDto } from "../dto/create-admin.dto";
import { AdminDocument } from "../schemas/admin.schema";
import * as bcrypt from "bcrypt";

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly adminRepository: AdminRepository) {}

  async checkAdminExists(): Promise<boolean> {
    try {
      const result = await this.adminRepository.queryAll({});
      return result.items.length > 0;
    } catch (error) {
      this.logger.error(`Error checking admin existence: ${error.message}`);
      throw error;
    }
  }

  async create(createAdminDto: CreateAdminDto): Promise<AdminDocument> {
    try {
      const adminExists = await this.checkAdminExists();
      if (adminExists) {
        throw new ConflictException("Admin already exists");
      }

      const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);
      const admin = await this.adminRepository.create({
        ...createAdminDto,
        password: hashedPassword,
      });

      return admin;
    } catch (error) {
      this.logger.error(`Error creating admin: ${error.message}`);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<AdminDocument | null> {
    try {
      return await this.adminRepository.query({ email });
    } catch (error) {
      this.logger.error(`Error finding admin by email: ${error.message}`);
      throw error;
    }
  }
}
