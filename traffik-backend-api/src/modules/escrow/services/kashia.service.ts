import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Config } from "src/config/configuration";
import { UsersRepository } from "src/modules/users/repositories/users.repository";
import { VendorsRepository } from "src/modules/vendors/repositories/vendors.repository";
import { IUserPhone } from "src/modules/users/interfaces/users.interface";
import {
  CreateKashiaCustomerPayload,
  CreateKashiaPaymentLinkPayload,
  KashiaApiResponse,
  KashiaCustomer,
  KashiaPaymentLink,
} from "../interfaces/kashia.interface";
import { KASHIA_REQUEST_TIMEOUT_MS } from "../constants/kashia.constant";

@Injectable()
export class KashiaService {
  private readonly logger = new Logger(KashiaService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly vendorsRepository: VendorsRepository,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.getApiKey() && this.getBaseUrl());
  }

  /**
   * Returns the shopper's Kashia customer UUID, creating and persisting one when
   * missing. Safe to call on every checkout — the local ID short-circuits the API.
   */
  async getOrCreateCustomer(userId: string): Promise<string> {
    const user = await this.usersRepository.query({ _id: userId });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.kashiaCustomerId) {
      return user.kashiaCustomerId;
    }

    const customer = await this.createCustomerOnKashia({
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      phone_number: this.formatPhoneNumber(user.phone),
    });

    await this.usersRepository.updateOne(
      { _id: userId },
      { kashiaCustomerId: customer.id },
    );

    this.logger.log(
      `Registered Kashia customer for user ${userId} (${customer.is_new ? "new" : "existing"})`,
    );

    return customer.id;
  }

  /**
   * Returns the vendor's Kashia customer UUID for marketplace payouts. Called at
   * store approval and again at checkout if the vendor predates this integration.
   */
  async getOrCreateVendorCustomer(vendorId: string): Promise<string> {
    const vendor = await this.vendorsRepository.query({ _id: vendorId });
    if (!vendor) {
      throw new NotFoundException("Vendor not found");
    }

    if (vendor.kashiaCustomerId) {
      return vendor.kashiaCustomerId;
    }

    const email = vendor.businessEmail?.trim() || vendor.email;
    const customer = await this.createCustomerOnKashia({
      email,
      first_name: vendor.firstName,
      last_name: vendor.lastName,
      phone_number: this.formatPhoneNumber(vendor.phone),
    });

    await this.vendorsRepository.updateOne(
      { _id: vendorId },
      { kashiaCustomerId: customer.id },
    );

    this.logger.log(
      `Registered Kashia customer for vendor ${vendorId} (${customer.is_new ? "new" : "existing"})`,
    );

    return customer.id;
  }

  async createPaymentLink(
    payload: CreateKashiaPaymentLinkPayload,
  ): Promise<KashiaPaymentLink> {
    const response = await this.request<KashiaPaymentLink>(
      "/external/payment-links",
      {
        method: "POST",
        body: JSON.stringify({
          currency: "NGN",
          ...payload,
        }),
      },
    );

    return response.data;
  }

  async getPaymentLink(reference: string): Promise<KashiaPaymentLink> {
    const encoded = encodeURIComponent(reference);
    const response = await this.request<KashiaPaymentLink>(
      `/external/payment-links/${encoded}`,
      { method: "GET" },
    );

    return response.data;
  }

  private async createCustomerOnKashia(
    payload: CreateKashiaCustomerPayload,
  ): Promise<KashiaCustomer> {
    const response = await this.request<KashiaCustomer>("/external/customers", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return response.data;
  }

  private async request<T>(
    path: string,
    init: RequestInit,
  ): Promise<KashiaApiResponse<T>> {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();

    if (!apiKey || !baseUrl) {
      throw new InternalServerErrorException("Kashia is not configured");
    }

    const url = `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

    // Every call is time-limited: a hanging Kashia call would otherwise hold
    // a checkout (and its lock) or a webhook until the Lambda is killed.
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      KASHIA_REQUEST_TIMEOUT_MS,
    );

    let response: Response;
    let body: KashiaApiResponse<T>;
    try {
      try {
        response = await fetch(url, {
          ...init,
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            ...(init.headers ?? {}),
          },
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          this.logger.error(
            `Kashia request timed out after ${KASHIA_REQUEST_TIMEOUT_MS}ms: ${path}`,
          );
          throw new InternalServerErrorException(
            "Kashia did not respond in time",
          );
        }
        this.logger.error(`Kashia request failed: ${path}`, error);
        throw new InternalServerErrorException("Unable to reach Kashia");
      }

      try {
        body = (await response.json()) as KashiaApiResponse<T>;
      } catch {
        if (controller.signal.aborted) {
          throw new InternalServerErrorException(
            "Kashia did not respond in time",
          );
        }
        throw new InternalServerErrorException("Invalid response from Kashia");
      }
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok || !body.success) {
      const message =
        body.error?.message ||
        `Kashia request failed (${response.status}) for ${path}`;
      this.logger.error(message, body.error);
      throw new InternalServerErrorException(message);
    }

    return body;
  }

  private getApiKey(): string | undefined {
    return Config.getValue("KASHIA_API_KEY")?.trim() || undefined;
  }

  private getBaseUrl(): string | undefined {
    const raw = Config.getValue("KASHIA_BASE_URL")?.trim();
    if (!raw) {
      return undefined;
    }

    const host = raw.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
    return `${host}/api/v1`;
  }

  private formatPhoneNumber(phone?: IUserPhone | null): string | undefined {
    if (!phone?.number) {
      return undefined;
    }

    const digits = phone.number.replace(/\D/g, "");
    if (!digits) {
      return undefined;
    }

    const countryCode = (phone.countryCode || "").replace(/\D/g, "");
    if (countryCode) {
      return `+${countryCode}${digits}`;
    }

    return digits.startsWith("+") ? digits : `+${digits}`;
  }
}
