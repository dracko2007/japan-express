import React from 'react';
import { LogOut } from 'lucide-react';
import { PROFILE_NAV, type ProfileSection } from '@/components/profile/profileSections';

interface ProfileShellProps {
  t: (key: string) => string;
  title: string;
  name: string;
  email: string;
  active: ProfileSection;
  onSelect: (section: ProfileSection) => void;
  onLogout: () => void;
  logoutLabel: string;
  /** Contadores ao lado do item (ex.: cupons ativos). Zero ou ausente não mostra nada. */
  badges?: Partial<Record<ProfileSection, number>>;
  children: React.ReactNode;
}

/**
 * Padrão "Settings": menu de seções fixo ao lado (desktop) e um seletor no topo (celular),
 * com o conteúdo de UMA seção por vez. O menu é o mesmo do painel admin, para a conta e o admin parecerem a mesma loja.
 */
const ProfileShell: React.FC<ProfileShellProps> = ({ t, title, name, email, active, onSelect, onLogout, logoutLabel, badges = {}, children }) => (
  <div className="container mx-auto px-4 py-8">
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <h1 className="font-display text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {name}{name && email ? ' · ' : ''}{email}
        </p>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
        {/* Celular: um seletor com as mesmas seções (sem barra lateral ao lado dos campos). */}
        <select
          aria-label={t('profile.nav.label')}
          value={active}
          onChange={(event) => onSelect(event.target.value as ProfileSection)}
          className="min-h-[44px] w-full rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground lg:hidden"
        >
          {PROFILE_NAV.map((group) => (
            <optgroup key={group.titleKey} label={t(group.titleKey)}>
              {group.items.map((item) => <option key={item.id} value={item.id}>{t(item.labelKey)}</option>)}
            </optgroup>
          ))}
        </select>

        {/* Desktop */}
        <nav aria-label={t('profile.nav.label')} className="hidden w-56 shrink-0 lg:sticky lg:top-24 lg:block">
          <div className="space-y-4 rounded-xl border border-border bg-card p-2">
            {PROFILE_NAV.map((group) => (
              <div key={group.titleKey}>
                <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">{t(group.titleKey)}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.id === active;
                    const badge = badges[item.id];
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelect(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="flex-1 text-left">{t(item.labelKey)}</span>
                        {badge ? (
                          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                            {badge > 99 ? '99+' : badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="border-t border-border pt-2">
              <button
                type="button"
                onClick={onLogout}
                className="flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                {logoutLabel}
              </button>
            </div>
          </div>
        </nav>

        <main className="min-w-0 flex-1 space-y-4">
          {children}
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-muted-foreground hover:text-destructive lg:hidden"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {logoutLabel}
          </button>
        </main>
      </div>
    </div>
  </div>
);

export default ProfileShell;
