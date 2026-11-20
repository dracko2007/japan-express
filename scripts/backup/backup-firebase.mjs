#!/usr/bin/env node
// Backup do Firebase que o Firestore não cobre sozinho: fotos do Storage e contas de login (Auth).
// O Firestore (pedidos, clientes, produtos, cupons) já tem backup diário e recuperação de 7 dias, configurados no projeto.
//
// Uso (da raiz do projeto):
//   node scripts/backup/backup-firebase.mjs ajuda
//   node scripts/backup/backup-firebase.mjs preparar --sim      cria o bucket de backup (uma vez só)
//   node scripts/backup/backup-firebase.mjs storage             copia as fotos para o bucket de backup
//   node scripts/backup/backup-firebase.mjs auth                exporta as contas de login para backups/auth/
//   node scripts/backup/backup-firebase.mjs tudo                storage + auth
// Qualquer comando aceita --simular: só mostra o que faria, sem executar nada.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PROJETO = process.env.FIREBASE_PROJECT || 'localstorage-98492';
const BUCKET_ORIGEM = process.env.STORAGE_BUCKET || `${PROJETO}.firebasestorage.app`;
const BUCKET_BACKUP = process.env.BACKUP_BUCKET || `${PROJETO}-backup`;
// Mesma região do banco. Para guardar longe do Japão, defina BACKUP_LOCATION (ex.: us-central1).
const REGIAO = process.env.BACKUP_LOCATION || 'asia-northeast1';

const args = process.argv.slice(2);
const comando = args.find((a) => !a.startsWith('--')) || 'ajuda';
const simular = args.includes('--simular');
const confirmado = args.includes('--sim');

function rodar(titulo, programa, params) {
  const linha = [programa, ...params].join(' ');
  console.log(`\n▶ ${titulo}\n  $ ${linha}`);
  if (simular) return 0;
  // shell: true para achar gsutil.cmd / npx.cmd no Windows.
  const r = spawnSync(programa, params, { stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\n✖ Falhou (código ${r.status}). Confira se você está logado: veja "ajuda".`);
    process.exit(r.status || 1);
  }
  return 0;
}

function dataDeHoje() {
  return new Date().toISOString().slice(0, 10);
}

function ajuda() {
  console.log(`
Backup do Firebase (projeto ${PROJETO})

Antes da primeira vez, uma só vez, no PC:
  1. Instale o Google Cloud SDK (traz o gsutil): https://cloud.google.com/sdk/docs/install
  2. gcloud auth login            (com a conta dona do projeto)
  3. gcloud config set project ${PROJETO}
  4. npx firebase-tools login     (para o export das contas)
  5. node scripts/backup/backup-firebase.mjs preparar --sim

Rotina:
  storage   semanal    copia as fotos de gs://${BUCKET_ORIGEM} para gs://${BUCKET_BACKUP}
  auth      mensal     grava backups/auth/auth-AAAA-MM-DD.json

Garantias:
  • O storage NÃO apaga nada no backup: foto removida na loja continua guardada na cópia.
  • O bucket de backup liga o versionamento: foto trocada guarda a versão antiga.
  • backups/ está no .gitignore. O export das contas traz hashes de senha: guarde-o fora do GitHub,
    de preferência em outra conta Google ou em um HD externo.

Variáveis opcionais: FIREBASE_PROJECT, STORAGE_BUCKET, BACKUP_BUCKET, BACKUP_LOCATION.
`);
}

function preparar() {
  console.log(`Vai criar o bucket gs://${BUCKET_BACKUP} em ${REGIAO} (acesso uniforme, versionamento ligado).`);
  console.log('Isso gera cobrança de armazenamento (centavos para o tamanho da loja).');
  if (!confirmado && !simular) {
    console.log('\nPara confirmar, rode de novo com --sim (ou use --simular para só ver os comandos).');
    process.exit(0);
  }
  rodar('Criar o bucket de backup', 'gsutil', ['mb', '-p', PROJETO, '-l', REGIAO, '-b', 'on', `gs://${BUCKET_BACKUP}`]);
  rodar('Ligar o versionamento', 'gsutil', ['versioning', 'set', 'on', `gs://${BUCKET_BACKUP}`]);
}

function storage() {
  // Sem -d: o rsync nunca apaga no destino, então o backup não espelha exclusões.
  rodar(`Copiar as fotos do Storage para gs://${BUCKET_BACKUP}`, 'gsutil', ['-m', 'rsync', '-r', `gs://${BUCKET_ORIGEM}`, `gs://${BUCKET_BACKUP}`]);
}

function auth() {
  const pasta = path.join('backups', 'auth');
  const arquivo = path.join(pasta, `auth-${dataDeHoje()}.json`);
  if (!simular) fs.mkdirSync(pasta, { recursive: true });
  rodar('Exportar as contas de login', 'npx', ['firebase-tools', 'auth:export', `"${arquivo}"`, '--format=json', '--project', PROJETO]);
  if (!simular) console.log(`\nContas gravadas em ${arquivo}\n⚠ O arquivo contém hashes de senha: não envie ao GitHub nem por e-mail.`);
}

switch (comando) {
  case 'preparar': preparar(); break;
  case 'storage': storage(); break;
  case 'auth': auth(); break;
  case 'tudo': storage(); auth(); break;
  default: ajuda();
}
if (comando !== 'ajuda' && !simular) console.log('\n✔ Pronto.');
