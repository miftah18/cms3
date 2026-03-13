import { TransactionList } from '@/components/transactions/TransactionList';

export const metadata = {
  title: 'Transactions',
  description: 'Manage sales and purchase transactions',
};

export default function TransactionsPage() {
  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Transactions</h1>
        <p className="text-muted-foreground">View and manage all transactions</p>
      </div>

      <TransactionList />
    </div>
  );
}
