import React from 'react';
import { AdminTabItem, AdminTab } from '@/components/admin/adminTabs';

interface AdminSidebarProps {
  tabGroups: { title: string; items: AdminTabItem[]; }[];
  activeTab: "orders" | "coupons" | "dashboard" | "customers" | "products" | "calculator" | "migration" | "promotion" | "negotiations" | "marketing" | "employees" | "coupon-usage" | "fraud" | "thermal-printer" | "whatsapp" | "review-moderation" | "margin-audit" | "visitors" | "finance-detail" | "sandbox" | "affiliates" | "requests" | "b2b" | "videos" | "home" | "vlog" | "sorteio" | "admins";
  setActiveTab: (tab: AdminTab) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  tabGroups,
  activeTab,
  setActiveTab,
}) => {
  return (
    <>
    {/* MENU LATERAL (desktop) */}
    <aside className="hidden lg:block lg:w-56 shrink-0 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:rounded-2xl">
      <div className="bg-card rounded-2xl border border-border p-3 space-y-4">
        {tabGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge ? (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
    </>
  );
};

export default AdminSidebar;
