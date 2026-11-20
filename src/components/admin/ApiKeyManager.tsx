import React, { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authenticatedFetch } from '@/services/authenticatedFetch';
import { useUser } from '@/context/UserContext';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ConfirmDialog';

type Scope = 'read' | 'write' | 'destructive';

interface ApiKeyRow {
  id: string;
  name: string;
  preview: string;
  scopes: Scope[];
  createdAt: number;
  createdBy: string;
  expiresAt: number;
  revokedAt: number | null;
  lastUsedAt: number;
}

interface CreatedKey { key: string; name: string; expiresAt: number }

const SCOPE_LABEL: Record<Scope, string> = {
  read: 'Consultar (somente leitura)',
  write: 'Alterar (status, rastreio, produtos, cupons)',
  destructive: 'Apagar (clientes, pedidos, cupons)',
};

const fmt = (ms: number) => (ms ? new Date(ms).toLocaleString('pt-BR') : 'nunca');

/** Chaves de API da CLI. A chave aparece UMA vez, ao criar: depois só o trecho inicial. */
const ApiKeyManager: React.FC = () => {
  const { permissions } = useUser();
  const { toast } = useToast();
  const confirm = useConfirm();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [days, setDays] = useState(90);
  const [scopes, setScopes] = useState<Scope[]>(['read', 'write', 'destructive']);
  const [created, setCreated] = useState<CreatedKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/admin?action=api-keys');
      const data = (await res.json()) as { keys?: ApiKeyRow[] };
      setKeys(res.ok ? data.keys ?? [] : []);
    } catch {
      setKeys([]);
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!permissions.canManageAdmins) {
    return (
      <div className="text-center py-16 bg-card rounded-2xl border border-border">
        <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Apenas administradores nível 3 gerenciam chaves de API.</p>
      </div>
    );
  }

  const toggleScope = (scope: Scope) =>
    setScopes((current) => (current.includes(scope) ? current.filter((s) => s !== scope) : [...current, scope]));

  const create = async () => {
    if (!name.trim()) { toast({ title: 'Dê um nome à chave (ex.: Claude)', variant: 'destructive' }); return; }
    if (!scopes.length) { toast({ title: 'Escolha ao menos uma permissão', variant: 'destructive' }); return; }
    const ok = await confirm({
      title: `Criar a chave "${name.trim()}"?`,
      details: [
        `Permissões: ${scopes.map((s) => SCOPE_LABEL[s]).join(' · ')}`,
        `Vale por ${days} dias e pode ser revogada a qualquer momento`,
        'A chave aparece uma única vez. Quem a tiver age como administrador',
      ],
      confirmLabel: 'Criar chave',
    });
    if (!ok) return;
    try {
      const res = await authenticatedFetch('/api/admin?action=api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), scopes, days }),
      });
      const data = (await res.json()) as CreatedKey & { error?: string };
      if (!res.ok) throw new Error(data.error || String(res.status));
      setCreated({ key: data.key, name: data.name, expiresAt: data.expiresAt });
      setName('');
      void load();
    } catch (error) {
      toast({ title: 'Não foi possível criar a chave', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    }
  };

  const revoke = async (row: ApiKeyRow) => {
    const ok = await confirm({
      title: `Revogar a chave "${row.name}"?`,
      details: ['Ela deixa de funcionar imediatamente', 'Não dá para reativar: crie outra se precisar'],
      confirmLabel: 'Revogar',
      destructive: true,
    });
    if (!ok) return;
    const res = await authenticatedFetch('/api/admin?action=api-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id }),
    });
    if (!res.ok) { toast({ title: 'Não foi possível revogar', variant: 'destructive' }); return; }
    toast({ title: 'Chave revogada' });
    void load();
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      toast({ title: 'Chave copiada' });
    } catch {
      toast({ title: 'Copie manualmente: selecione o texto da chave', variant: 'destructive' });
    }
  };

  const now = Date.now();
  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><KeyRound className="w-5 h-5" /> Nova chave de API</h2>
        <p className="text-sm text-muted-foreground">
          Usada pela CLI (<code>scripts/cli/je.mjs</code>). Cada comando fica registrado. A chave nunca é guardada em texto: só o resumo dela.
        </p>
        <label className="block text-sm">
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex.: Claude"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2" />
        </label>
        <label className="block text-sm">
          Validade (dias, máximo 365)
          <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))}
            className="mt-1 w-32 rounded-lg border border-border bg-background px-3 py-2" />
        </label>
        <fieldset className="space-y-1 text-sm">
          <legend className="mb-1">Permissões</legend>
          {(Object.keys(SCOPE_LABEL) as Scope[]).map((scope) => (
            <label key={scope} className="flex items-center gap-2">
              <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
              {SCOPE_LABEL[scope]}
            </label>
          ))}
        </fieldset>
        <Button onClick={create}>Criar chave</Button>
      </div>

      {created && (
        <div role="alert" className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-3">
          <p className="font-semibold text-amber-900">Chave "{created.name}" criada. Copie agora: não aparece de novo.</p>
          <code className="block break-all rounded-lg bg-white border border-amber-200 p-3 text-sm select-all">{created.key}</code>
          <p className="text-sm text-amber-900">Vale até {fmt(created.expiresAt)}.</p>
          <div className="flex gap-2">
            <Button onClick={copy} variant="outline"><Copy className="w-4 h-4 mr-2" /> Copiar</Button>
            <Button onClick={() => setCreated(null)} variant="ghost">Já guardei</Button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-5">
        <h2 className="font-semibold mb-3">Chaves</h2>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : !keys.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma chave criada ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {keys.map((row) => {
              const status = row.revokedAt ? 'Revogada' : row.expiresAt <= now ? 'Expirada' : 'Ativa';
              return (
                <li key={row.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="space-y-0.5">
                    <p className="font-medium">{row.name} <span className="text-muted-foreground font-normal">· {status}</span></p>
                    <p className="text-muted-foreground"><code>{row.preview}</code> · {row.scopes.join(', ')}</p>
                    <p className="text-muted-foreground">Criada {fmt(row.createdAt)} · vale até {fmt(row.expiresAt)} · último uso {fmt(row.lastUsedAt)}</p>
                  </div>
                  {status === 'Ativa' && <Button variant="outline" onClick={() => revoke(row)}>Revogar</Button>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ApiKeyManager;
