import React from 'react';
import { User, Edit2, Mail, Phone, Megaphone, Cloud, Bell, BellOff, Calendar, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { pushService } from '@/services/pushService';
import { prefectures } from '@/data/prefectures';
import { Prefecture } from '@/types';
import { UserProfile, Coupon } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';

interface ProfilePersonalInfoProps {
  t: (key: string) => string;
  isEditing: boolean;
  setIsEditing: (value: React.SetStateAction<boolean>) => void;
  handleSaveProfile: () => void;
  editedUser: { id?: string; name?: string; email?: string; phone?: string; password?: string; birthdate?: string; adminRole?: number; personType?: "PF" | "PJ"; cpf?: string; cnpj?: string; razaoSocial?: string; document?: string; gender?: "masculino" | "feminino" | "outro"; whatsappMarketing?: boolean; pushEnabled?: boolean; points?: number; birthdayBonusYear?: number; address?: { postalCode: string; prefecture: string; city: string; address: string; building?: string; }; createdAt?: string; coupons?: Coupon[]; };
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setEditedUser: (value: React.SetStateAction<Partial<UserProfile>>) => void;
  isBrazilAddress: boolean;
  isJapanAddress: boolean;
  addressCountry: string;
  isEuropeAddress: boolean;
  handlePostalCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  addressList: Prefecture[];
  user: UserProfile;
  emailNews: boolean;
  toggleEmailNews: () => Promise<void>;
  emailNewsBusy: boolean;
  updateProfile: (userData: Partial<UserProfile>) => void;
  toast: ReturnType<typeof useToast>["toast"];
  pushSubscribed: boolean;
  togglePush: () => Promise<void>;
  pushBusy: boolean;
}

const ProfilePersonalInfo: React.FC<ProfilePersonalInfoProps> = ({
  t,
  isEditing,
  setIsEditing,
  handleSaveProfile,
  editedUser,
  handleInputChange,
  setEditedUser,
  isBrazilAddress,
  isJapanAddress,
  addressCountry,
  isEuropeAddress,
  handlePostalCodeChange,
  addressList,
  user,
  emailNews,
  toggleEmailNews,
  emailNewsBusy,
  updateProfile,
  toast,
  pushSubscribed,
  togglePush,
  pushBusy,
}) => {
  return (
    <>
    {/* Personal Information */}
    <div className="bg-card rounded-2xl border border-border p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-foreground">
            {t('profile.info.title')}
          </h2>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                {t('profile.cancel')}
              </Button>
              <Button onClick={handleSaveProfile} className="btn-primary">
                {t('profile.save')}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              {t('profile.edit')}
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">{t('profile.field.fullname')}</Label>
            <Input
              id="name"
              name="name"
              value={editedUser.name || ''}
              onChange={handleInputChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={editedUser.email || ''}
              onChange={handleInputChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t('profile.field.phone')}</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={editedUser.phone || ''}
              onChange={handleInputChange}
            />
          </div>
          <div className="flex items-center gap-2 pt-2 md:col-span-2">
            <input
              id="whatsappMarketing"
              name="whatsappMarketing"
              type="checkbox"
              checked={!!editedUser.whatsappMarketing}
              onChange={(e) => setEditedUser(prev => ({ ...prev, whatsappMarketing: e.target.checked }))}
              className="w-4 h-4 rounded border-input text-primary focus:ring-primary cursor-pointer"
            />
            <Label htmlFor="whatsappMarketing" className="text-sm font-semibold cursor-pointer select-none leading-none">
              {t('profile.field.whatsapp')}
            </Label>
          </div>
          {/* Documento fiscal — CPF/CNPJ para Brasil, documento genérico para outros países */}
          {isBrazilAddress && (
            <>
              <div className="space-y-2 md:col-span-2">
                <Label>{t('profile.field.personType')}</Label>
                <div className="flex gap-3">
                  {(['PF', 'PJ'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="personType"
                        value={type}
                        checked={(editedUser.personType ?? 'PF') === type}
                        onChange={() => setEditedUser(prev => ({ ...prev, personType: type }))}
                        className="w-4 h-4 text-primary"
                      />
                      <span className="text-sm font-medium">
                        {type === 'PF' ? t('profile.field.personType.pf') : t('profile.field.personType.pj')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {(editedUser.personType ?? 'PF') === 'PF' ? (
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="cpf">{t('profile.field.cpf')}</Label>
                  <Input
                    id="cpf"
                    name="cpf"
                    placeholder="000.000.000-00"
                    value={editedUser.cpf || ''}
                    onChange={handleInputChange}
                    maxLength={14}
                  />
                  <p className="text-xs text-muted-foreground">⚠️ {t('profile.field.cpf.hint')}</p>
                </div>
              ) : (
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="cnpj">{t('profile.field.cnpj')}</Label>
                  <Input
                    id="cnpj"
                    name="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={editedUser.cnpj || ''}
                    onChange={handleInputChange}
                    maxLength={18}
                  />
                  <p className="text-xs text-muted-foreground">⚠️ {t('profile.field.cnpj.hint')}</p>
                </div>
              )}
            </>
          )}
          {!isBrazilAddress && !isJapanAddress && (
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="document">{t('profile.field.document')}</Label>
              <Input
                id="document"
                name="document"
                placeholder={t('profile.field.document.placeholder')}
                value={editedUser.document || ''}
                onChange={handleInputChange}
              />
              <p className="text-xs text-muted-foreground">⚠️ {t('profile.field.document.hint')}</p>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="birthdate">{t('profile.field.birthdate')}</Label>
            <Input
              id="birthdate"
              name="birthdate"
              type="date"
              value={editedUser.birthdate || ''}
              onChange={handleInputChange}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="addressCountry">{t('profile.field.country')}</Label>
            <select
              id="addressCountry"
              value={addressCountry}
              onChange={(e) => setEditedUser(prev => ({
                ...prev,
                // Troca o país e limpa estado/cidade pra evitar mistura de listas.
                address: { ...prev.address, country: e.target.value, prefecture: '', city: '' },
              }))}
              className="w-full p-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition"
            >
              {['Brasil', 'Japão', 'Portugal', 'França', 'Itália', 'Espanha', 'Alemanha'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="postalCode">{isJapanAddress ? t('profile.field.postal.jp') : isEuropeAddress ? t('profile.field.postal.eu') : t('profile.field.postal')}</Label>
            <Input
              id="postalCode"
              name="address.postalCode"
              type="text"
              placeholder={isJapanAddress ? '100-0001' : isEuropeAddress ? '0000-000' : '01001-000'}
              value={editedUser.address?.postalCode || ''}
              onChange={handlePostalCodeChange}
              maxLength={isEuropeAddress ? 12 : isJapanAddress ? 8 : 9}
            />
            <p className="text-xs text-muted-foreground">
              {isEuropeAddress ? t('profile.field.postalHint.eu') : isJapanAddress ? t('profile.field.postalHint.jp') : t('profile.field.postalHint.br')}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prefecture">{isJapanAddress ? t('profile.field.state.jp') : isEuropeAddress ? t('profile.field.state.eu') : t('profile.field.state')}</Label>
            {isEuropeAddress ? (
              <Input
                id="prefecture"
                name="address.prefecture"
                value={editedUser.address?.prefecture || ''}
                onChange={handleInputChange}
                placeholder="Ex.: Lisboa, Île-de-France..."
              />
            ) : (
              <select
                id="prefecture"
                name="address.prefecture"
                value={editedUser.address?.prefecture || ''}
                onChange={(e) => {
                  setEditedUser(prev => ({
                    ...prev,
                    address: { ...prev.address, prefecture: e.target.value }
                  }));
                }}
                className="w-full p-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition"
              >
                <option value="">{isJapanAddress ? t('profile.field.state.placeholder.jp') : t('profile.field.state.placeholder.br')}</option>
                {addressList.map((pref) => (
                  <option key={pref.name} value={pref.name}>
                    {pref.nameJa} ({pref.name})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">{isJapanAddress ? t('profile.field.city.jp') : t('profile.field.city')}</Label>
            <Input
              id="city"
              name="address.city"
              value={editedUser.address?.city || ''}
              onChange={handleInputChange}
              readOnly={isBrazilAddress || isJapanAddress}
              className={isBrazilAddress || isJapanAddress ? 'bg-secondary/50' : ''}
              placeholder={isEuropeAddress ? 'Digite a cidade' : undefined}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">{t('profile.field.address')}</Label>
            <Input
              id="address"
              name="address.address"
              value={editedUser.address?.address || ''}
              onChange={handleInputChange}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="building">{t('profile.field.building')}</Label>
            <Input
              id="building"
              name="address.building"
              value={editedUser.address?.building || ''}
              onChange={handleInputChange}
            />
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-2">
              <User className="w-4 h-4" />
              {t('profile.label.name')}
            </Label>
            <p className="font-medium text-foreground">{user.name}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </Label>
            <p className="font-medium text-foreground">{user.email}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-2">
              <Phone className="w-4 h-4" />
              {t('profile.field.phone')}
            </Label>
            <p className="font-medium text-foreground">{user.phone}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-2">
              <Megaphone className="w-4 h-4" />
              {t('profile.label.emailNews')}
            </Label>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="font-medium text-foreground">
                {emailNews ? t('profile.marketing.on') : t('profile.marketing.off')}
              </p>
              <button
                onClick={toggleEmailNews}
                disabled={emailNewsBusy}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60 ${
                  emailNews
                    ? 'border-red-300 text-red-600 hover:bg-red-50'
                    : 'border-green-300 text-green-600 hover:bg-green-50'
                }`}
              >
                {emailNewsBusy ? 'Aguarde…' : emailNews ? t('profile.marketing.disable') : t('profile.marketing.enable')}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-2">
              <Cloud className="w-4 h-4" />
              {t('profile.label.marketing')}
            </Label>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="font-medium text-foreground">
                {user.whatsappMarketing ? t('profile.marketing.on') : t('profile.marketing.off')}
              </p>
              <button
                onClick={() => {
                  const novo = !user.whatsappMarketing;
                  updateProfile({ whatsappMarketing: novo });
                  toast({
                    title: novo ? '✅ Inscrição ativada' : 'Inscrição cancelada',
                    description: novo
                      ? 'Você vai receber novidades e promoções no WhatsApp.'
                      : 'Você não vai mais receber novidades no WhatsApp.',
                  });
                }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                  user.whatsappMarketing
                    ? 'border-red-300 text-red-600 hover:bg-red-50'
                    : 'border-green-300 text-green-600 hover:bg-green-50'
                }`}
              >
                {user.whatsappMarketing ? t('profile.marketing.disable') : t('profile.marketing.enable')}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notificações Push
            </Label>
            {pushService.isSupported() ? (
              <div className="flex items-center gap-3 flex-wrap">
                <p className="font-medium text-foreground">
                  {pushSubscribed ? 'Ativadas neste dispositivo' : 'Desativadas'}
                </p>
                <button
                  onClick={togglePush}
                  disabled={pushBusy}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60 ${
                    pushSubscribed
                      ? 'border-red-300 text-red-600 hover:bg-red-50'
                      : 'border-green-300 text-green-600 hover:bg-green-50'
                  }`}
                >
                  {pushBusy ? 'Aguarde…' : pushSubscribed ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <BellOff className="w-3.5 h-3.5" /> Não suportado neste navegador
              </p>
            )}
          </div>
          {user.birthdate && (
            <div className="space-y-2">
              <Label className="text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {t('profile.field.birthdate')}
              </Label>
              <p className="font-medium text-foreground">
                {new Date(user.birthdate).toLocaleDateString('pt-BR')}
              </p>
            </div>
          )}
          <div className="space-y-2 md:col-span-2">
            {/* Documento fiscal no modo visualização */}
            {isBrazilAddress && (user.cpf || user.cnpj) && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">
                  {user.personType === 'PJ' ? t('profile.field.cnpj') : t('profile.field.cpf')}
                </Label>
                <p className="font-medium text-foreground font-mono">
                  {user.personType === 'PJ' ? user.cnpj : user.cpf}
                </p>
              </div>
            )}
            {!isBrazilAddress && !isJapanAddress && user.document && (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">{t('profile.field.document')}</Label>
                <p className="font-medium text-foreground font-mono">{user.document}</p>
              </div>
            )}
            <Label className="text-muted-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {t('profile.field.address')}
            </Label>
            <p className="font-medium text-foreground">
              〒{user.address.postalCode}<br />
              {(() => {
                const pref = prefectures.find(p => p.name === user.address.prefecture);
                return pref ? `${pref.nameJa} (${pref.name})` : user.address.prefecture;
              })()} {user.address.city}<br />
              {user.address.address}
              {user.address.building && <><br />{user.address.building}</>}
            </p>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default ProfilePersonalInfo;
