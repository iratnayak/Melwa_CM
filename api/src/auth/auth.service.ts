import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SafeUser } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends TokenPair {
  user: SafeUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(identifier: string, password: string): Promise<AuthResponse> {
    const user = await this.usersService.validateCredentials(identifier, password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.usersService.setRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.usersService.toSafeUser(user),
      ...tokens,
    };
  }

  async refresh(body: RefreshTokenDto): Promise<AuthResponse> {
    const payload = await this.verifyRefreshToken(body.refreshToken);
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found');
    }

    const isStoredTokenValid = await this.usersService.isRefreshTokenValid(
      user.id,
      body.refreshToken,
    );

    if (!isStoredTokenValid) {
      throw new UnauthorizedException('Refresh token revoked');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.usersService.setRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.usersService.toSafeUser(user),
      ...tokens,
    };
  }

  async logout(userId: number): Promise<{ success: boolean }> {
    await this.usersService.clearRefreshToken(userId);
    return { success: true };
  }

  private async issueTokens(
    userId: number,
    email: string,
    role: string,
  ): Promise<TokenPair> {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(token: string): Promise<{
    sub: number;
    email: string;
    role: string;
  }> {
    try {
      return await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
