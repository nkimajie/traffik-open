import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  ApiAdminEndpoint,
  ApiPublicEndpoint,
} from "src/common/decorators/api-audience.decorator";
import { Response } from "express";
import { CategoriesService } from "../services/categories.service";
import { CreateCategoryDto } from "../dto/create-category.dto";
import { CreateSubcategoryDto } from "../dto/create-subcategory.dto";
import { UpdateSubcategoryDto } from "../dto/update-subcategory.dto";
import { MongoIdPipe } from "../../shared/pipes/mongo-id.pipe";
import { CreateCategoryValidation } from "../validations/create-category.validation";
import { CreateSubcategoryValidation } from "../validations/create-subcategory.validation";
import { UpdateSubcategoryValidation } from "../validations/update-subcategory.validation";
import RoleGuard from "src/common/guards/roles.guard";
import { UserRole } from "src/modules/users/enums/user-role.enum";
import { GetUser } from "src/common/decorators/get-user.decorator";
import { JoiValidationPipe } from "src/common/pipes/validation/joi_validate.pipe";
import { BaseController } from "src/modules/shared/base/controller.base";

/**
 * Mixed-audience controller. Reads are open to anyone so the storefront can be
 * browsed anonymously; every write is guarded by `RoleGuard([UserRole.ADMIN])`.
 */
@ApiTags("Categories")
@Controller("categories")
export class CategoriesController extends BaseController {
  constructor(private readonly categoriesService: CategoriesService) {
    super();
  }

  @Post()
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "Create a category",
    description:
      "Adds a top-level category to the platform taxonomy. Vendors then assign products to categories, and shoppers browse by them.",
  })
  @ApiResponse({ status: 201, description: "Category created successfully" })
  @ApiResponse({ status: 409, description: "A category with that name exists" })
  async create(
    @GetUser() admin: any,
    @Body(new JoiValidationPipe(CreateCategoryValidation))
    createCategoryDto: CreateCategoryDto,
    @Res() res: Response,
  ) {
    const result = await this.categoriesService.create(
      createCategoryDto,
      admin._id,
    );
    if (result.failed) {
      return this.throwErrorRaw(
        result.description ?? "Failed to create category",
        result.code,
      );
    }
    return this.successResponse(
      res,
      result.description ?? "Category created successfully",
      result.data,
      HttpStatus.CREATED,
    );
  }

  @Get()
  @ApiPublicEndpoint({
    summary: "List all categories",
    description:
      "Returns the full category taxonomy. Open so the storefront navigation renders before a shopper signs in.",
  })
  @ApiResponse({ status: 200, description: "Return all categories" })
  async findAll(@Res() res: Response) {
    const result = await this.categoriesService.findAll();
    if (result.failed) {
      return this.throwErrorRaw(
        result.description ?? "Failed to retrieve categories",
        result.code,
      );
    }
    return this.successResponse(
      res,
      result.description ?? "Categories retrieved successfully",
      result.data,
      HttpStatus.OK,
    );
  }

  // --- Subcategories (declare before :id so paths are not captured as ids) ---

  @Post("subcategories")
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "Create a subcategory",
    description:
      "Adds a subcategory under an existing category. The parent category id is supplied in the request body.",
  })
  @ApiResponse({ status: 201, description: "Subcategory created successfully" })
  @ApiResponse({ status: 404, description: "Parent category not found" })
  async createSubcategory(
    @GetUser() admin: any,
    @Body(new JoiValidationPipe(CreateSubcategoryValidation))
    dto: CreateSubcategoryDto,
    @Res() res: Response,
  ) {
    const result = await this.categoriesService.createSubcategory(
      dto,
      admin._id,
    );
    if (result.failed) {
      return this.throwErrorRaw(
        result.description ?? "Failed to create subcategory",
        result.code,
      );
    }
    return this.successResponse(
      res,
      result.description ?? "Subcategory created successfully",
      result.data,
      HttpStatus.CREATED,
    );
  }

  @Get("subcategories/all")
  @ApiPublicEndpoint({
    summary: "List every subcategory",
    description:
      "Flat list of all subcategories across all categories, for building filter menus in one call.",
  })
  @ApiResponse({ status: 200, description: "Return all subcategories" })
  async findAllSubcategories(@Res() res: Response) {
    const result = await this.categoriesService.findAllSubcategories();
    if (result.failed) {
      return this.throwErrorRaw(
        result.description ?? "Failed to retrieve subcategories",
        result.code,
      );
    }
    return this.successResponse(
      res,
      result.description ?? "Subcategories retrieved successfully",
      result.data,
      HttpStatus.OK,
    );
  }

  @Get(":categoryId/subcategories")
  @ApiPublicEndpoint({
    summary: "List a category's subcategories",
    description:
      "Returns the active subcategories that belong to one category.",
  })
  @ApiParam({ name: "categoryId", description: "Category ObjectId" })
  @ApiResponse({ status: 200, description: "Return subcategories" })
  @ApiResponse({ status: 404, description: "Category not found" })
  async findSubcategoriesByCategoryId(
    @Param("categoryId", MongoIdPipe) categoryId: string,
    @Res() res: Response,
  ) {
    const result =
      await this.categoriesService.findSubcategoriesByCategoryId(categoryId);
    if (result.failed) {
      return this.throwErrorRaw(
        result.description ?? "Failed to retrieve subcategories",
        result.code,
      );
    }
    return this.successResponse(
      res,
      result.description ?? "Subcategories retrieved successfully",
      result.data,
      HttpStatus.OK,
    );
  }

  @Patch("subcategories/:id")
  @UseGuards(RoleGuard([UserRole.ADMIN]))
  @ApiAdminEndpoint({
    summary: "Update a subcategory",
    description:
      "Renames a subcategory, moves it to another parent category, or toggles whether it is active.",
  })
  @ApiParam({ name: "id", description: "Subcategory ObjectId" })
  @ApiResponse({ status: 200, description: "Subcategory updated successfully" })
  @ApiResponse({ status: 404, description: "Subcategory not found" })
  async updateSubcategory(
    @Param("id", MongoIdPipe) id: string,
    @Body(new JoiValidationPipe(UpdateSubcategoryValidation))
    dto: UpdateSubcategoryDto,
    @Res() res: Response,
  ) {
    const result = await this.categoriesService.updateSubcategory(id, dto);
    if (result.failed) {
      return this.throwErrorRaw(
        result.description ?? "Failed to update subcategory",
        result.code,
      );
    }
    return this.successResponse(
      res,
      result.description ?? "Subcategory updated successfully",
      result.data,
      HttpStatus.OK,
    );
  }

  @Get(":id")
  @ApiPublicEndpoint({
    summary: "Get a category with its subcategories",
    description:
      "Returns one category with its active subcategories nested under `subcategories`, so a category landing page needs a single request.",
  })
  @ApiParam({ name: "id", description: "Category ObjectId" })
  @ApiResponse({
    status: 200,
    description: "Return the category with subcategories",
  })
  @ApiResponse({ status: 404, description: "Category not found" })
  async findOne(@Param("id", MongoIdPipe) id: string, @Res() res: Response) {
    const result = await this.categoriesService.findCategoryDetailById(id);
    if (result.failed) {
      return this.throwErrorRaw(
        result.description ?? "Category not found",
        result.code,
      );
    }
    return this.successResponse(
      res,
      result.description ?? "Category retrieved successfully",
      result.data,
      HttpStatus.OK,
    );
  }
}
