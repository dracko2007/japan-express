import { adminAuth, adminDb } from './firebase-admin.js';
import { HttpError, normalizeEmail } from './http.js';
import { superAdminEmail } from './auth.js';

/**
 * Apaga o LOGIN (Firebase Auth) de um cliente. Só de cliente: conta de administrador, a própria conta de quem
 * pede e o e-mail do super administrador são recusados. E-mail sem login é sucesso (`deleted: false`).
 * Usado pelo painel (`api/admin?action=customer-delete`) e pela CLI: as mesmas recusas valem nos dois.
 */
export async function deleteCustomerLogin({ email: rawEmail, actingUid = '' }) {
  const email = normalizeEmail(rawEmail);
  if (!email) throw new HttpError(400, 'invalid_request');
  if (email === superAdminEmail().toLowerCase()) throw new HttpError(403, 'cannot_delete_super_admin');

  let record;
  try {
    record = await adminAuth().getUserByEmail(email);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return { email, deleted: false, uid: null };
    throw error;
  }
  if (actingUid && record.uid === actingUid) throw new HttpError(403, 'cannot_delete_self');
  if (record.uid.startsWith('admin_') || record.customClaims?.admin) throw new HttpError(403, 'cannot_delete_admin');

  await adminAuth().revokeRefreshTokens(record.uid).catch(() => undefined);
  await adminAuth().deleteUser(record.uid);
  return { email, deleted: true, uid: record.uid };
}

/**
 * Exclusão completa de um cliente: login + perfil (`users`) + lista de desejos + carrinho salvo. Os PEDIDOS ficam
 * (registro financeiro). O login sai primeiro: se falhar, nada foi apagado e dá para repetir.
 */
export async function deleteCustomerAccount({ email: rawEmail, actingUid = '' }) {
  const login = await deleteCustomerLogin({ email: rawEmail, actingUid });
  const db = adminDb();
  const profiles = await db.collection('users').where('email', '==', login.email).get();
  let profilesDeleted = 0;
  for (const document of profiles.docs) {
    await document.ref.delete();
    await db.collection('wishlists').doc(document.id).delete().catch(() => undefined);
    profilesDeleted += 1;
  }
  if (login.uid) await db.collection('carts').doc(login.uid).delete().catch(() => undefined);
  return { email: login.email, loginDeleted: login.deleted, profilesDeleted };
}
