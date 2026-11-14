import { Injectable, Logger } from "@nestjs/common";
import { VouchersRepository } from "../repositories/vouchers.repository";
import { CreateVoucherDto } from "../dto/create-voucher.dto";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import { BaseService } from "src/modules/shared/base/service.base";
import { PromisifiedOperationFeedback } from "src/modules/shared/types/promisified_operation_feedback.type";
import { IVoucher } from "../interfaces/voucher.interface";

@Injectable()
export class VouchersService extends BaseService {
  private readonly logger = new Logger(VouchersService.name);

  constructor(
    private readonly vouchersRepository: VouchersRepository,
    private readonly utilsService: UtilsService,
  ) {
    super();
  }

  async create(
    createVoucherDto: CreateVoucherDto,
    adminId: string,
  ): PromisifiedOperationFeedback<IVoucher> {
    // Check if voucher code already exists
    const existingVoucher = await this.vouchersRepository.query({
      code: createVoucherDto.code.toUpperCase(),
    });

    if (existingVoucher) {
      return this.Result(true, "Voucher code already exists", undefined, 409);
    }

    // Validate expiring date is in the future
    if (new Date(createVoucherDto.expiringDate) <= new Date()) {
      return this.Result(
        true,
        "Expiring date must be in the future",
        undefined,
        400,
      );
    }

    const voucher = await this.vouchersRepository.create({
      ...createVoucherDto,
      code: createVoucherDto.code.toUpperCase(),
      createdBy: adminId,
    });

    return this.Result(false, "Voucher created successfully", voucher);
  }

  async findAll(): PromisifiedOperationFeedback<IVoucher[]> {
    const result = await this.vouchersRepository.queryAll(
      {
        isActive: true,
        expiringDate: { $gt: new Date() },
      },
      {},
      { page: 1, itemsPerPage: 1000 },
    );

    return this.Result(
      false,
      "Vouchers retrieved successfully",
      result?.items || [],
    );
  }
}
