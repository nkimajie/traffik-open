import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ApiShopperEndpoint } from "src/common/decorators/api-audience.decorator";
import { CartsService } from "../services/carts.service";
import { AddCartItemDto } from "../dto/add-cart-item.dto";
import { UpdateCartItemDto } from "../dto/update-cart-item.dto";
import { ApplyVoucherDto } from "../dto/apply-voucher.dto";
import { SaveCartItemForLaterDto } from "../dto/save-cart-item-for-later.dto";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { JoiValidationPipe } from "src/common/pipes/validation/joi_validate.pipe";
import { BaseController } from "src/modules/shared/base/controller.base";
import { Response } from "express";
import {
  AddCartItemValidation,
  UpdateCartItemValidation,
  ApplyVoucherValidation,
  SaveCartItemForLaterValidation,
} from "../validations/cart.validation";

@ApiTags("Carts")
@Controller("carts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class CartsController extends BaseController {
  constructor(private readonly cartsService: CartsService) {
    super();
  }

  @Get()
  @ApiShopperEndpoint({
    summary: "Get the current cart",
    description:
      "Returns the authenticated shopper's cart with hydrated product details, per-item line totals, any applied voucher, and the cart subtotal. An empty cart is created on first read.",
  })
  @ApiResponse({ status: 200, description: "Cart retrieved successfully" })
  async getCart(@GetUser("_id") userId: string, @Res() res: Response) {
    const result = await this.cartsService.getCart(userId);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Post("items")
  @ApiShopperEndpoint({
    summary: "Add an item to the cart",
    description:
      "Adds a product to the authenticated shopper's cart. Send `variationId` for products that have variations (size, colour) and omit it for products that do not. Adding a product that is already in the cart increases its quantity.",
  })
  @ApiResponse({ status: 201, description: "Item added to cart" })
  @ApiResponse({
    status: 400,
    description: "Quantity exceeds available stock, or variation is required",
  })
  @ApiResponse({ status: 404, description: "Product or variation not found" })
  @ApiResponse({
    status: 409,
    description:
      "The cart already belongs to a different store. The error payload carries `data.code = CART_VENDOR_CONFLICT` with both stores and the rejected product, so the client can offer `items/save-for-later` or `replace`.",
  })
  async addItem(
    @GetUser("_id") userId: string,
    @Body(new JoiValidationPipe(AddCartItemValidation))
    addItemDto: AddCartItemDto,
    @Res() res: Response,
  ) {
    const result = await this.cartsService.addItem(userId, addItemDto);
    if (result.failed) {
      if (result.code === HttpStatus.CONFLICT) {
        return this.throwErrorWithData(
          result.description,
          result.code,
          result.data,
        );
      }
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data, 201);
  }

  @Post("items/save-for-later")
  @ApiShopperEndpoint({
    summary: "Save a product for later instead of adding it",
    description:
      "Resolves a store conflict without touching the cart: the product is moved to the shopper's saved products, grouped under its store, ready to be ordered once the current cart is cleared.",
  })
  @ApiResponse({ status: 200, description: "Product saved for later" })
  @ApiResponse({ status: 404, description: "Product not found or not active" })
  async saveItemForLater(
    @GetUser("_id") userId: string,
    @Body(new JoiValidationPipe(SaveCartItemForLaterValidation))
    saveDto: SaveCartItemForLaterDto,
    @Res() res: Response,
  ) {
    const result = await this.cartsService.saveItemForLater(
      userId,
      saveDto.productId,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Post("replace")
  @ApiShopperEndpoint({
    summary: "Start a new cart with a different store's product",
    description:
      "Resolves a store conflict by switching stores. The current lines are saved to the shopper's saved products rather than discarded, the cart is emptied, and the supplied product becomes the first line of the new cart.",
  })
  @ApiResponse({ status: 200, description: "Cart replaced" })
  @ApiResponse({
    status: 400,
    description: "Quantity exceeds available stock, or variation is required",
  })
  async replaceCart(
    @GetUser("_id") userId: string,
    @Body(new JoiValidationPipe(AddCartItemValidation))
    addItemDto: AddCartItemDto,
    @Res() res: Response,
  ) {
    const result = await this.cartsService.replaceCart(userId, addItemDto);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Patch("items/:productId")
  @ApiShopperEndpoint({
    summary: "Change a cart item's quantity",
    description:
      "Sets a new quantity for a line in the authenticated shopper's cart. For products with variations, identify the exact line with the `variationId` query parameter.",
  })
  @ApiParam({ name: "productId", description: "Product ObjectId" })
  @ApiQuery({
    name: "variationId",
    required: false,
    type: String,
    description:
      "ID of the product variation for products with variations. Omit for products without variations.",
  })
  @ApiResponse({ status: 200, description: "Cart item updated" })
  @ApiResponse({ status: 404, description: "Item not found in cart" })
  async updateItem(
    @GetUser("_id") userId: string,
    @Param("productId") productId: string,
    @Body(new JoiValidationPipe(UpdateCartItemValidation))
    updateDto: UpdateCartItemDto,
    @Res() res: Response,
    @Query("variationId") variationIdQuery?: string,
  ) {
    const variationId =
      variationIdQuery !== undefined && variationIdQuery !== ""
        ? variationIdQuery
        : undefined;
    const result = await this.cartsService.updateItemQuantity(
      userId,
      productId,
      updateDto,
      variationId,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Delete("items/:productId")
  @ApiShopperEndpoint({
    summary: "Remove an item from the cart",
    description:
      "Deletes a line from the authenticated shopper's cart. Pass `variationId` to remove a single variation while leaving the product's other variations in the cart.",
  })
  @ApiParam({ name: "productId", description: "Product ObjectId" })
  @ApiQuery({
    name: "variationId",
    required: false,
    type: String,
    description:
      "ID of the product variation for products with variations. Omit for products without variations.",
  })
  @ApiResponse({ status: 200, description: "Item removed from cart" })
  @ApiResponse({ status: 404, description: "Item not found in cart" })
  async removeItem(
    @GetUser("_id") userId: string,
    @Param("productId") productId: string,
    @Res() res: Response,
    @Query("variationId") variationIdQuery?: string,
  ) {
    const variationId =
      variationIdQuery !== undefined && variationIdQuery !== ""
        ? variationIdQuery
        : undefined;
    const result = await this.cartsService.removeItem(
      userId,
      productId,
      variationId,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Post("voucher")
  @ApiShopperEndpoint({
    summary: "Apply a voucher to the cart",
    description:
      "Attaches a discount code to the authenticated shopper's cart and recalculates the totals. Browse available codes with `GET /vouchers`.",
  })
  @ApiResponse({ status: 200, description: "Voucher applied successfully" })
  @ApiResponse({ status: 400, description: "Invalid or expired voucher code" })
  async applyVoucher(
    @GetUser("_id") userId: string,
    @Body(new JoiValidationPipe(ApplyVoucherValidation))
    applyVoucherDto: ApplyVoucherDto,
    @Res() res: Response,
  ) {
    const result = await this.cartsService.applyVoucher(
      userId,
      applyVoucherDto.code,
    );
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }

  @Delete("clear")
  @ApiShopperEndpoint({
    summary: "Empty the cart",
    description:
      "Removes every line and any applied voucher from the authenticated shopper's cart. Placing an order clears the cart automatically, so this is only for a manual reset.",
  })
  @ApiResponse({ status: 200, description: "Cart cleared successfully" })
  async clearCart(@GetUser("_id") userId: string, @Res() res: Response) {
    const result = await this.cartsService.clearCart(userId);
    if (result.failed) {
      return this.throwErrorRaw(result.description, result.code);
    }
    return this.successResponse(res, result.description, result.data);
  }
}
