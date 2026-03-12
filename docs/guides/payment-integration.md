# Payment Integration Guide

This guide covers integrating payment gateways into the CMS3 platform, supporting multiple payment methods and business types.

## Overview

The payment system supports:
- **Multiple Gateways**: Stripe, Midtrans, GCash, PayMaya
- **Multiple Methods**: Credit Card, E-Wallet, Bank Transfer, QR Code
- **Business Types**: All (generic gateway config)
- **Offline Support**: Queue payments for processing when online
- **Webhook Handling**: Real-time transaction updates

## Payment Flow Architecture

```
Frontend Request
  ↓
Payment Component
  ↓
PaymentService (usePayment hook)
  ↓
Payment API Endpoint (/api/payments)
  ↓
Payment Gateway (Stripe, Midtrans, etc)
  ↓
Backend Processing
  ↓
Database Transaction Record
  ↓
Webhook Handler (confirmation)
  ↓
State Update (Redux/Zustand)
  ↓
UI Notification
```

## Setup Payment Gateway

### 1. Configure Payment Gateway Credentials

**Step 1: Add Environment Variables**

```bash
# .env.local for frontend
NEXT_PUBLIC_STRIPE_KEY=pk_test_...
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=Mid-...

# .env for backend
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
MIDTRANS_SERVER_KEY=Mid-...
MIDTRANS_MERCHANT_ID=G123456...
```

**Step 2: Initialize Payment Gateway SDK**

```typescript
// frontend/lib/payment-gateway.ts
import Stripe from '@stripe/stripe-js';
import { MidtransClient } from 'midtrans-client';

export const stripe = await loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_KEY
);

export const midtransSnap = new MidtransClient.Snap({
  isProduction: false,
  serverKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
});
```

### 2. Initialize Payment Gateway in Backend

**Django Settings Configuration**

```python
# backend/settings.py
PAYMENT_GATEWAYS = {
    'stripe': {
        'secret_key': os.getenv('STRIPE_SECRET_KEY'),
        'publishable_key': os.getenv('STRIPE_PUBLISHABLE_KEY'),
        'webhook_secret': os.getenv('STRIPE_WEBHOOK_SECRET'),
    },
    'midtrans': {
        'merchant_id': os.getenv('MIDTRANS_MERCHANT_ID'),
        'server_key': os.getenv('MIDTRANS_SERVER_KEY'),
        'client_key': os.getenv('MIDTRANS_CLIENT_KEY'),
    },
}

WEBHOOK_ENDPOINTS = {
    'stripe': '/api/webhooks/stripe',
    'midtrans': '/api/webhooks/midtrans',
}
```

## Payment Integration Methods

### Method 1: Hosted Payment Page (Recommended for Web)

**Simplest and most secure - user is redirected to payment gateway**

**Frontend Implementation**

```typescript
// frontend/hooks/usePayment.ts
import { useState } from 'react';

export function usePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiatePayment = async (paymentData: {
    amount: number;
    currency: string;
    businessType: string;
    metadata: Record<string, any>;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate payment');
      }

      const { payment_url, transaction_id } = await response.json();

      // Redirect to payment gateway
      window.location.href = payment_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return { initiatePayment, loading, error };
}
```

**Backend Implementation**

```python
# backend/apps/payments/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from .services import PaymentGatewayService

class InitiatePaymentView(APIView):
    """Initiate payment with external gateway"""

    def post(self, request):
        data = request.data
        gateway = data.get('gateway', 'stripe')
        
        payment_service = PaymentGatewayService(gateway)
        
        # Create transaction record
        transaction = Transaction.objects.create(
            tenant=request.user.tenant,
            amount=data['amount'],
            currency=data['currency'],
            business_type=data['business_type'],
            status='pending',
            metadata=data.get('metadata', {})
        )

        # Initiate payment with gateway
        payment_response = payment_service.create_payment_intent(
            amount=transaction.amount,
            currency=transaction.currency,
            metadata={
                'transaction_id': str(transaction.id),
                'tenant_id': str(request.user.tenant.id),
            },
            return_url=f"{settings.FRONTEND_URL}/payment/success",
            cancel_url=f"{settings.FRONTEND_URL}/payment/cancel",
        )

        transaction.gateway_transaction_id = payment_response['transaction_id']
        transaction.save()

        return Response({
            'transaction_id': str(transaction.id),
            'payment_url': payment_response['payment_url'],
        })
```

### Method 2: Inline Payment Form (Card Payment)

**For card payments without leaving your site**

**Frontend Implementation**

```typescript
// frontend/components/PaymentForm.tsx
import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

export function PaymentForm({ amount, onSuccess }: {
  amount: number;
  onSuccess: (transactionId: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    try {
      // Create payment intent on backend
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          currency: 'USD',
          businessType: 'general',
        }),
      });

      const { client_secret, transaction_id } = await response.json();

      // Confirm payment with card element
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        client_secret,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
            billing_details: {
              name: 'Customer Name',
            },
          },
        }
      );

      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
      } else if (paymentIntent.status === 'succeeded') {
        onSuccess(transaction_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <CardElement />
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading || !stripe}>
        {loading ? 'Processing...' : `Pay $${amount}`}
      </button>
    </form>
  );
}
```

### Method 3: E-Wallet Integration (Midtrans Snap)

**For e-wallet and bank transfer support**

```typescript
// frontend/hooks/useMidtransPayment.ts
import { useEffect, useState } from 'react';

declare global {
  interface Window {
    snap: {
      pay: (token: string, options?: any) => void;
    };
  }
}

export function useMidtransPayment() {
  const [snapLoaded, setSnapLoaded] = useState(false);

  useEffect(() => {
    // Load Midtrans Snap script
    const script = document.createElement('script');
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!);
    script.onload = () => setSnapLoaded(true);
    document.body.appendChild(script);
  }, []);

  const initiateEWalletPayment = async (paymentData: {
    amount: number;
    orderId: string;
    customerEmail: string;
    paymentMethods: string[]; // ['gopay', 'qris', 'bca_va', etc]
  }) => {
    if (!snapLoaded) {
      throw new Error('Midtrans Snap not loaded');
    }

    // Request snap token from backend
    const response = await fetch('/api/payments/midtrans-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(paymentData),
    });

    const { snapToken, transactionId } = await response.json();

    // Open payment popup
    return new Promise((resolve, reject) => {
      window.snap.pay(snapToken, {
        onSuccess: (result) => resolve(result),
        onPending: (result) => console.log('Pending:', result),
        onError: (result) => reject(result),
        onClose: () => reject(new Error('Payment cancelled')),
      });
    });
  };

  return { initiateEWalletPayment, snapLoaded };
}
```

**Backend Midtrans Integration**

```python
# backend/apps/payments/services.py
from midtrans import Client

class MidtransService:
    def __init__(self):
        self.client = Client(
            server_key=settings.MIDTRANS_SERVER_KEY,
            is_production=False
        )

    def create_snap_token(self, transaction: Transaction):
        """Create Midtrans Snap token for payment"""
        
        param = {
            "transaction_details": {
                "order_id": str(transaction.id),
                "gross_amount": int(transaction.amount),
            },
            "credit_card": {
                "secure": True
            },
            "customer_details": {
                "email": transaction.created_by.email,
            },
            "enabled_payments": [
                "gopay", "qris", "bca_va", "bri_va", "bni_va"
            ],
        }

        snap_resp = self.client.transactions.snap(param=param)
        
        return {
            "snapToken": snap_resp['token'],
            "snapUrl": snap_resp['redirect_url'],
            "transactionId": str(transaction.id),
        }
```

## Webhook Handling

### Stripe Webhook

```python
# backend/apps/payments/webhooks.py
import stripe
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def stripe_webhook(request):
    payload = request.body
    sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        return JsonResponse({'error': 'Invalid payload'}, status=400)
    except stripe.error.SignatureVerificationError:
        return JsonResponse({'error': 'Invalid signature'}, status=400)

    # Handle payment success
    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        transaction_id = payment_intent['metadata']['transaction_id']
        
        transaction = Transaction.objects.get(id=transaction_id)
        transaction.status = 'completed'
        transaction.gateway_response = payment_intent
        transaction.save()
        
        # Trigger side effects (notification, analytics, etc)
        on_payment_completed(transaction)

    # Handle payment failed
    elif event['type'] == 'payment_intent.payment_failed':
        payment_intent = event['data']['object']
        transaction_id = payment_intent['metadata']['transaction_id']
        
        transaction = Transaction.objects.get(id=transaction_id)
        transaction.status = 'failed'
        transaction.error_message = payment_intent.get('last_payment_error', {}).get('message')
        transaction.save()

    return JsonResponse({'status': 'success'})
```

### Midtrans Webhook

```python
# backend/apps/payments/webhooks.py
from django.http import JsonResponse
import hashlib
import json

def midtrans_webhook(request):
    data = json.loads(request.body)
    
    # Verify signature
    order_id = data['order_id']
    status_code = data['status_code']
    gross_amount = data['gross_amount']
    server_key = settings.MIDTRANS_SERVER_KEY
    
    signature_key = hashlib.sha512(
        f'{order_id}{status_code}{gross_amount}{server_key}'.encode()
    ).hexdigest()
    
    if signature_key != data.get('signature_key'):
        return JsonResponse({'error': 'Invalid signature'}, status=400)

    transaction = Transaction.objects.get(id=order_id)
    
    if data['transaction_status'] == 'settlement':
        transaction.status = 'completed'
    elif data['transaction_status'] == 'pending':
        transaction.status = 'pending'
    elif data['transaction_status'] == 'deny':
        transaction.status = 'failed'
    
    transaction.gateway_response = data
    transaction.save()
    
    return JsonResponse({'status': 'success'})
```

## Offline Payment Queueing

For users working offline, payments should be queued and processed when connection is restored.

```typescript
// frontend/lib/offline-payment-queue.ts
import { useSyncStore } from '@/hooks/useSyncStore';

export async function queueOfflinePayment(paymentData: PaymentData) {
  const syncStore = useSyncStore();
  
  // Store in IndexedDB
  const pendingPayment = {
    id: generateId(),
    ...paymentData,
    timestamp: Date.now(),
    status: 'pending',
    retries: 0,
  };

  await syncStore.saveOfflinePayment(pendingPayment);
  
  return pendingPayment.id;
}

// When online, process queued payments
export async function processQueuedPayments() {
  const syncStore = useSyncStore();
  const payments = await syncStore.getOfflinePayments('pending');
  
  for (const payment of payments) {
    try {
      const result = await submitPayment(payment);
      
      await syncStore.updateOfflinePayment(payment.id, {
        status: 'completed',
        result,
      });
    } catch (error) {
      // Increment retry count
      payment.retries++;
      
      if (payment.retries < 3) {
        await syncStore.updateOfflinePayment(payment.id, {
          retries: payment.retries,
        });
      } else {
        await syncStore.updateOfflinePayment(payment.id, {
          status: 'failed',
          error: error.message,
        });
      }
    }
  }
}
```

## Error Handling & Recovery

```typescript
// frontend/hooks/usePaymentError.ts
export function usePaymentError() {
  const handlePaymentError = (error: PaymentError) => {
    switch (error.code) {
      case 'PAYMENT_INTENT_FAILED':
        return {
          message: 'Payment processing failed. Please try again.',
          action: 'retry', // Allow retry
        };
      
      case 'CARD_DECLINED':
        return {
          message: 'Your card was declined. Please use a different card.',
          action: 'change_card',
        };
      
      case 'NETWORK_ERROR':
        return {
          message: 'Network error. Queuing payment for later.',
          action: 'queue_offline',
        };
      
      case 'INVALID_AMOUNT':
        return {
          message: 'Invalid payment amount.',
          action: 'edit_amount',
        };
      
      default:
        return {
          message: 'An unexpected error occurred.',
          action: 'contact_support',
        };
    }
  };

  return { handlePaymentError };
}
```

## Testing Payment Integration

### Unit Tests

```typescript
// frontend/__tests__/usePayment.test.ts
import { renderHook, act } from '@testing-library/react';
import { usePayment } from '@/hooks/usePayment';

describe('usePayment', () => {
  it('should initiate payment successfully', async () => {
    const { result } = renderHook(() => usePayment());
    
    await act(async () => {
      await result.current.initiatePayment({
        amount: 100,
        currency: 'USD',
        businessType: 'salon',
        metadata: { serviceId: '123' },
      });
    });

    expect(result.current.loading).toBe(false);
  });

  it('should handle payment errors', async () => {
    const { result } = renderHook(() => usePayment());
    
    // Mock failed payment
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        statusText: 'Payment Failed',
      })
    );

    await act(async () => {
      await result.current.initiatePayment({
        amount: -100, // Invalid amount
        currency: 'USD',
        businessType: 'salon',
        metadata: {},
      });
    });

    expect(result.current.error).toBeTruthy();
  });
});
```

## Best Practices

1. **Always verify payments server-side**: Never trust client-side payment status
2. **Use webhooks for confirmation**: Don't rely on redirect URLs alone
3. **Handle idempotency**: Use transaction IDs to prevent duplicate charges
4. **Implement retry logic**: Queue failed payments and retry with exponential backoff
5. **Test thoroughly**: Use sandbox/test credentials before going live
6. **Monitor failures**: Log and monitor payment failures for debugging
7. **Encrypt sensitive data**: Never store raw card data
8. **Comply with PCI**: Use payment gateways, not your own card processing

## Integration Checklist

- [ ] Configure payment gateway credentials in `.env`
- [ ] Initialize payment gateway SDK (frontend + backend)
- [ ] Implement payment initiation endpoint
- [ ] Implement webhook handlers for payment confirmation
- [ ] Add error handling and retry logic
- [ ] Implement offline payment queueing
- [ ] Test with sandbox credentials
- [ ] Verify webhook signatures
- [ ] Monitor payment transactions
- [ ] Document payment flow for your team
- [ ] Go live with production credentials

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Webhook not being received | Check webhook URL in gateway dashboard, verify firewall/proxy settings |
| Payment intent fails with 402 | Card declined or insufficient funds, show user to retry with different card |
| Signature verification fails | Verify webhook secret matches exactly, check request headers |
| Transaction marked pending forever | Check webhook handler, manually verify with gateway API |
| Offline payments not syncing | Check IndexedDB, verify network connectivity, check server logs |

