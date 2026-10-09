import { BadRequestException } from '@nestjs/common';

export type Actor = { sub: string; role: 'Admin' | 'Controller' };

export function requiredText(
  value: unknown,
  label: string,
  max = 2000,
): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new BadRequestException(
      `${label} is required (maximum ${max} characters)`,
    );
  return value.trim();
}

export function optionalText(value: unknown, max = 2000): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > max)
    throw new BadRequestException(`Text must be at most ${max} characters`);
  return value.trim() || null;
}

export function decimal(
  value: unknown,
  label: string,
  decimals = 3,
  positive = false,
): string {
  const text =
    typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  if (
    !new RegExp(`^\\d{1,12}(?:\\.\\d{1,${decimals}})?$`).test(text) ||
    (positive && /^0(?:\.0+)?$/.test(text))
  )
    throw new BadRequestException(
      `${label} must be ${positive ? 'positive' : 'nonnegative'} with up to ${decimals} decimal places`,
    );
  return text;
}

export function currency(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value))
    throw new BadRequestException('Use a three-letter uppercase currency code');
  return value;
}

export function instant(
  value: unknown,
  label: string,
  futureMinutes = 5,
): Date {
  const date = typeof value === 'string' ? new Date(value) : new Date(NaN);
  if (
    !Number.isFinite(date.getTime()) ||
    date.getTime() > Date.now() + futureMinutes * 60000
  )
    throw new BadRequestException(
      `${label} must be a valid timestamp no more than ${futureMinutes} minutes ahead`,
    );
  return date;
}

export function pageParams(page: unknown, size: unknown) {
  const parsedPage = Number(page ?? 1);
  const parsedSize = Number(size ?? 25);
  if (
    !Number.isInteger(parsedPage) ||
    parsedPage < 1 ||
    !Number.isInteger(parsedSize) ||
    parsedSize < 1 ||
    parsedSize > 100
  )
    throw new BadRequestException(
      'Page must be positive and pageSize must be 1–100',
    );
  return {
    take: parsedSize,
    skip: (parsedPage - 1) * parsedSize,
    page: parsedPage,
    pageSize: parsedSize,
  };
}
