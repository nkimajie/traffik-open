import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { UsersRepository } from "../../modules/users/repositories/users.repository";
import { UserRole } from "../../modules/users/enums/user-role.enum";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersRepository: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET"),
    });
  }

  async validate(payload: any) {
    // For users, validate tokenVersion to check if user has logged out.
    // Tokens carry the lowercase enum value, so compare against UserRole rather
    // than a literal.
    if (payload.role === UserRole.USER) {
      const user = await this.usersRepository.query({ _id: payload.sub });
      
      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      // Check if token version matches user's current token version
      // If user has tokenVersion, validate it matches the token
      if (user.tokenVersion !== undefined) {
        // If token doesn't have tokenVersion, it's an old token - invalidate it
        if (payload.tokenVersion === undefined) {
          throw new UnauthorizedException("Token expired. Please login again");
        }

        // Compare versions - if they don't match, token is invalid (user logged out)
        if (payload.tokenVersion !== user.tokenVersion) {
          throw new UnauthorizedException("Token expired. Please login again");
        }
      }
    }

    return {
      _id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
