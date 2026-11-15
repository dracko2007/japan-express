import { requireUser } from './_lib/auth.js';
import { activeByDate, assertCouponEligibility } from './_lib/coupon-eligibility.js';
import { adminDb } from './_lib/firebase-admin.js';
import {
  assertExactKeys,
  getHeader,
  handleCors,
  HttpError,
  parseJsonObject,
  requiredText,
  sendError,
} from './_lib/http.js';
import { enforceRateLimit } from './_lib/rate-limit.js';
import { openRecoveryCoupon } from './_lib/recovery-coupon.js';

// A resposta diz se o código existe (404 × 409 × 200). Sem limite, dava para
// testar códigos em série até achar um cupom. O cliente só chama ao clicar em
// "aplicar", então o limite não pesa para quem compra.
const COUPON_CHECKS_PER_USER = 30;
// Convidado é contado pelo IP. Mais folgado porque, sem TRUSTED_PROXY
// configurado, vários visitantes podem cair no mesmo IP (o do proxy).
const COUPON_CHECKS_PER_GUEST_IP = 60;
const COUPON_CHECK_WINDOW_MS = 10 * 60 * 1000;

async function optionalUser(req) {
  const authorization = String(getHeader(req, 'authorization') || '');
  return authorization ? requireUser(req) : null;
}

function numberField(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function publicCoupon(code, coupon) {
  const type = coupon.type === 'fixed' ? 'fixed' : 'percent';
  const discount = Math.max(0, numberField(coupon.discount));
  const discountPercent = Math.max(0, Math.min(100, numberField(coupon.discountPercent, discount)));
  return {
    code,
    type,
    discount,
    discountPercent,
    description: typeof coupon.description === 'string' ? coupon.description.slice(0, 300) : '',
    expiryDate: typeof coupon.expiryDate === 'string' ? coupon.expiryDate : '',
    freeShipping: coupon.freeShipping === true,
    minOrderValue: Math.max(0, numberField(coupon.minOrderValue)),
  };
}

// Abre o link do e-mail de recuperação de carrinho: começa a janela do cupom e devolve o cupom para
// o carrinho aplicar sozinho. Exige login com e-mail verificado (o cupom é nominal).
async function handleRecoveryOpen(req, res) {
  try {
    const user = await requireUser(req);
    await enforceRateLimit(req, { scope: 'recovery-open', limit: 20, windowMs: COUPON_CHECK_WINDOW_MS, identity: user.uid });
    const body = parseJsonObject(req.body);
    assertExactKeys(body, ['link']);
    const link = requiredText(body.link, { max: 200, pattern: /^[A-Za-z0-9._-]+$/ });
    const { code, coupon, windowEndsAt, replay } = await openRecoveryCoupon(adminDb(), { link, user });
    res.status(200).json({ ok: true, coupon: publicCoupon(code, coupon), windowEndsAt, replay });
  } catch (error) {
    console.error('[recovery-open]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}

export default async function handler(req, res) {
  if (!handleCors(req, res, { methods: ['POST'] })) return;
  if (req.query?.action === 'recovery-open') return handleRecoveryOpen(req, res);

  try {
    const body = parseJsonObject(req.body);
    assertExactKeys(body, ['code', 'orderTotalYen']);
    const code = requiredText(body.code, { max: 80, pattern: /^[A-Za-z0-9_-]+$/ }).toUpperCase();
    const orderTotalYen = body.orderTotalYen === undefined ? 0 : Number(body.orderTotalYen);
    if (!Number.isFinite(orderTotalYen) || orderTotalYen < 0 || orderTotalYen > 1_000_000_000) {
      throw new HttpError(400, 'invalid_order_total');
    }

    const user = await optionalUser(req);
    await enforceRateLimit(req, user
      ? { scope: 'coupon-check', limit: COUPON_CHECKS_PER_USER, windowMs: COUPON_CHECK_WINDOW_MS, identity: user.uid }
      : { scope: 'coupon-check:guest', limit: COUPON_CHECKS_PER_GUEST_IP, windowMs: COUPON_CHECK_WINDOW_MS });
    const db = adminDb();
    const couponSnapshot = await db.collection('coupons').doc(code).get();
    if (!couponSnapshot.exists) throw new HttpError(404, 'coupon_not_found');

    const coupon = couponSnapshot.data() || {};
    if (
      coupon.isActive === false
      || !activeByDate(coupon.expiryDate)
      || (coupon.usageLimit && Number(coupon.usedCount || 0) >= Number(coupon.usageLimit))
    ) {
      throw new HttpError(409, 'coupon_unavailable');
    }

    const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
    const [userSnapshot, usageSnapshot] = await Promise.all([
      user ? db.collection('users').doc(user.uid).get() : Promise.resolve(null),
      email ? db.collection('coupon_usage').doc(code).get() : Promise.resolve(null),
    ]);
    const userDoc = userSnapshot?.exists ? userSnapshot.data() : null;
    const usedBy = usageSnapshot?.exists && Array.isArray(usageSnapshot.data()?.usedBy)
      ? usageSnapshot.data().usedBy.map((entry) => String(entry).trim().toLowerCase())
      : [];
    if (email && usedBy.includes(email)) throw new HttpError(409, 'coupon_already_used');

    // Mesma régua do `orders.js`: se o pedido vai recusar por identidade não
    // provada, a tela não pode anunciar o desconto antes.
    await assertCouponEligibility(db, coupon, {
      uid: user?.uid || '',
      email,
      emailVerified: user?.email_verified === true && Boolean(user?.email),
      userDoc,
      productSubtotalYen: orderTotalYen,
    });

    res.status(200).json({ ok: true, coupon: publicCoupon(code, coupon) });
  } catch (error) {
    console.error('[coupons]', error instanceof Error ? error.message : error);
    sendError(res, error);
  }
}

export { publicCoupon };
