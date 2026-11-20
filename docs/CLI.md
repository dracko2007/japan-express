# CLI do site (`je`)

Comandos de administração pelo terminal, autenticados por **chave de API**. Sem dependências (Node 18+).

## Criar a chave
Painel → **Configurações → Chaves de API** (só administrador nível 3). Escolha nome, validade (máx. 365 dias) e permissões:

| Permissão | Faz |
|---|---|
| `read` | consultar pedidos, clientes, produtos, cupons, estatísticas |
| `write` | status/rastreio de pedido, produto, criar/ativar cupom |
| `destructive` | apagar cliente (inclui o login), pedido e cupom — exige `--yes` |

A chave (`je_live_…`) aparece **uma vez**. O servidor guarda só o hash. Revogue no mesmo painel: vale na hora.

## Usar
```bash
export JE_API_KEY=je_live_...        # nunca em arquivo nem no git
npm run je -- health
npm run je -- orders list --status shipped --limit 10
npm run je -- orders set-status JE-123 shipped
npm run je -- products update ID --discount 10
npm run je -- customers delete a@b.com --yes
npm run je -- help
```
`JE_API_URL` muda o endereço (padrão `https://www.japanexpress-store.com`; só https).
Saída: 0 ok · 1 erro do servidor · 2 uso incorreto · 3 falta confirmação (`--yes`).

## Segurança
- Toda falha de chave responde o mesmo 401 (não revela se existiu/expirou/foi revogada).
- Limite de 120 comandos/min por IP e por chave.
- Cada comando é gravado em `api_key_audit` (`je audit`) **antes** de rodar; se o registro falhar, escritas são recusadas.
- Segredos nos argumentos (`password`, `token`, `key`…) são omitidos do registro.
- Uma chave não cria outras chaves; isso só o painel faz.
- `api_keys` e `api_key_audit` não têm regra no Firestore: só o servidor acessa.

## Fora da CLI (v1)
Confirmar pagamento, reembolsos, conteúdo da home, vlog, afiliados.
