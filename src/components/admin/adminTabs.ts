import type React from 'react';

export const ADMIN_TABS = [
  'orders', 'coupons', 'dashboard', 'customers', 'products',
  'calculator', 'migration', 'promotion', 'negotiations', 'marketing', 'employees', 'coupon-usage', 'fraud',
  'thermal-printer', 'whatsapp', 'review-moderation', 'margin-audit', 'visitors', 'finance-detail', 'sandbox',
  'affiliates', 'requests', 'b2b', 'videos', 'home', 'vlog', 'sorteio', 'admins', 'api-keys',
] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];
export const isAdminTab = (value: string | null): value is AdminTab => ADMIN_TABS.includes(value as AdminTab);

export interface AdminTabItem {
  id: AdminTab;
  label: string;
  icon: React.FC<{ className?: string }>;
  badge?: number;
}
