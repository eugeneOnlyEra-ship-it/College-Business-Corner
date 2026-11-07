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

export type MaybeAuthedRequest = Request & { user?: Session };

/**
 * Signed-in users are recognised, anonymous callers still pass. A token that is present but invalid or
 * expired is rejected (so a stale session never silently falls back to the demo buyer).
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<MaybeAuthedRequest>();
    const header = req.headers.authorization ?? '';
    if (header.startsWith('Bearer ')) req.user = this.auth.verify(header.slice(7));
    return true;
  }
}
