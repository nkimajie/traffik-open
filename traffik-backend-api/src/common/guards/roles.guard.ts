import { CanActivate, ExecutionContext, Type, mixin } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { UserRole } from "../../modules/users/enums/user-role.enum";

const RoleGuard = (allowedRoles: UserRole[]): Type<CanActivate> => {
  class RoleGuardMixin extends JwtAuthGuard {
    async canActivate(context: ExecutionContext) {
      await super.canActivate(context);

      const request = context.switchToHttp().getRequest();
      const user = request.user;

      allowedRoles = Array.isArray(allowedRoles)
        ? allowedRoles
        : [allowedRoles];

      return allowedRoles
        .map((allowedRole) => allowedRole.toUpperCase())
        .includes(user?.role.toUpperCase());
    }
  }

  return mixin(RoleGuardMixin);
};

export default RoleGuard;
