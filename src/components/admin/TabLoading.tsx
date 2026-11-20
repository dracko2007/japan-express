import React from 'react';

/** Enquanto o código da aba baixa (só na primeira abertura dela). */
const TabLoading: React.FC = () => (
  <div className="flex items-center justify-center py-16 text-sm text-muted-foreground" role="status">
    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
    Carregando…
  </div>
);

export default TabLoading;
