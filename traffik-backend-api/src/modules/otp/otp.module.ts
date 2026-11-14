import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { OtpController } from "./controllers/otp.controller";
import { OtpService } from "./services/otp.service";
import { Otp, OtpSchema } from "./schemas/otp.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Vendor, VendorSchema } from "../vendors/schemas/vendor.schema";
import { SharedModule } from "../shared/shared.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Otp.name, schema: OtpSchema },
      { name: User.name, schema: UserSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
    SharedModule,
  ],
  controllers: [OtpController],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
