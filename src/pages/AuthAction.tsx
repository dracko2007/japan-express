import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { CheckCircle2, KeyRound, Loader2, XCircle } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { auth } from '@/config/firebase';

/**
 * Destino dos links de conta (confirmar e-mail, redefinir senha, desfazer troca
 * de e-mail). Substitui a página padrão do Firebase em
 * `localstorage-98492.firebaseapp.com/__/auth/action`, para o cliente clicar num
 * link de japanexpress-store.com — e não num domínio técnico que parece phishing.
 *
 * Chega aqui por dois caminhos:
 *  - e-mails da loja (api/notify.js → `brandActionLink`): `?mode=&oobCode=`;
 *  - e-mails do próprio Firebase (fallback), quando o "Action URL" do console
 *    aponta para cá: os mesmos campos, mais `apiKey`, `continueUrl` e `lang`.
 */

type Status =
  | { kind: 'working' }
  | { kind: 'verified' }
  | { kind: 'reset-form'; email: string }
  | { kind: 'reset-done' }
  | { kind: 'email-restored'; email: string }
  | { kind: 'error'; message: string };

const MIN_PASSWORD = 6;

function errorMessage(error: unknown, mode: string): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  if (code === 'auth/expired-action-code') {
    return mode === 'resetPassword'
      ? 'Este link de redefinição expirou. Peça um novo na tela de login.'
      : 'Este link expirou. Entre com seu e-mail e senha para receber um novo.';
  }
  if (code === 'auth/invalid-action-code') {
    return mode === 'verifyEmail'
      ? 'Este link já foi usado ou não é mais válido. Se você já confirmou seu e-mail, é só entrar.'
      : 'Este link já foi usado ou não é mais válido. Peça um novo na tela de login.';
  }
  if (code === 'auth/user-disabled') return 'Esta conta está desativada. Fale com a gente pelo e-mail de suporte.';
  if (code === 'auth/user-not-found') return 'Não encontramos esta conta.';
  if (code === 'auth/weak-password') return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  return 'Não foi possível concluir agora. Tente de novo em instantes.';
}

const AuthAction: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mode = params.get('mode') ?? '';
  const oobCode = params.get('oobCode') ?? '';

  const [status, setStatus] = useState<Status>({ kind: 'working' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  // O código é de uso único: em StrictMode o efeito roda duas vezes e a
  // segunda chamada daria "link já usado" logo depois do sucesso.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!auth) {
      setStatus({ kind: 'error', message: 'Não foi possível conectar agora. Tente de novo em instantes.' });
      return;
    }
    if (!mode || !oobCode) {
      setStatus({ kind: 'error', message: 'Link incompleto. Abra o link direto do e-mail que enviamos.' });
      return;
    }

    const run = async () => {
      try {
        if (mode === 'verifyEmail' || mode === 'verifyAndChangeEmail') {
          await applyActionCode(auth!, oobCode);
          // Se a sessão estiver aberta nesta aba, atualiza `emailVerified` já.
          await auth!.currentUser?.reload().catch(() => undefined);
          setStatus({ kind: 'verified' });
        } else if (mode === 'resetPassword') {
          const email = await verifyPasswordResetCode(auth!, oobCode);
          setStatus({ kind: 'reset-form', email });
        } else if (mode === 'recoverEmail') {
          const info = await checkActionCode(auth!, oobCode);
          await applyActionCode(auth!, oobCode);
          setStatus({ kind: 'email-restored', email: info.data.email ?? '' });
        } else {
          setStatus({ kind: 'error', message: 'Link não reconhecido. Abra o link direto do e-mail que enviamos.' });
        }
      } catch (error) {
        setStatus({ kind: 'error', message: errorMessage(error, mode) });
      }
    };
    void run();
  }, [mode, oobCode]);

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (password.length < MIN_PASSWORD) {
      setFormError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setFormError('As duas senhas não são iguais.');
      return;
    }
    if (!auth) return;
    setSaving(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStatus({ kind: 'reset-done' });
    } catch (error) {
      const message = errorMessage(error, mode);
      const code = (error as { code?: string } | null)?.code ?? '';
      if (code === 'auth/weak-password') setFormError(message);
      else setStatus({ kind: 'error', message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-md px-4 py-12">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          {status.kind === 'working' && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
              <p className="text-muted-foreground">Validando seu link…</p>
            </div>
          )}

          {status.kind === 'verified' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" aria-hidden />
              <h1 className="text-xl font-semibold">E-mail confirmado!</h1>
              <p className="text-muted-foreground">Sua conta na Japan Express está ativa. Agora é só entrar.</p>
              <Button className="w-full" onClick={() => navigate('/login?verified=1')}>Entrar na minha conta</Button>
            </div>
          )}

          {status.kind === 'reset-form' && (
            <form onSubmit={handleReset} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col items-center gap-2 text-center">
                <KeyRound className="h-10 w-10 text-primary" aria-hidden />
                <h1 className="text-xl font-semibold">Criar nova senha</h1>
                <p className="text-sm text-muted-foreground">Para a conta {status.email}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFormError(''); }}
                  minLength={MIN_PASSWORD}
                  required
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm-password">Repita a nova senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setFormError(''); }}
                  minLength={MIN_PASSWORD}
                  required
                />
              </div>
              {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                Salvar nova senha
              </Button>
            </form>
          )}

          {status.kind === 'reset-done' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" aria-hidden />
              <h1 className="text-xl font-semibold">Senha alterada</h1>
              <p className="text-muted-foreground">Use a nova senha para entrar na sua conta.</p>
              <Button className="w-full" onClick={() => navigate('/login')}>Entrar na minha conta</Button>
            </div>
          )}

          {status.kind === 'email-restored' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" aria-hidden />
              <h1 className="text-xl font-semibold">E-mail restaurado</h1>
              <p className="text-muted-foreground">
                Sua conta voltou a usar {status.email || 'o e-mail anterior'}. Se não foi você quem pediu a troca,
                redefina sua senha na tela de login.
              </p>
              <Button className="w-full" onClick={() => navigate('/login')}>Ir para o login</Button>
            </div>
          )}

          {status.kind === 'error' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <XCircle className="h-12 w-12 text-destructive" aria-hidden />
              <h1 className="text-xl font-semibold">Não deu certo</h1>
              <p className="text-muted-foreground">{status.message}</p>
              <Button asChild className="w-full"><Link to="/login">Ir para o login</Link></Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AuthAction;
