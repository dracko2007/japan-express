import React from 'react';
import { ShoppingBag, Package, Calendar } from 'lucide-react';
import { Order } from '@/types';

interface AdminOrderStatsProps {
  allOrders: Order[];
  pendingOrdersCount: number;
}

const AdminOrderStats: React.FC<AdminOrderStatsProps> = ({
  allOrders,
  pendingOrdersCount,
}) => {
  return (
    <>
    {/* Stats */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-2">
          <ShoppingBag className="w-6 h-6 text-primary" />
          <h3 className="font-semibold text-lg">Pedidos carregados</h3>
        </div>
        <p className="text-3xl font-bold">{allOrders.length}</p>
      </div>
              
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-2">
          <Package className="w-6 h-6 text-yellow-600" />
          <h3 className="font-semibold text-lg">Pendentes carregados</h3>
        </div>
        <p className="text-3xl font-bold text-yellow-600">
          {pendingOrdersCount}
        </p>
      </div>
              
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="w-6 h-6 text-green-600" />
          <h3 className="font-semibold text-lg">Hoje (carregados)</h3>
        </div>
        <p className="text-3xl font-bold text-green-600">
          {allOrders.filter(o => {
            const orderDate = new Date(o.orderDate).toDateString();
            const today = new Date().toDateString();
            return orderDate === today;
          }).length}
        </p>
      </div>
    </div>
    </>
  );
};

export default AdminOrderStats;
