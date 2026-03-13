'use client';

import { useTransactions } from '@/lib/hooks/useTransactions';
import { useState } from 'react';
import Link from 'next/link';

export function TransactionList() {
  const { transactions, loading, error, pagination, fetchTransactions } = useTransactions();
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'purchase' | 'return'>('all');

  const handleFilterChange = (type: 'all' | 'sale' | 'purchase' | 'return') => {
    setFilterType(type);
    fetchTransactions(1, pagination.pageSize, type === 'all' ? undefined : type);
  };

  const handlePageChange = (newPage: number) => {
    fetchTransactions(newPage, pagination.pageSize, filterType === 'all' ? undefined : filterType);
  };

  if (loading && transactions.length === 0)
    return <div className="text-center py-4">Loading transactions...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  const filteredTransactions = transactions;
  const totalPages = Math.ceil(pagination.count / pagination.pageSize);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'draft':
        return 'bg-yellow-100 text-yellow-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sale':
        return 'text-blue-600';
      case 'purchase':
        return 'text-green-600';
      case 'return':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {(['all', 'sale', 'purchase', 'return'] as const).map(type => (
            <button
              key={type}
              onClick={() => handleFilterChange(type)}
              className={`px-4 py-2 rounded-lg transition-colors capitalize ${
                filterType === type
                  ? 'bg-primary text-white'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <Link
          href="/transactions/new"
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          New Transaction
        </Link>
      </div>

      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Code</th>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Type</th>
              <th className="text-right py-3 px-4 font-semibold text-foreground">Amount</th>
              <th className="text-center py-3 px-4 font-semibold text-foreground">Status</th>
              <th className="text-left py-3 px-4 font-semibold text-foreground">Date</th>
              <th className="text-center py-3 px-4 font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(transaction => (
              <tr key={transaction.id} className="border-b border-border hover:bg-muted">
                <td className="py-3 px-4 font-mono text-xs text-foreground">{transaction.code}</td>
                <td className={`py-3 px-4 font-medium capitalize ${getTypeColor(transaction.type)}`}>
                  {transaction.type}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-foreground">
                  ${transaction.total.toFixed(2)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusColor(transaction.status)}`}>
                    {transaction.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-4 text-center">
                  <Link
                    href={`/transactions/${transaction.id}`}
                    className="text-blue-500 hover:text-blue-600"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredTransactions.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">No transactions found</div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 py-1 rounded border border-border disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1">
            Page {pagination.page} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === totalPages}
            className="px-3 py-1 rounded border border-border disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
