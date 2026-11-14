import { Injectable, Logger } from "@nestjs/common";
import { AddressesRepository } from "../repositories/addresses.repository";
import { CreateAddressDto } from "../dto/create-address.dto";
import { UpdateAddressDto } from "../dto/update-address.dto";
import { AddressDocument } from "../schemas/address.schema";
import { BaseService } from "src/modules/shared/base/service.base";
import { PromisifiedOperationFeedback } from "src/modules/shared/types/promisified_operation_feedback.type";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import { PhoneNumberService } from "src/modules/shared/services/phone-number/phone-number.service";

@Injectable()
export class AddressesService extends BaseService {
  private readonly logger = new Logger(AddressesService.name);

  constructor(
    private readonly addressesRepository: AddressesRepository,
    private readonly utilsService: UtilsService,
    private readonly phoneNumberService: PhoneNumberService,
  ) {
    super();
  }

  async createAddress(
    userId: string,
    createAddressDto: CreateAddressDto,
  ): PromisifiedOperationFeedback<AddressDocument> {
    const objectUserId = this.utilsService.objectIdFromString(userId);

    // Check if user has any addresses currently
    const existingAddressesCount = await this.addressesRepository.count({
      userId: objectUserId,
    });

    // If it's their first address, force it to be default
    const isFirstAddress = existingAddressesCount === 0;
    const shouldBeDefault = isFirstAddress || createAddressDto.isDefault;

    // If forcing this to default and they have others, unset the others
    if (shouldBeDefault && !isFirstAddress) {
      await this.addressesRepository.updateAll(
        { userId: objectUserId, isDefault: true },
        { isDefault: false },
      );
    }

    const newAddress = await this.addressesRepository.create({
      ...createAddressDto,
      phone: this.phoneNumberService.validateAndFormat(
        createAddressDto.phone,
      ),
      userId: objectUserId as any,
      isDefault: shouldBeDefault,
    });

    return this.Result(false, "Address created successfully", newAddress, 201);
  }

  async getUserAddresses(
    userId: string,
  ): PromisifiedOperationFeedback<AddressDocument[]> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const result = await this.addressesRepository.queryAll(
      { userId: objectUserId },
      {},
      { page: 1, itemsPerPage: 100 }, // fetching up to 100 addresses per user
    );

    return this.Result(
      false,
      "Addresses retrieved successfully",
      result.items || [],
    );
  }

  async getAddressById(
    userId: string,
    addressId: string,
  ): PromisifiedOperationFeedback<AddressDocument> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const objectAddressId = this.utilsService.objectIdFromString(addressId);

    const address = await this.addressesRepository.query({
      _id: objectAddressId,
      userId: objectUserId,
    });

    if (!address) {
      return this.Result(true, "Address not found", undefined, 404);
    }

    return this.Result(false, "Address details retrieved", address);
  }

  async updateAddress(
    userId: string,
    addressId: string,
    updateDto: UpdateAddressDto,
  ): PromisifiedOperationFeedback<AddressDocument> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const objectAddressId = this.utilsService.objectIdFromString(addressId);

    const address = await this.addressesRepository.query({
      _id: objectAddressId,
      userId: objectUserId,
    });

    if (!address) {
      return this.Result(true, "Address not found", undefined, 404);
    }

    if (updateDto.isDefault) {
      // Unset previous defaults
      await this.addressesRepository.updateAll(
        {
          userId: objectUserId,
          isDefault: true,
          _id: { $ne: objectAddressId },
        },
        { isDefault: false },
      );
    }

    const payload =
      updateDto.phone != null
        ? {
            ...updateDto,
            phone: this.phoneNumberService.validateAndFormat(updateDto.phone),
          }
        : updateDto;

    const updatedAddress = await this.addressesRepository.update(
      { _id: objectAddressId },
      payload,
    );

    return this.Result(false, "Address updated successfully", updatedAddress);
  }

  async deleteAddress(
    userId: string,
    addressId: string,
  ): PromisifiedOperationFeedback<null> {
    const objectUserId = this.utilsService.objectIdFromString(userId);
    const objectAddressId = this.utilsService.objectIdFromString(addressId);

    const address = await this.addressesRepository.query({
      _id: objectAddressId,
      userId: objectUserId,
    });

    if (!address) {
      return this.Result(true, "Address not found", undefined, 404);
    }

    await this.addressesRepository.delete({ _id: objectAddressId });

    // If it was the default address, and other addresses remain, make the newest one default
    if (address.isDefault) {
      const remainingAddresses = await this.addressesRepository.queryAll(
        { userId: objectUserId },
        {},
        { page: 1, itemsPerPage: 1 },
      );

      if (remainingAddresses.items && remainingAddresses.items.length > 0) {
        const newDefault = remainingAddresses.items[0];
        await this.addressesRepository.update(
          { _id: newDefault._id },
          { isDefault: true },
        );
      }
    }

    return this.Result(false, "Address deleted successfully");
  }

  async setDefaultAddress(
    userId: string,
    addressId: string,
  ): PromisifiedOperationFeedback<AddressDocument> {
    return this.updateAddress(userId, addressId, { isDefault: true });
  }
}
