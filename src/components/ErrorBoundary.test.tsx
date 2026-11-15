import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ recover: vi.fn() }));
vi.mock('@/utils/recoverFromChunkError', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utils/recoverFromChunkError')>();
  return { ...original, recoverFromChunkError: mocks.recover };
});

const { default: ErrorBoundary } = await import('./ErrorBoundary');

const ChunkBomb = () => { throw new TypeError('Failed to fetch dynamically imported module: https://www.japanexpress-store.com/assets/Affiliate-abc12345.js'); };
const OtherBomb = () => { throw new Error('boom'); };

beforeEach(() => {
  mocks.recover.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('tela de erro de carregamento (nova versão)', () => {
  it('tenta recuperar sozinho e esconde o erro técnico dentro de "Detalhes técnicos"', async () => {
    mocks.recover.mockResolvedValue(true);
    render(<ErrorBoundary><ChunkBomb /></ErrorBoundary>);
    expect(screen.getByText('Nova versão disponível')).toBeInTheDocument();
    expect(screen.getByText(/recarregada automaticamente/)).toBeInTheDocument();
    expect(screen.getByText('Detalhes técnicos').closest('details')).not.toHaveAttribute('open');
    expect(mocks.recover).toHaveBeenCalledWith();
  });

  it('se a recarga automática já foi tentada, pede o toque do cliente e o botão força a atualização', async () => {
    mocks.recover.mockResolvedValue(false);
    render(<ErrorBoundary><ChunkBomb /></ErrorBoundary>);
    expect(await screen.findByText(/esta aba ainda está com a versão antiga/)).toBeInTheDocument();
    mocks.recover.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Atualizar agora/ }));
    await waitFor(() => expect(mocks.recover).toHaveBeenCalledWith({ force: true }));
  });

  it('outros erros seguem como antes: "Tentar novamente" e o texto do erro à vista', () => {
    render(<ErrorBoundary><OtherBomb /></ErrorBoundary>);
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar novamente/ })).toBeInTheDocument();
    expect(screen.getByText(/Error: boom/)).toBeInTheDocument();
    expect(mocks.recover).not.toHaveBeenCalled();
  });
});
