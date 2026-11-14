import { applyDecorators } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

/**
 * Who is allowed to call an endpoint. Every documented endpoint declares one or
 * more audiences so the Swagger UI can be browsed by caller instead of only by
 * domain.
 */
export enum ApiAudience {
  /** Anyone, signed in or not. No Authorization header required. */
  PUBLIC = "Public",
  /** Signed-in shopper — JWT with role `user`. */
  SHOPPER = "Shopper",
  /** Signed-in store owner — JWT with role `vendor`. */
  VENDOR = "Vendor",
  /** Signed-in platform operator — JWT with role `admin`. */
  ADMIN = "Admin",
}

/**
 * Swagger tag names used for audience grouping. Operations keep their domain tag
 * (Products, Orders, ...) and additionally appear under these audience tags.
 */
export const AUDIENCE_TAGS: Record<ApiAudience, string> = {
  [ApiAudience.PUBLIC]: "Callable by: Public",
  [ApiAudience.SHOPPER]: "Callable by: Shopper",
  [ApiAudience.VENDOR]: "Callable by: Vendor",
  [ApiAudience.ADMIN]: "Callable by: Admin",
};

const AUDIENCE_REQUIREMENT: Record<ApiAudience, string> = {
  [ApiAudience.PUBLIC]: "no authentication required",
  [ApiAudience.SHOPPER]: "Bearer JWT with role `user`",
  [ApiAudience.VENDOR]: "Bearer JWT with role `vendor`",
  [ApiAudience.ADMIN]: "Bearer JWT with role `admin`",
};

export type ApiEndpointOptions = {
  /** Who may call this endpoint. Pass an array when several roles share it. */
  audience: ApiAudience | ApiAudience[];
  /** Short imperative title shown in the Swagger operation list. */
  summary: string;
  /** Optional longer explanation appended under the audience banner. */
  description?: string;
  /** Set when the endpoint accepts an optional token and enriches the response. */
  optionalAuth?: boolean;
  deprecated?: boolean;
};

function toArray(audience: ApiAudience | ApiAudience[]): ApiAudience[] {
  return Array.isArray(audience) ? audience : [audience];
}

function buildAudienceBanner(
  audiences: ApiAudience[],
  optionalAuth: boolean,
): string {
  const names = audiences.join(", ");
  const requirements = audiences
    .map((audience) => `\`${audience}\` — ${AUDIENCE_REQUIREMENT[audience]}`)
    .join("<br/>");

  const authNote = optionalAuth
    ? "\n\n**Authentication:** optional. The endpoint works anonymously and returns extra personalised fields when a valid token is supplied."
    : "";

  return `**Callable by:** ${names}\n\n${requirements}${authNote}`;
}

/**
 * Documents an endpoint with its audience, summary, and the error responses that
 * follow from its authentication requirements.
 *
 * ```typescript
 * @ApiEndpoint({
 *   audience: ApiAudience.VENDOR,
 *   summary: "Create a product",
 *   description: "Creates a product owned by the authenticated vendor.",
 * })
 * @Post()
 * createProduct(@Body() dto: CreateProductDto) { ... }
 * ```
 */
export function ApiEndpoint(options: ApiEndpointOptions) {
  const audiences = toArray(options.audience);
  const optionalAuth = options.optionalAuth ?? false;
  const isPublicOnly =
    audiences.length === 1 && audiences[0] === ApiAudience.PUBLIC;
  const requiresToken = !isPublicOnly && !optionalAuth;

  const banner = buildAudienceBanner(audiences, optionalAuth);
  const description = options.description
    ? `${banner}\n\n${options.description}`
    : banner;

  const decorators: Array<
    ClassDecorator | MethodDecorator | PropertyDecorator
  > = [
    ApiTags(...audiences.map((audience) => AUDIENCE_TAGS[audience])),
    ApiOperation({
      summary: options.summary,
      description,
      deprecated: options.deprecated,
    }),
  ];

  if (!isPublicOnly) {
    decorators.push(ApiBearerAuth());
  }

  if (requiresToken) {
    decorators.push(
      ApiResponse({
        status: 401,
        description: "Missing, malformed, or expired Bearer token",
      }),
    );

    const roleRestricted = audiences.some(
      (audience) => audience !== ApiAudience.PUBLIC,
    );

    if (roleRestricted) {
      decorators.push(
        ApiResponse({
          status: 403,
          description: `Authenticated caller is not one of: ${audiences.join(", ")}`,
        }),
      );
    }
  }

  return applyDecorators(...decorators);
}

/** Shorthand for endpoints open to everyone. */
export function ApiPublicEndpoint(
  options: Omit<ApiEndpointOptions, "audience">,
) {
  return ApiEndpoint({ ...options, audience: ApiAudience.PUBLIC });
}

/** Shorthand for endpoints restricted to signed-in shoppers (role `user`). */
export function ApiShopperEndpoint(
  options: Omit<ApiEndpointOptions, "audience">,
) {
  return ApiEndpoint({ ...options, audience: ApiAudience.SHOPPER });
}

/** Shorthand for endpoints restricted to signed-in vendors. */
export function ApiVendorEndpoint(
  options: Omit<ApiEndpointOptions, "audience">,
) {
  return ApiEndpoint({ ...options, audience: ApiAudience.VENDOR });
}

/** Shorthand for endpoints restricted to platform admins. */
export function ApiAdminEndpoint(
  options: Omit<ApiEndpointOptions, "audience">,
) {
  return ApiEndpoint({ ...options, audience: ApiAudience.ADMIN });
}
