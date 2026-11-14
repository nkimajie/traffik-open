import { VendorsService } from "./vendors.service";

describe("VendorsService vendor formatting", () => {
  // The formatters use no injected dependencies.
  const service = Object.create(VendorsService.prototype) as VendorsService;

  const vendorDoc = {
    _id: "vendor-1",
    firstName: "Ada",
    lastName: "Obi",
    email: "owner.personal@example.com",
    password: "$2b$10$hash",
    phone: { number: "8012345678", countryCode: "234" },
    countryISOCode: "NG",
    googleId: "google-123",
    appleId: "apple-123",
    loginType: "email",
    lastLoginAt: new Date("2025-01-01"),
    kashiaCustomerId: "kashia-uuid",
    businessName: "Ada Stores",
    businessEmail: "hello@adastores.example",
    businessPhone: "+2348012345678",
    storeLogo: "https://res.cloudinary.com/logo.png",
    isApproved: true,
    isActive: true,
    totalLikes: 4,
  };

  it("keeps owner account fields in the owner's own format (minus password)", () => {
    const own = service.formatVendorData(vendorDoc);

    expect(own).not.toHaveProperty("password");
    expect(own).toMatchObject({
      email: "owner.personal@example.com",
      phone: { number: "8012345678", countryCode: "234" },
      kashiaCustomerId: "kashia-uuid",
    });
  });

  it("strips private owner fields from the public format", () => {
    const publicView = service.formatPublicVendorData(vendorDoc);

    for (const field of [
      "password",
      "email",
      "phone",
      "countryISOCode",
      "googleId",
      "appleId",
      "loginType",
      "lastLoginAt",
      "kashiaCustomerId",
    ]) {
      expect(publicView).not.toHaveProperty(field);
    }
  });

  it("keeps the store's public details", () => {
    expect(service.formatPublicVendorData(vendorDoc)).toMatchObject({
      _id: "vendor-1",
      firstName: "Ada",
      lastName: "Obi",
      businessName: "Ada Stores",
      businessEmail: "hello@adastores.example",
      businessPhone: "+2348012345678",
      storeLogo: "https://res.cloudinary.com/logo.png",
      isApproved: true,
      totalLikes: 4,
    });
  });

  it("does not mutate the source document", () => {
    service.formatPublicVendorData(vendorDoc);
    expect(vendorDoc.email).toBe("owner.personal@example.com");
  });
});
