'use client';

import { useInventory } from '@/lib/hooks/useInventory';
import { useEffect } from 'react';

export function InventoryAlerts() {
  const { alerts, loading, error, fetchAlerts } = useInventory();

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  if (loading) return <div className="text-center py-4">Loading alerts...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  const criticalAlerts = alerts.filter(a => a.alertType === 'out-of-stock');
  const warningAlerts = alerts.filter(a => a.alertType === 'low-stock');

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Inventory Alerts</h3>

      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-900 mb-3">Out of Stock ({criticalAlerts.length})</h4>
          <div className="space-y-2">
            {criticalAlerts.map(alert => (
              <div key={alert.id} className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-foreground">{alert.productName}</p>
                  <p className="text-sm text-muted-foreground">Current: {alert.currentQuantity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {warningAlerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-900 mb-3">Low Stock ({warningAlerts.length})</h4>
          <div className="space-y-2">
            {warningAlerts.map(alert => (
              <div key={alert.id} className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-foreground">{alert.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    Current: {alert.currentQuantity} / Minimum: {alert.minimumQuantity}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {criticalAlerts.length === 0 && warningAlerts.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          All inventory levels are healthy
        </div>
      )}
    </div>
  );
}
