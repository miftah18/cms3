# Sync Conflict Resolution Guide

This guide covers handling data conflicts when offline changes conflict with server updates in the CMS3 platform.

## Conflict Types

### 1. Update-Update Conflict
Same field modified offline and on server simultaneously.

```
Server:  Product A price: $10 → $12
Offline: Product A price: $10 → $15
Result:  Conflict! Which price is correct?
```

### 2. Create-Create Conflict
Same resource created both offline and on server.

```
Server:  Customer ID 456 created with email user@server.com
Offline: Customer ID 456 created with email user@local.com
Result:  Duplicate! Which one keeps the ID?
```

### 3. Delete-Update Conflict
Resource deleted on server but modified offline.

```
Server:  Product A deleted
Offline: Product A quantity updated: 10 → 8
Result:  Can't update deleted resource!
```

### 4. Ordering Conflict
Multiple operations on same data in different order.

```
Server:   [Add item 1, Add item 2]
Offline:  [Add item 2, Add item 1]
Result:   Different total/final state
```

## Conflict Resolution Strategies

### 1. Server-Wins Strategy (Default)

**Use case**: Server is source of truth, offline work is temporary

```typescript
function resolveConflict(local: any, server: any): any {
  // Simply ignore local changes and use server version
  return server;
}

// Example:
const local = { price: 15, quantity: 5 };
const server = { price: 12, quantity: 10 };
const resolved = resolveConflict(local, server);
// Result: { price: 12, quantity: 10 }
```

**Pros**: Simple, no data loss on server
**Cons**: User loses offline changes

**When to use**:
- Inventory/stock (server should be accurate)
- Sensitive data (prices, permissions)
- Single-writer scenarios

### 2. Local-Wins Strategy

**Use case**: Offline user's work is more important

```typescript
function resolveConflict(local: any, server: any): any {
  // Keep offline changes and ignore server updates
  return local;
}

// Example:
const local = { price: 15, quantity: 5 };
const server = { price: 12, quantity: 10 };
const resolved = resolveConflict(local, server);
// Result: { price: 15, quantity: 5 }
```

**Pros**: User keeps their work
**Cons**: Might overwrite important server updates

**When to use**:
- User-generated content
- Drafts/work in progress
- Single-user scenarios

### 3. Three-Way Merge Strategy

**Use case**: Combine both versions intelligently

```typescript
function mergeConflict(local: any, server: any, base: any): any {
  const merged = { ...server };

  // For each field, decide which version to keep
  for (const key in local) {
    if (local[key] === base[key]) {
      // Local didn't change, keep server version
      continue;
    }
    
    if (server[key] === base[key]) {
      // Server didn't change, keep local version
      merged[key] = local[key];
    } else {
      // Both changed - need conflict resolution
      if (isNumeric(local[key]) && isNumeric(server[key])) {
        // For numbers, take the larger value
        merged[key] = Math.max(local[key], server[key]);
      } else if (Array.isArray(local[key]) && Array.isArray(server[key])) {
        // For arrays, merge unique items
        merged[key] = [...new Set([...server[key], ...local[key]])];
      } else {
        // For other types, server wins
        merged[key] = server[key];
      }
    }
  }

  return merged;
}

// Example:
const base = { price: 10, quantity: 5, name: 'Product A' };
const local = { price: 15, quantity: 5, name: 'Product A' }; // Changed price
const server = { price: 10, quantity: 8, name: 'Product A' }; // Changed quantity
const resolved = mergeConflict(local, server, base);
// Result: { price: 15, quantity: 8, name: 'Product A' }
// Price from local (user's change), quantity from server (automatic update)
```

**Pros**: Preserves non-conflicting changes from both sides
**Cons**: Requires knowing the base version, complex logic

**When to use**:
- Collaborative features
- Complex transactions
- Multi-field updates

### 4. Last-Write-Wins (LWW) Strategy

**Use case**: Timestamp-based conflict resolution

```typescript
function resolveByTimestamp(local: any, server: any): any {
  const localTime = local.updatedAt || local.createdAt;
  const serverTime = server.updatedAt || server.createdAt;

  return localTime > serverTime ? local : server;
}

// Example:
const local = {
  price: 15,
  updatedAt: 1700000000000, // More recent
};
const server = {
  price: 12,
  updatedAt: 1699999990000, // Older
};
const resolved = resolveByTimestamp(local, server);
// Result: { price: 15, updatedAt: 1700000000000 }
```

**Pros**: Objective, based on wall-clock time
**Cons**: Doesn't consider business logic, assumes clocks are correct

**When to use**:
- Distributed systems with loose time sync
- Simple state updates
- Automatic resolution without user input

### 5. Custom Business Logic Strategy

**Use case**: Domain-specific conflict resolution**

```typescript
function resolveTransactionConflict(local: any, server: any): any {
  // For sales transactions, merge item lists but keep server prices
  if (local.type === 'sale' && server.type === 'sale') {
    const mergedItems = mergeItemLists(local.items, server.items);
    
    return {
      ...server,
      items: mergedItems,
      totalAmount: calculateTotal(mergedItems, server.prices),
      conflictResolved: true,
      resolvedAt: new Date(),
    };
  }

  // For inventory adjustments, take the sum
  if (local.type === 'adjustment' && server.type === 'adjustment') {
    return {
      ...server,
      quantity: server.baseQuantity + local.adjustment + server.adjustment,
      notes: [server.notes, local.notes].filter(Boolean).join('; '),
    };
  }

  // Fallback to server wins
  return server;
}

function mergeItemLists(localItems: any[], serverItems: any[]) {
  const itemMap = new Map();

  // Start with server items (more authoritative)
  serverItems.forEach(item => {
    itemMap.set(item.productId, item);
  });

  // Add local items that weren't on server
  localItems.forEach(item => {
    if (!itemMap.has(item.productId)) {
      itemMap.set(item.productId, item);
    }
  });

  return Array.from(itemMap.values());
}
```

## Implementing Conflict Detection

### Server-Side Conflict Detection

```python
# backend/apps/core/sync_service.py
from datetime import datetime
from typing import Tuple, Dict, Any

class SyncConflictDetector:
    """Detect and handle conflicts during sync"""

    def detect_conflict(
        self,
        local_data: Dict[str, Any],
        server_data: Dict[str, Any],
        base_data: Dict[str, Any]
    ) -> Tuple[bool, str]:
        """
        Detect if there's a conflict between local and server versions
        Returns: (has_conflict, conflict_type)
        """
        
        # Check if server version exists
        if not server_data:
            return False, 'no_conflict'

        # Check if both sides modified same fields
        conflicts = []
        for key in local_data:
            if key in base_data and key in server_data:
                local_changed = local_data[key] != base_data[key]
                server_changed = server_data[key] != base_data[key]
                
                if local_changed and server_changed:
                    # Both modified - check if same way
                    if local_data[key] != server_data[key]:
                        conflicts.append(key)

        if conflicts:
            return True, 'update_update_conflict'

        return False, 'no_conflict'

    def resolve_conflict(
        self,
        local_data: Dict[str, Any],
        server_data: Dict[str, Any],
        base_data: Dict[str, Any],
        strategy: str = 'server-wins'
    ) -> Dict[str, Any]:
        """Resolve conflict based on strategy"""
        
        if strategy == 'server-wins':
            return server_data

        elif strategy == 'local-wins':
            return local_data

        elif strategy == 'three-way-merge':
            return self._three_way_merge(local_data, server_data, base_data)

        elif strategy == 'last-write-wins':
            return self._resolve_by_timestamp(local_data, server_data)

        else:
            raise ValueError(f'Unknown strategy: {strategy}')

    def _three_way_merge(
        self,
        local: Dict[str, Any],
        server: Dict[str, Any],
        base: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Three-way merge algorithm"""
        
        merged = dict(server)

        for key, local_value in local.items():
            base_value = base.get(key)
            server_value = server.get(key)

            # If local didn't change, keep server version
            if local_value == base_value:
                continue

            # If server didn't change, use local version
            if server_value == base_value:
                merged[key] = local_value
            else:
                # Both changed - apply merge logic based on type
                if isinstance(local_value, list) and isinstance(server_value, list):
                    # Merge lists
                    merged[key] = list(set(server_value) | set(local_value))
                elif isinstance(local_value, dict) and isinstance(server_value, dict):
                    # Recursive merge for dicts
                    merged[key] = self._three_way_merge(local_value, server_value, base_value or {})
                else:
                    # For scalars, server wins
                    merged[key] = server_value

        return merged

    def _resolve_by_timestamp(
        self,
        local: Dict[str, Any],
        server: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Resolve by comparing timestamps"""
        
        local_time = local.get('updated_at', local.get('created_at', 0))
        server_time = server.get('updated_at', server.get('created_at', 0))

        return local if local_time > server_time else server
```

### Django API Endpoint with Conflict Handling

```python
# backend/apps/core/sync_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class SyncDataView(APIView):
    """Handle offline data sync with conflict detection"""

    def post(self, request):
        """
        Sync offline data
        
        Expected payload:
        {
          "transactions": [
            {"id": "offline-1", "data": {...}, "base": {...}}
          ]
        }
        """
        
        offline_data = request.data.get('transactions', [])
        results = []
        detector = SyncConflictDetector()

        for item in offline_data:
            local_data = item.get('data')
            base_data = item.get('base')
            item_id = item.get('id')

            # Get server version if exists
            server_data = self._get_server_version(item_id, request.user.tenant)

            # Detect conflict
            has_conflict, conflict_type = detector.detect_conflict(
                local_data, server_data or {}, base_data or {}
            )

            if has_conflict:
                # Return conflict info for client to resolve
                results.append({
                    'id': item_id,
                    'status': 'conflict',
                    'conflict_type': conflict_type,
                    'local': local_data,
                    'server': server_data,
                    'base': base_data,
                })
            else:
                # No conflict, apply the change
                try:
                    updated = self._apply_sync(local_data, server_data)
                    results.append({
                        'id': item_id,
                        'status': 'synced',
                        'data': updated,
                    })
                except Exception as e:
                    results.append({
                        'id': item_id,
                        'status': 'error',
                        'error': str(e),
                    })

        return Response({'results': results})

    def _get_server_version(self, item_id: str, tenant):
        """Retrieve server version of item if exists"""
        # Implementation depends on your data model
        pass

    def _apply_sync(self, local_data, server_data):
        """Apply sync changes to database"""
        # Implementation depends on your data model
        pass
```

## Client-Side Conflict UI

### Conflict Resolution Dialog

```typescript
// frontend/components/ConflictDialog.tsx
import React, { useState } from 'react';

export interface ConflictInfo {
  id: string;
  local: any;
  server: any;
  base?: any;
}

export function ConflictDialog({
  conflict,
  onResolved,
}: {
  conflict: ConflictInfo;
  onResolved: (resolution: any) => void;
}) {
  const [selectedStrategy, setSelectedStrategy] = useState<'server' | 'local' | 'merge'>('server');

  const handleResolve = async () => {
    let resolved: any;

    switch (selectedStrategy) {
      case 'server':
        resolved = conflict.server;
        break;
      case 'local':
        resolved = conflict.local;
        break;
      case 'merge':
        resolved = mergeVersions(conflict.local, conflict.server, conflict.base);
        break;
    }

    // Send resolution back to server
    const response = await fetch('/api/sync/resolve-conflict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        conflictId: conflict.id,
        resolution: resolved,
        strategy: selectedStrategy,
      }),
    });

    if (response.ok) {
      onResolved(resolved);
    }
  };

  return (
    <div className="conflict-dialog">
      <h2>Resolve Conflict</h2>
      
      <div className="conflict-info">
        <h3>Server Version</h3>
        <pre>{JSON.stringify(conflict.server, null, 2)}</pre>
      </div>

      <div className="conflict-info">
        <h3>Your Changes</h3>
        <pre>{JSON.stringify(conflict.local, null, 2)}</pre>
      </div>

      <div className="strategies">
        <label>
          <input
            type="radio"
            value="server"
            checked={selectedStrategy === 'server'}
            onChange={(e) => setSelectedStrategy(e.target.value as any)}
          />
          Use Server Version
        </label>

        <label>
          <input
            type="radio"
            value="local"
            checked={selectedStrategy === 'local'}
            onChange={(e) => setSelectedStrategy(e.target.value as any)}
          />
          Use Your Changes
        </label>

        <label>
          <input
            type="radio"
            value="merge"
            checked={selectedStrategy === 'merge'}
            onChange={(e) => setSelectedStrategy(e.target.value as any)}
          />
          Merge Both Versions
        </label>
      </div>

      <button onClick={handleResolve}>Resolve</button>
    </div>
  );
}
```

## Testing Conflict Resolution

```typescript
// frontend/__tests__/conflict-resolution.test.ts
import { describe, it, expect } from 'vitest';
import { resolveConflict, mergeVersions } from '@/lib/conflict-resolution';

describe('Conflict Resolution', () => {
  it('server-wins strategy', () => {
    const local = { price: 15 };
    const server = { price: 12 };
    
    const result = resolveConflict(local, server, 'server-wins');
    
    expect(result.price).toBe(12);
  });

  it('local-wins strategy', () => {
    const local = { price: 15 };
    const server = { price: 12 };
    
    const result = resolveConflict(local, server, 'local-wins');
    
    expect(result.price).toBe(15);
  });

  it('three-way merge strategy', () => {
    const base = { price: 10, quantity: 5 };
    const local = { price: 15, quantity: 5 }; // Changed price
    const server = { price: 10, quantity: 8 }; // Changed quantity
    
    const result = mergeVersions(local, server, base);
    
    expect(result.price).toBe(15); // From local
    expect(result.quantity).toBe(8); // From server
  });

  it('merge transaction items', () => {
    const base = {
      items: [
        { productId: '1', qty: 1 },
        { productId: '2', qty: 1 },
      ],
    };
    
    const local = {
      items: [
        { productId: '1', qty: 2 }, // Modified
        { productId: '3', qty: 1 }, // Added
      ],
    };
    
    const server = {
      items: [
        { productId: '2', qty: 2 }, // Modified
      ],
    };
    
    const result = mergeVersions(local, server, base);
    
    // Should have all items
    expect(result.items.length).toBeGreaterThanOrEqual(2);
  });
});
```

## Best Practices

1. **Always store base version**: Needed for three-way merge
2. **Use timestamps**: Add `updatedAt` field for LWW strategy
3. **Document strategy**: Make conflict resolution explicit in your code
4. **Test conflicts**: Don't rely on happy path
5. **Log conflicts**: Track when conflicts occur for debugging
6. **User education**: Explain conflicts to users clearly
7. **Automate when possible**: Use LWW or business logic
8. **Manual review when needed**: Show conflicts to users when ambiguous
9. **Idempotency**: Ensure sync operations can be retried safely
10. **Monitor**: Track conflict rates and patterns

## Conflict Resolution Checklist

- [ ] Choose appropriate strategy for your use case
- [ ] Implement server-side conflict detection
- [ ] Implement client-side conflict resolution UI
- [ ] Store base versions for three-way merge
- [ ] Test all conflict types
- [ ] Log conflicts for debugging
- [ ] Document resolution strategy for team
- [ ] Monitor conflict rates in production
- [ ] Have manual escalation path
- [ ] Educate users on offline behavior

