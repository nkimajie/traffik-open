import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { CategoriesRepository } from "../repositories/categories.repository";
import { SubcategoriesRepository } from "../repositories/subcategories.repository";
import { CreateCategoryDto } from "../dto/create-category.dto";
import { CreateSubcategoryDto } from "../dto/create-subcategory.dto";
import { UpdateSubcategoryDto } from "../dto/update-subcategory.dto";
import { CategoryDocument } from "../schemas/category.schema";
import { SubcategoryDocument } from "../schemas/subcategory.schema";
import {
  ICategory,
  ICategoryDetail,
  ISubcategory,
} from "../interfaces/categories.interface";
import { BaseService } from "src/modules/shared/base/service.base";
import { PromisifiedOperationFeedback } from "src/modules/shared/types/promisified_operation_feedback.type";

@Injectable()
export class CategoriesService extends BaseService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly subcategoriesRepository: SubcategoriesRepository,
  ) {
    super();
  }

  private toSubcategoryPlain(doc: SubcategoryDocument): ISubcategory {
    const o =
      typeof (doc as any)?.toObject === "function"
        ? (doc as any).toObject()
        : doc;
    return o as ISubcategory;
  }

  async create(
    createCategoryDto: CreateCategoryDto,
    adminId: string,
  ): PromisifiedOperationFeedback<CategoryDocument> {
    try {
      const category = await this.categoriesRepository.create({
        ...createCategoryDto,
        createdBy: adminId,
      });
      if (!category) {
        return this.Result(
          true,
          "Failed to create category",
          undefined,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      return this.Result(false, "Category created successfully", category);
    } catch (error: any) {
      this.logger.error(`Error creating category: ${error?.message}`);
      return this.Result(
        true,
        error?.message ?? "Failed to create category",
        undefined,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(): PromisifiedOperationFeedback<ICategory[]> {
    try {
      const result = await this.categoriesRepository.queryAll(
        { isActive: true },
        {},
        { page: 1, itemsPerPage: 1000 },
      );
      return this.Result(
        false,
        "Categories retrieved successfully",
        result.items as ICategory[],
      );
    } catch (error: any) {
      this.logger.error(`Error finding all categories: ${error?.message}`);
      return this.Result(
        true,
        error?.message ?? "Failed to retrieve categories",
        undefined,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findById(id: string): PromisifiedOperationFeedback<ICategory> {
    try {
      const category = await this.categoriesRepository.query({ _id: id });
      if (!category) {
        return this.Result(
          true,
          "Category not found",
          undefined,
          HttpStatus.NOT_FOUND,
        );
      }
      return this.Result(
        false,
        "Category retrieved successfully",
        category as ICategory,
      );
    } catch (error: any) {
      this.logger.error(`Error finding category by id: ${error?.message}`);
      return this.Result(
        true,
        error?.message ?? "Failed to retrieve category",
        undefined,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Category plus active subcategories (for GET /categories/:id).
   */
  async findCategoryDetailById(
    id: string,
  ): PromisifiedOperationFeedback<ICategoryDetail> {
    try {
      const catResult = await this.findById(id);
      if (catResult.failed || !catResult.data) {
        return this.Result(
          true,
          catResult.description ?? "Category not found",
          undefined,
          catResult.code ?? HttpStatus.NOT_FOUND,
        );
      }

      const subs = await this.subcategoriesRepository.queryAll(
        { categoryId: id, isActive: true },
        {},
        { page: 1, itemsPerPage: 1000 },
      );

      const subcategories = (subs.items || []).map((s) =>
        this.toSubcategoryPlain(s as SubcategoryDocument),
      );

      const detail: ICategoryDetail = {
        ...catResult.data,
        subcategories,
      };

      return this.Result(
        false,
        "Category retrieved successfully",
        detail,
      );
    } catch (error: any) {
      this.logger.error(
        `Error loading category detail: ${error?.message}`,
      );
      return this.Result(
        true,
        error?.message ?? "Failed to retrieve category",
        undefined,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createSubcategory(
    dto: CreateSubcategoryDto,
    adminId: string,
  ): PromisifiedOperationFeedback<SubcategoryDocument> {
    try {
      const cat = await this.findById(dto.categoryId);
      if (cat.failed) {
        return this.Result(
          true,
          cat.description ?? "Category not found",
          undefined,
          cat.code ?? HttpStatus.NOT_FOUND,
        );
      }

      const subcategory = await this.subcategoriesRepository.create({
        ...dto,
        createdBy: adminId,
      });
      if (!subcategory) {
        return this.Result(
          true,
          "Failed to create subcategory",
          undefined,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      return this.Result(false, "Subcategory created successfully", subcategory);
    } catch (error: any) {
      this.logger.error(`Error creating subcategory: ${error?.message}`);
      return this.Result(
        true,
        error?.message ?? "Failed to create subcategory",
        undefined,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAllSubcategories(): PromisifiedOperationFeedback<
    SubcategoryDocument[]
  > {
    try {
      const result = await this.subcategoriesRepository.queryAll(
        { isActive: true },
        {},
        { page: 1, itemsPerPage: 1000 },
      );
      return this.Result(
        false,
        "Subcategories retrieved successfully",
        result.items,
      );
    } catch (error: any) {
      this.logger.error(`Error finding all subcategories: ${error?.message}`);
      return this.Result(
        true,
        error?.message ?? "Failed to retrieve subcategories",
        undefined,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findSubcategoriesByCategoryId(
    categoryId: string,
  ): PromisifiedOperationFeedback<SubcategoryDocument[]> {
    try {
      const cat = await this.findById(categoryId);
      if (cat.failed) {
        return this.Result(
          true,
          cat.description ?? "Category not found",
          undefined,
          cat.code ?? HttpStatus.NOT_FOUND,
        );
      }

      const result = await this.subcategoriesRepository.queryAll(
        { categoryId, isActive: true },
        {},
        { page: 1, itemsPerPage: 1000 },
      );
      return this.Result(
        false,
        "Subcategories retrieved successfully",
        result.items,
      );
    } catch (error: any) {
      this.logger.error(
        `Error finding subcategories by category id: ${error?.message}`,
      );
      return this.Result(
        true,
        error?.message ?? "Failed to retrieve subcategories",
        undefined,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findSubcategoryById(
    id: string,
  ): PromisifiedOperationFeedback<SubcategoryDocument> {
    try {
      const subcategory = await this.subcategoriesRepository.query({
        _id: id,
      });
      if (!subcategory) {
        return this.Result(
          true,
          "Subcategory not found",
          undefined,
          HttpStatus.NOT_FOUND,
        );
      }
      return this.Result(
        false,
        "Subcategory retrieved successfully",
        subcategory,
      );
    } catch (error: any) {
      this.logger.error(`Error finding subcategory by id: ${error?.message}`);
      return this.Result(
        true,
        error?.message ?? "Failed to retrieve subcategory",
        undefined,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateSubcategory(
    id: string,
    dto: UpdateSubcategoryDto,
  ): PromisifiedOperationFeedback<SubcategoryDocument> {
    try {
      if (dto.categoryId) {
        const cat = await this.findById(dto.categoryId);
        if (cat.failed) {
          return this.Result(
            true,
            cat.description ?? "Category not found",
            undefined,
            cat.code ?? HttpStatus.NOT_FOUND,
          );
        }
      }

      const subcategory = await this.subcategoriesRepository.update(
        { _id: id },
        dto,
      );
      if (!subcategory) {
        return this.Result(
          true,
          "Subcategory not found",
          undefined,
          HttpStatus.NOT_FOUND,
        );
      }
      return this.Result(false, "Subcategory updated successfully", subcategory);
    } catch (error: any) {
      this.logger.error(`Error updating subcategory: ${error?.message}`);
      return this.Result(
        true,
        error?.message ?? "Failed to update subcategory",
        undefined,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
