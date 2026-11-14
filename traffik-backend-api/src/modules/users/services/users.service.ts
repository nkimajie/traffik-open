/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { UsersRepository } from "../repositories/users.repository";
import { UserDocument } from "../schemas/user.schema";
import { UpdateQuery } from "mongoose";
import { AVAILABLE_INTERESTS } from "../constants/interests.constant";
import { UpdateInterestsDto } from "../dto/update-interests.dto";
import { VendorsService } from "../../vendors/services/vendors.service";
import { ProductsService } from "../../products/services/products.service";
import { CategoriesService } from "../../categories/services/categories.service";
import { PaginationOptions } from "src/common/interfaces/pagination-options.interface";
import { PaginatedResponse } from "src/common/interfaces/paginated-response.interface";
import { SearchDto, SearchType } from "../dto/search.dto";
import { ProductFiltersDto } from "../dto/filters.dto";
import { UtilsService } from "src/modules/shared/services/utils/utils.service";
import { UpdateProfileDto } from "../dto/update-profile.dto";
import { UpdatePasswordDto } from "../dto/update-password.dto";
import { UpdateNotificationSettingsDto } from "../dto/update-notification-settings.dto";
import * as bcrypt from "bcrypt";
import { BaseService } from "src/modules/shared/base/service.base";
import { PromisifiedOperationFeedback } from "src/modules/shared/types/promisified_operation_feedback.type";
import { IUser } from "../interfaces/users.interface";
import { FilesService } from "../../files/services/files.service";
import { validateStructuredPhone } from "src/common/utils/phone-iso.util";
import { EmailService } from "src/modules/shared/services/email/email.service";
import { EmailTemplate } from "src/modules/shared/services/email/enums/email_template.enum";
import { getSupportEmail } from "src/modules/shared/services/email/email.helpers";

@Injectable()
export class UsersService extends BaseService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly vendorsService: VendorsService,
    private readonly productsService: ProductsService,
    private readonly categoriesService: CategoriesService,
    private readonly utilsService: UtilsService,
    private readonly filesService: FilesService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  formatUserData(userData: UserDocument) {
    const user =
      typeof userData.toObject === "function" ? userData.toObject() : userData;

    const { password, ...rest } = user;

    return rest;
  }

  getAvailableInterests(): string[] {
    return [...AVAILABLE_INTERESTS];
  }

  async updateInterests(
    userId: string,
    updateInterestsDto: UpdateInterestsDto,
  ): Promise<UserDocument> {
    const user = await this.usersRepository.query({ _id: userId });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updatedUser = await this.usersRepository.updateOne(
      { _id: userId },
      {
        interests: updateInterestsDto.interests,
        isInterestSet: true,
      },
    );

    if (!updatedUser) {
      throw new NotFoundException("Failed to update user interests");
    }

    return this.formatUserData(updatedUser);
  }

  async getHomeScreenData(userId: string, userRole?: string) {
    try {
      const [vendors, featuredProducts, deals] = await Promise.all([
        this.vendorsService.findForHome(userId, userRole),
        this.productsService.findFeatured(userId),
        this.productsService.findDeals(userId),
      ]);

      return {
        vendors,
        featuredProducts,
        deals,
      };
    } catch (error: any) {
      this.logger.error(`Error getting home screen data: ${error?.message}`);
      throw error;
    }
  }

  async getNewAndHot(
    options: { tab: string; page: number; limit: number },
    userId?: string,
    userRole?: string,
  ): PromisifiedOperationFeedback<any> {
    try {
      const { tab, page, limit } = options;

      switch (tab) {
        case "hot-discount": {
          const result = await this.productsService.findHotDiscounts(
            { page, limit },
            userId,
          );
          return result;
        }

        case "trending-products": {
          const result = await this.productsService.findTrending(
            { limit: limit * page },
            userId,
          );

          if (result.failed) return result;

          const items = result.data.items.slice(
            (page - 1) * limit,
            page * limit,
          );

          return this.Result(false, result.description, {
            items,
            meta: {
              total: result.data.items.length,
              page,
              limit,
              totalPages: Math.ceil(result.data.items.length / limit),
            },
          });
        }

        case "new-stores":
        default: {
          const vendors = await this.vendorsService.findAll(
            { page, limit, sort: { createdAt: -1 } },
            userId,
            userRole,
          );
          return this.Result(
            false,
            "New stores retrieved successfully",
            vendors,
          );
        }
      }
    } catch (error: any) {
      this.logger.error(`Error in getNewAndHot: ${error?.message}`);
      return this.Result(
        true,
        "Failed to retrieve new and hot data",
        undefined,
        500,
      );
    }
  }

  async search(
    searchDto: SearchDto,
    userId: string,
    userRole?: string,
  ): Promise<PaginatedResponse<any>> {
    try {
      const { q, type, page = 1, limit = 10 } = searchDto;
      const searchQuery = { $regex: q, $options: "i" };

      if (type === SearchType.VENDORS) {
        return await this.vendorsService.search(
          searchQuery,
          { page, limit },
          userId,
          userRole,
        );
      } else {
        return await this.productsService.search(
          searchQuery,
          { page, limit },
          userId,
        );
      }
    } catch (error: any) {
      this.logger.error(`Error searching: ${error?.message}`);
      throw error;
    }
  }

  async getCategories() {
    try {
      const result = await this.categoriesService.findAll();
      if (result.failed) {
        throw new Error(result.description ?? "Failed to retrieve categories");
      }
      return result.data;
    } catch (error: any) {
      this.logger.error(`Error getting categories: ${error?.message}`);
      throw error;
    }
  }

  async getCategoryProducts(
    categoryId: string,
    options: PaginationOptions = { page: 1, limit: 10 },
    userId: string,
  ): Promise<PaginatedResponse<any>> {
    try {
      const cat = await this.categoriesService.findById(categoryId);
      if (cat.failed) {
        throw new NotFoundException(cat.description ?? "Category not found");
      }
      return this.productsService.findByCategory(categoryId, options, userId);
    } catch (error: any) {
      this.logger.error(`Error getting category products: ${error?.message}`);
      throw error;
    }
  }

  async getSubcategoryProducts(
    subcategoryId: string,
    options: PaginationOptions = { page: 1, limit: 10 },
    userId: string,
  ): Promise<PaginatedResponse<any>> {
    try {
      const sub =
        await this.categoriesService.findSubcategoryById(subcategoryId);
      if (sub.failed) {
        throw new NotFoundException(sub.description ?? "Subcategory not found");
      }
      return this.productsService.findBySubcategory(
        subcategoryId,
        options,
        userId,
      );
    } catch (error: any) {
      this.logger.error(
        `Error getting subcategory products: ${error?.message}`,
      );
      throw error;
    }
  }

  async getBrands(searchQuery?: string): Promise<string[]> {
    try {
      return this.productsService.findBrands(searchQuery);
    } catch (error: any) {
      this.logger.error(`Error getting brands: ${error?.message}`);
      throw error;
    }
  }

  async getPriceRange(): Promise<{ minPrice: number; maxPrice: number }> {
    try {
      return this.productsService.getPriceRange();
    } catch (error: any) {
      this.logger.error(`Error getting price range: ${error?.message}`);
      throw error;
    }
  }

  async getFilteredProducts(
    filters: ProductFiltersDto,
    userId: string,
  ): Promise<PaginatedResponse<any>> {
    try {
      const { brands, categories, priceRange, page = 1, limit = 10 } = filters;
      return this.productsService.findWithFilters(
        {
          brandIds: brands,
          categoryIds: categories,
          priceRange,
        },
        { page, limit },
        userId,
      );
    } catch (error: any) {
      this.logger.error(`Error getting filtered products: ${error?.message}`);
      throw error;
    }
  }

  async getProfile(userId: string): PromisifiedOperationFeedback<IUser> {
    if (!userId) {
      return this.Result(true, "User ID is required", null);
    }

    const user = await this.usersRepository.query({ _id: userId });

    if (!user) {
      return this.Result(true, "User not found", null);
    }

    user.profilePicture = user.profilePicture ?? null;

    user.phone = user.phone ?? {
      number: null,
      countryCode: null,
    };

    return this.Result(
      false,
      "User fetched successfully",
      this.formatUserData(user),
    );
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
    profilePicture?: Express.Multer.File,
  ): PromisifiedOperationFeedback<IUser> {
    try {
      const user = await this.usersRepository.query({ _id: userId });
      if (!user) {
        return this.Result(true, "User not found", null);
      }

      if (profilePicture) {
        // Validate that the file is an image
        const allowedMimeTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/gif",
          "image/webp",
          "image/avif",
        ];

        this.logger.log(
          `Profile picture uploaded by user ${user.firstName} ${user.lastName} -  mime type: ${profilePicture.mimetype}`,
        );

        if (!allowedMimeTypes.includes(profilePicture.mimetype)) {
          return this.Result(
            true,
            "Invalid file type. Only image files (JPEG, PNG, GIF, WEBP, AVIF) are allowed.",
            null,
          );
        }

        // Validate file size (5MB limit)
        const maxFileSize = 5 * 1024 * 1024; // 5MB
        if (profilePicture.size > maxFileSize) {
          return this.Result(
            true,
            "File size exceeds the maximum limit of 5MB.",
            null,
          );
        }

        // Delete existing profile picture if it exists
        if (user.profilePicture?.pictureID) {
          try {
            await this.filesService.deleteFileByPublicId(
              user.profilePicture.pictureID,
              userId,
            );
          } catch (error: any) {
            this.logger.warn(
              `Failed to delete existing profile picture: ${error?.message}`,
            );
            // Continue with upload even if deletion fails
          }
        }

        // Upload new file as image (explicitly set to ensure correct URL format in all environments)
        const uploadedFile = await this.filesService.uploadFile(
          profilePicture,
          userId,
          "image",
        );

        // Store both pictureID and url from the file service
        updateProfileDto.profilePicture = {
          pictureID: uploadedFile.publicId,
          url: uploadedFile.url,
        };

        // Mark file as in use
        await this.filesService.markFileAsInUse(uploadedFile.publicId, userId);
      }

      const profileUpdate: Record<string, unknown> = {
        ...updateProfileDto,
      };
      if (updateProfileDto.phone != null) {
        const phoneCheck = validateStructuredPhone(updateProfileDto.phone);
        if (phoneCheck.ok === false) {
          return this.Result(true, phoneCheck.message, null);
        }
        profileUpdate.phone = phoneCheck.normalized;
        profileUpdate.countryISOCode = phoneCheck.countryISOCode;
      }

      const updatedUser = await this.usersRepository.update(
        { _id: userId },
        profileUpdate as UpdateQuery<UserDocument>,
      );

      if (!updatedUser) {
        return this.Result(true, "Failed to update user profile", null);
      }

      return this.Result(
        false,
        "User profile updated successfully",
        this.formatUserData(updatedUser),
      );
    } catch (error: any) {
      this.logger.error(
        `Error updating profile: ${error?.message || JSON.stringify(error)}`,
        error?.stack || error,
      );

      return this.Result(
        true,
        error?.message || "Failed to update user profile. Please try again.",
        null,
      );
    }
  }

  async updatePassword(
    userId: string,
    updatePasswordDto: UpdatePasswordDto,
  ): PromisifiedOperationFeedback<void> {
    const user = await this.usersRepository.query({ _id: userId }, "+password");
    if (!user) {
      return this.Result(true, "User not found", null);
    }

    const { oldPassword, newPassword, confirmPassword } = updatePasswordDto;

    if (
      oldPassword == null ||
      typeof oldPassword !== "string" ||
      !oldPassword.trim()
    ) {
      return this.Result(true, "Old password is required", null);
    }
    if (
      newPassword == null ||
      typeof newPassword !== "string" ||
      !newPassword.trim()
    ) {
      return this.Result(true, "New password is required", null);
    }
    if (
      confirmPassword == null ||
      typeof confirmPassword !== "string" ||
      !confirmPassword.trim()
    ) {
      return this.Result(true, "Confirm password is required", null);
    }
    if (newPassword !== confirmPassword) {
      return this.Result(
        true,
        "Confirm password must match new password",
        null,
      );
    }
    if (newPassword.length < 8) {
      return this.Result(
        true,
        "Password must be at least 8 characters long",
        null,
      );
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return this.Result(true, "Invalid old password", null);
    }

    if (oldPassword === newPassword) {
      return this.Result(
        true,
        "New password must be different from old password",
        null,
      );
    }

    const passwordStrengthRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.])[A-Za-z\d@$!%*?&.]{8,}$/;
    if (!passwordStrengthRegex.test(newPassword)) {
      return this.Result(
        true,
        "Password must contain at least one uppercase letter, one lowercase letter, one number and one special character (@$!%*?&.)",
        null,
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedUser = await this.usersRepository.updateOne(
      { _id: userId },
      { password: hashedPassword },
    );

    if (!updatedUser) {
      return this.Result(true, "Failed to update password", null);
    }

    await this.emailService.sendSafe({
      to: user.email,
      template: EmailTemplate.PASSWORD_CHANGED,
      data: {
        name: user.firstName,
        changedAt: new Date().toLocaleString("en-NG", {
          timeZone: "Africa/Lagos",
        }),
        supportEmail: getSupportEmail(),
      },
    });

    return this.Result(false, "Password updated successfully", null);
  }

  async updateNotificationSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): PromisifiedOperationFeedback<UserDocument> {
    const user = await this.usersRepository.query({ _id: userId });
    if (!user) {
      return this.Result(true, "User not found", null);
    }

    const updateQuery: any = {};

    if (dto.general === false) {
      updateQuery["notificationSettings.general"] = false;
      updateQuery["notificationSettings.updates.email"] = false;
      updateQuery["notificationSettings.updates.push"] = false;
      updateQuery["notificationSettings.updates.sms"] = false;
      updateQuery["notificationSettings.promotions.email"] = false;
      updateQuery["notificationSettings.promotions.push"] = false;
      updateQuery["notificationSettings.promotions.sms"] = false;
    } else {
      if (dto.general !== undefined) {
        updateQuery["notificationSettings.general"] = dto.general;
      }

      if (dto.updates) {
        if (dto.updates.email !== undefined) {
          updateQuery["notificationSettings.updates.email"] = dto.updates.email;
        }
        if (dto.updates.push !== undefined) {
          updateQuery["notificationSettings.updates.push"] = dto.updates.push;
        }
        if (dto.updates.sms !== undefined) {
          updateQuery["notificationSettings.updates.sms"] = dto.updates.sms;
        }
      }

      if (dto.promotions) {
        if (dto.promotions.email !== undefined) {
          updateQuery["notificationSettings.promotions.email"] =
            dto.promotions.email;
        }
        if (dto.promotions.push !== undefined) {
          updateQuery["notificationSettings.promotions.push"] =
            dto.promotions.push;
        }
        if (dto.promotions.sms !== undefined) {
          updateQuery["notificationSettings.promotions.sms"] =
            dto.promotions.sms;
        }
      }
    }

    if (Object.keys(updateQuery).length === 0) {
      return this.formatUserData(user);
    }

    const updatedUser = await this.usersRepository.updateOne(
      { _id: userId },
      { $set: updateQuery },
    );

    if (!updatedUser) {
      // throw new NotFoundException("Failed to update notification settings");
      return this.Result(false, "Failed to update notification settings", null);
    }

    return this.Result(
      true,
      "Notification settings updated successfully",
      this.formatUserData(updatedUser),
    );
  }

  async logout(userId: string): PromisifiedOperationFeedback<void> {
    const user = await this.usersRepository.query({ _id: userId });
    if (!user) {
      return this.Result(true, "User not found", null);
    }

    // Increment tokenVersion to invalidate all existing tokens
    const currentTokenVersion = user.tokenVersion || 0;
    const updatedUser = await this.usersRepository.updateOne(
      { _id: userId },
      { tokenVersion: currentTokenVersion + 1 },
    );

    if (!updatedUser) {
      return this.Result(true, "Failed to logout", null);
    }

    return this.Result(false, "Logged out successfully", null);
  }
}
