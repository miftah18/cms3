import { ProductForm } from '@/components/products/ProductForm';

export const metadata = {
  title: 'New Product',
  description: 'Create a new product',
};

export default function NewProductPage() {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold text-foreground mb-6">Create New Product</h1>
      <ProductForm />
    </div>
  );
}
