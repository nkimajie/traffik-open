import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthenticationController } from "./controllers/authentication.controller";
import { AuthenticationService } from "./services/authentication.service";
import { User, UserSchema } from "../users/schemas/user.schema";
import { Vendor, VendorSchema } from "../vendors/schemas/vendor.schema";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { OtpModule } from "../otp/otp.module";
import { UsersModule } from "../users/users.module";
import { VendorsModule } from "../vendors/vendors.module";
import { JwtStrategy } from "../../common/strategies/jwt.strategy";
import { AdminModule } from "../admin/admin.module";

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRES_IN", "1d"),
        },
      }),
      inject: [ConfigService],
    }),
    OtpModule,
    UsersModule,
    VendorsModule,
    AdminModule,
  ],
  controllers: [AuthenticationController],
  providers: [AuthenticationService, JwtStrategy],
  exports: [AuthenticationService, PassportModule, JwtModule],
})
export class AuthenticationModule {}
