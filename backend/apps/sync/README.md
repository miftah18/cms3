# App: Sync

Delta sync engine untuk upload transaksi offline ke server.

## Isi

```
apps/sync/
├── processor.py       ← SyncProcessor — main processing logic
├── handlers.py        ← Handler per entity type (transactions, stock_adj, dll)
├── validators.py      ← Payload signature validation
├── conflict.py        ← Conflict detection & resolution
├── views.py           ← POST /sync/delta/, GET /sync/status/, POST /sync/resolve-conflict/
└── tests/
    ├── test_processor.py  ← Dedup, conflict, batch processing
    └── test_conflict.py   ← Conflict scenarios
```

## SyncProcessor

```python
# processor.py
class SyncProcessor:
    def __init__(self, tenant):
        self.tenant = tenant

    def process(self, payload: dict) -> dict:
        """
        Proses satu batch sync.
        Return: {synced: [...], conflicts: [...], failed: [...]}
        """
        # 1. Validasi signature
        # 2. Iterasi queue items
        # 3. Dispatch ke handler per entity_type
        # 4. Return results

    def _dispatch(self, item: dict) -> dict:
        handler = HANDLERS.get(item['entity_type'])
        if not handler:
            return {'status': 'failed', 'reason': 'unknown_entity_type'}
        return handler(self.tenant, item)

HANDLERS = {
    'transactions':     handle_transaction,
    'stock_adjustments': handle_stock_adjustment,
}
```

## Conflict Resolution Logic

```
[Stock check saat sync]

Stok cukup?
  YES → Proses transaksi, kurangi stok
   NO → Flagged sebagai conflict
         └→ Notify Branch Manager
         └→ Manager bisa: approve | reject | adjust
```
