import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type Session } from './auth.service.js';

export type AuthedRequest = Request & { user: Session };

/** Any signed-in user. Reads `Authorization: Bearer <token>`. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(protected readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    req.user = this.auth.verify(header.startsWith('Bearer ') ? header.slice(7) : undefined);
    return true;
  }
}

/** Signed in AND acting as a business owner. */
@Injectable()
export class OwnerGuard extends AuthGuard {
  override canActivate(context: ExecutionContext): boolean {
    super.canActivate(context);
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.user.role !== 'OWNER') {
      throw new ForbiddenException('Sign in as a business owner to do this.');
    }
    return true;
  }
}
