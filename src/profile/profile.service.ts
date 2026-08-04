import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AUTH_REPOSITORY } from '../auth/auth.constants';
import type { AuthRepository } from '../auth/auth.repository';
import type { AuthenticatedAdmin } from '../auth/auth.types';
import {
  DEFAULT_ADMIN_NOTIFICATION_PREFERENCES,
  type AdminNotificationPreferences,
} from '../database/schema';
import type {
  NotificationPreferencesDto,
  UpdateProfileDto,
} from './profile.dto';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
  ) {}

  async get(userId: string) {
    const user = await this.findUser(userId);
    return {
      user: this.toAdmin(user),
      notifications: this.preferences(user.notificationPreferences),
    };
  }

  async update(userId: string, input: UpdateProfileDto) {
    const parts = input.fullName.trim().split(/\s+/);
    const firstName = parts.shift() ?? '';
    const updated = await this.repository.updateProfile(userId, {
      firstName,
      lastName: parts.join(' '),
      phone: input.phone?.trim() || null,
      ...(input.avatarUrl !== undefined
        ? { avatarUrl: input.avatarUrl.trim() || null }
        : {}),
    });
    if (!updated) throw new NotFoundException('Admin user not found');
    return { user: this.toAdmin(updated) };
  }

  async updateNotifications(userId: string, input: NotificationPreferencesDto) {
    const updated = await this.repository.updateProfile(userId, {
      notificationPreferences: input,
    });
    if (!updated) throw new NotFoundException('Admin user not found');
    return {
      notifications: this.preferences(updated.notificationPreferences),
    };
  }

  private async findUser(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new NotFoundException('Admin user not found');
    return user;
  }

  private preferences(value: unknown): AdminNotificationPreferences {
    const candidate = value as Partial<AdminNotificationPreferences> | null;
    return {
      newOrder:
        candidate?.newOrder ?? DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.newOrder,
      toConfirm:
        candidate?.toConfirm ??
        DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.toConfirm,
      lowStock:
        candidate?.lowStock ?? DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.lowStock,
      reviews:
        candidate?.reviews ?? DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.reviews,
      emailDigest:
        candidate?.emailDigest ??
        DEFAULT_ADMIN_NOTIFICATION_PREFERENCES.emailDigest,
    };
  }

  private toAdmin(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatarUrl: string | null;
    role: AuthenticatedAdmin['role'];
    status: AuthenticatedAdmin['status'];
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AuthenticatedAdmin {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      phone: user.phone ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt ?? undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
