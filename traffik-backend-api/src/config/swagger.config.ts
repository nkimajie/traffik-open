import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import {
  AUDIENCE_TAGS,
  ApiAudience,
} from "../common/decorators/api-audience.decorator";

const SWAGGER_PATH = "api";

const API_DESCRIPTION = `
Traffik is a multi-vendor marketplace. This API is shared by three clients:
the shopper apps (web and mobile), the vendor portal, and the admin console.

## Reading these docs

Every operation states who may call it. The banner at the top of each operation
description looks like this:

> **Callable by:** Vendor
>
> \`Vendor\` — Bearer JWT with role \`vendor\`

You can also browse by caller instead of by domain. Alongside the domain tags
(Products, Orders, Carts, ...) there are four audience tags:

| Tag | Who | Auth |
| --- | --- | --- |
| \`${AUDIENCE_TAGS[ApiAudience.PUBLIC]}\` | Anyone, signed in or not | None |
| \`${AUDIENCE_TAGS[ApiAudience.SHOPPER]}\` | Signed-in shopper | Bearer JWT, role \`user\` |
| \`${AUDIENCE_TAGS[ApiAudience.VENDOR]}\` | Signed-in store owner | Bearer JWT, role \`vendor\` |
| \`${AUDIENCE_TAGS[ApiAudience.ADMIN]}\` | Platform operator | Bearer JWT, role \`admin\` |

An operation appears under its domain tag **and** under every audience tag that
may call it, so \`GET /products/{id}\` shows up under *Products* and under
*Callable by: Public*.

## Authentication

Obtain a token from \`POST /auth/login\` (shoppers and vendors, discriminated by
the \`role\` field in the request body) or \`POST /auth/admin/login\` (admins), then
send it as \`Authorization: Bearer <token>\`.

Some read endpoints accept an **optional** token. They work anonymously and add
personalised fields (such as \`isFavorite\`) when a valid token is supplied. Those
operations say so explicitly in their description.

## Response envelope

Every response is wrapped by a global interceptor:

\`\`\`json
{ "status": 200, "message": "Operation successful", "data": {} }
\`\`\`

Paginated responses put the list in \`data.items\` with \`data.meta\` carrying
\`total\`, \`page\`, \`limit\`, and \`totalPages\`.

## Route prefix

There is **no** global \`/api/v1\` prefix. Paths are flat and appear here exactly
as they must be called (\`/products\`, \`/orders\`, \`/vendors\`).
`.trim();

type TagDefinition = { name: string; description: string };

const AUDIENCE_TAG_DEFINITIONS: TagDefinition[] = [
  {
    name: AUDIENCE_TAGS[ApiAudience.PUBLIC],
    description:
      "Open endpoints. No Authorization header required. Safe for unauthenticated storefront browsing.",
  },
  {
    name: AUDIENCE_TAGS[ApiAudience.SHOPPER],
    description:
      "Endpoints for signed-in shoppers. Require a Bearer JWT issued for role `user`.",
  },
  {
    name: AUDIENCE_TAGS[ApiAudience.VENDOR],
    description:
      "Endpoints for signed-in store owners. Require a Bearer JWT issued for role `vendor`.",
  },
  {
    name: AUDIENCE_TAGS[ApiAudience.ADMIN],
    description:
      "Endpoints for platform operators. Require a Bearer JWT issued for role `admin`.",
  },
];

const DOMAIN_TAG_DEFINITIONS: TagDefinition[] = [
  {
    name: "Health",
    description: "Service liveness probe used by infrastructure monitors.",
  },
  {
    name: "Authentication",
    description:
      "Signup, login, and OAuth for all three roles. The `role` field in the request body selects which collection is queried.",
  },
  {
    name: "Admin",
    description:
      "Platform operator tools mounted under `/admin/*` — email testing, and future dashboard routes. Requires Bearer JWT with role `admin`.",
  },
  {
    name: "Email verification",
    description:
      "One-time password issue and verification for email ownership. Vendors request codes explicitly during onboarding; shoppers verify after signup.",
  },
  {
    name: "Users",
    description:
      "Shopper account surface: home feed, discovery, search, profile, password, notification settings, and interests.",
  },
  {
    name: "Vendors",
    description:
      "Store onboarding and KYC for vendors, vendor-facing analytics, public store profiles, and shopper favourites and likes on stores.",
  },
  {
    name: "Products",
    description:
      "Catalog reads for shoppers and the public, product management for vendors, and shopper product favourites.",
  },
  {
    name: "Product reviews",
    description:
      "Shopper-authored reviews, review summaries, and helpful votes for a product.",
  },
  {
    name: "Categories",
    description:
      "Category and subcategory taxonomy. Reads are open; writes are admin-only.",
  },
  {
    name: "Carts",
    description: "The signed-in shopper's cart, including voucher application.",
  },
  {
    name: "Addresses",
    description: "The signed-in shopper's delivery address book.",
  },
  {
    name: "Orders & Checkout",
    description:
      "Checkout preview, order placement, shopper order history and cancellation, plus admin status transitions.",
  },
  {
    name: "Vouchers",
    description: "Platform-wide discount codes. Admin creates, shoppers list.",
  },
  {
    name: "Files",
    description:
      "Cloudinary-backed uploads used for product images, store logos, and KYC documents.",
  },
  {
    name: "Waitlist",
    description: "Pre-launch email capture from the marketing site.",
  },
];

function buildDocumentConfig() {
  const builder = new DocumentBuilder()
    .setTitle("Traffik API")
    .setDescription(API_DESCRIPTION)
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Paste the token returned by /auth/login, /auth/admin/login, or /auth/signup.",
      },
      "bearer",
    );

  for (const tag of AUDIENCE_TAG_DEFINITIONS) {
    builder.addTag(tag.name, tag.description);
  }

  for (const tag of DOMAIN_TAG_DEFINITIONS) {
    builder.addTag(tag.name, tag.description);
  }

  return builder.build();
}

/**
 * Mounts the Swagger UI at `/api`. Shared by the local bootstrap (`main.ts`) and
 * the Lambda handler (`lambda.ts`) so both environments expose identical docs.
 */
export function setupSwagger(app: INestApplication): void {
  const document = SwaggerModule.createDocument(app, buildDocumentConfig());

  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: "none",
      filter: true,
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
    customSiteTitle: "Traffik API — endpoint reference",
  });
}

export const swaggerPath = SWAGGER_PATH;
