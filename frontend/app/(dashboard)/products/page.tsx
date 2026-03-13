import { ProductList } from '@/components/products/ProductList';
import { InventoryAlerts } from '@/components/products/InventoryAlerts';

export const metadata = {
  title: 'Products',
  description: 'Manage products and inventory',
};

export default function ProductsPage() {
  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Products</h1>
        <p className="text-muted-foreground">Manage your product catalog and inventory</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <ProductList />
        </div>
        <div>
          <InventoryAlerts />
        </div>
      </div>
    </div>
  );
}
