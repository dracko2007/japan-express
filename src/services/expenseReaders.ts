import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { EmployeePayment } from '@/components/admin/EmployeeManager';
import type { FinanceExpense } from '@/components/admin/FinanceDetailManager';
import type { MarketingExpense } from '@/components/admin/MarketingManager';

// Leituras do Firestore usadas pelo Dashboard e pela tela de finanças. Ficam aqui, e não
// dentro dos componentes de cada tela, para esses arquivos exportarem só componentes.
export const EMPLOYEE_PAYMENTS_COLLECTION = 'employee_payments';
export const FINANCE_EXPENSES_COLLECTION = 'finance_expenses';
export const MARKETING_EXPENSES_COLLECTION = 'marketing_expenses';

export async function getEmployeePayments(): Promise<EmployeePayment[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, EMPLOYEE_PAYMENTS_COLLECTION), orderBy('date', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as EmployeePayment));
  } catch { return []; }
}

export async function getFinanceExpenses(): Promise<FinanceExpense[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, FINANCE_EXPENSES_COLLECTION), orderBy('date', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FinanceExpense));
  } catch {
    return [];
  }
}

export async function getMarketingExpenses(): Promise<MarketingExpense[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, MARKETING_EXPENSES_COLLECTION), orderBy('date', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketingExpense));
  } catch { return []; }
}
