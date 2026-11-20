import React from 'react';
import { AdminTab, AdminTabItem } from '@/components/admin/adminTabs';

interface AdminMobileNavProps {
  activeTab: "orders" | "coupons" | "dashboard" | "customers" | "products" | "calculator" | "migration" | "promotion" | "negotiations" | "marketing" | "employees" | "coupon-usage" | "fraud" | "thermal-printer" | "whatsapp" | "review-moderation" | "margin-audit" | "visitors" | "finance-detail" | "sandbox" | "affiliates" | "requests" | "b2b" | "videos" | "home" | "vlog" | "sorteio" | "admins" | "api-keys";
  setActiveTab: (tab: AdminTab) => void;
  tabGroups: { title: string; items: AdminTabItem[]; }[];
  activeLabel: string;
}

const AdminMobileNav: React.FC<AdminMobileNavProps> = ({
  activeTab,
  setActiveTab,
  tabGroups,
  activeLabel,
}) => {
  return (
    <>
    {/* Navegação mobile: seletor agrupado igual ao menu lateral
        (30 abas numa linha rolável não cabiam no celular). */}
    <div className="lg:hidden mb-6">
      <label htmlFor="admin-section" className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        Seção do painel
      </label>
      <select
        id="admin-section"
        value={activeTab}
        onChange={(e) => setActiveTab(e.target.value as AdminTab)}
        className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {tabGroups.map((group) => (
          <optgroup key={group.title} label={group.title}>
            {group.items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}{item.badge ? ` (${item.badge > 99 ? '99+' : item.badge})` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
    <h2 className="hidden lg:block font-display text-2xl font-bold text-foreground mb-5">{activeLabel}</h2>
    </>
  );
};

export default AdminMobileNav;
