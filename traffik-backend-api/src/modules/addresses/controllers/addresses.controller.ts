import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ApiShopperEndpoint } from "src/common/decorators/api-audience.decorator";
import { AddressesService } from "../services/addresses.service";
import { CreateAddressDto } from "../dto/create-address.dto";
import { UpdateAddressDto } from "../dto/update-address.dto";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { JoiValidationPipe } from "src/common/pipes/validation/joi_validate.pipe";
import { BaseController } from "src/modules/shared/base/controller.base";
import { Response } from "express";
import {
  CreateAddressValidation,
  UpdateAddressValidation,
} from "../validations/address.validation";

@ApiTags("Addresses")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("addresses")
export class AddressesController extends BaseController {
  constructor(private readonly addressesService: AddressesService) {
    super();
  }

  @Post()
  @ApiShopperEndpoint({
    summary: "Add a delivery address",
    description:
      "Saves a new address on the authenticated shopper's address book. The first address saved becomes the default automatically.",
  })
  @ApiResponse({ status: 201, description: "Address created successfully" })
  @ApiResponse({ status: 400, description: "Validation failed" })
  async createAddress(
    @GetUser("_id") userId: string,
    @Body(new JoiValidationPipe(CreateAddressValidation))
    createAddressDto: CreateAddressDto,
    @Res() res: Response,
  ) {
    const result = await this.addressesService.createAddress(
      userId,
      createAddressDto,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data, 201);
  }

  @Get()
  @ApiShopperEndpoint({
    summary: "List saved delivery addresses",
    description:
      "Returns every address belonging to the authenticated shopper, with the default one flagged. Used to populate the address picker at checkout.",
  })
  @ApiResponse({ status: 200, description: "Addresses retrieved successfully" })
  async getUserAddresses(@GetUser("_id") userId: string, @Res() res: Response) {
    const result = await this.addressesService.getUserAddresses(userId);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Get(":id")
  @ApiShopperEndpoint({
    summary: "Get one delivery address",
    description:
      "Returns a single address. Only addresses owned by the authenticated shopper are visible.",
  })
  @ApiParam({ name: "id", description: "Address ObjectId" })
  @ApiResponse({ status: 200, description: "Address retrieved successfully" })
  @ApiResponse({
    status: 404,
    description: "Address not found or not owned by the caller",
  })
  async getAddressById(
    @GetUser("_id") userId: string,
    @Param("id") addressId: string,
    @Res() res: Response,
  ) {
    const result = await this.addressesService.getAddressById(
      userId,
      addressId,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Patch(":id")
  @ApiShopperEndpoint({
    summary: "Update a delivery address",
    description:
      "Edits an address owned by the authenticated shopper. Only the fields present in the body are changed.",
  })
  @ApiParam({ name: "id", description: "Address ObjectId" })
  @ApiResponse({ status: 200, description: "Address updated successfully" })
  @ApiResponse({
    status: 404,
    description: "Address not found or not owned by the caller",
  })
  async updateAddress(
    @GetUser("_id") userId: string,
    @Param("id") addressId: string,
    @Body(new JoiValidationPipe(UpdateAddressValidation))
    updateAddressDto: UpdateAddressDto,
    @Res() res: Response,
  ) {
    const result = await this.addressesService.updateAddress(
      userId,
      addressId,
      updateAddressDto,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Patch(":id/default")
  @ApiShopperEndpoint({
    summary: "Set an address as the default",
    description:
      "Marks this address as the shopper's default and clears the flag on the previous default. Checkout pre-selects the default address.",
  })
  @ApiParam({ name: "id", description: "Address ObjectId" })
  @ApiResponse({
    status: 200,
    description: "Address set as default successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Address not found or not owned by the caller",
  })
  async setDefaultAddress(
    @GetUser("_id") userId: string,
    @Param("id") addressId: string,
    @Res() res: Response,
  ) {
    const result = await this.addressesService.setDefaultAddress(
      userId,
      addressId,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Delete(":id")
  @ApiShopperEndpoint({
    summary: "Delete a delivery address",
    description:
      "Removes an address from the authenticated shopper's address book. Addresses already attached to a placed order are retained on that order.",
  })
  @ApiParam({ name: "id", description: "Address ObjectId" })
  @ApiResponse({ status: 200, description: "Address deleted successfully" })
  @ApiResponse({
    status: 404,
    description: "Address not found or not owned by the caller",
  })
  async deleteAddress(
    @GetUser("_id") userId: string,
    @Param("id") addressId: string,
    @Res() res: Response,
  ) {
    const result = await this.addressesService.deleteAddress(userId, addressId);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }
}
