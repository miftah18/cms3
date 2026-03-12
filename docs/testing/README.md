# Testing Strategy

## Testing Pyramid

```
         /\
        /E2E\          Playwright — alur kritis
       /──────\
      /  Integ \       pytest — API, DB, tenant isolation
     /──────────\
    /  Unit Tests\     pytest — models, engine, validators
   /──────────────\
```

| Layer | Target | Tools | Focus |
|-------|--------|-------|-------|
| Unit | 85%+ | pytest | Models, FlowEngine, SyncProcessor, Validators |
| Integration | 70%+ | pytest + DRF test client | API, DB, Tenant isolation |
| E2E | Alur kritis | Playwright | Full flow, offline-sync cycle |
| Load | Scenario | Locust | 1000 concurrent users |
| Security | Manual + auto | Bandit, OWASP ZAP | Injection, auth bypass |

## Unit Tests

### FlowEngine
```python
# backend/apps/flow_engine/tests/test_engine.py
class TestFlowEngine:
    def test_get_flow_returns_correct_steps(self, coffee_shop_bt):
        engine = FlowEngine('coffee_shop')
        steps = engine.get_flow()
        assert len(steps) == 5
        assert steps[0].key == 'select_items'

    def test_validate_step_requires_min_items(self, coffee_shop_bt):
        engine = FlowEngine('coffee_shop')
        assert engine.validate_step_data('select_items', {'items': []}) == False
        assert engine.validate_step_data('select_items', {'items': [{'id':'x'}]}) == True

    def test_offline_strategy_cached(self, coffee_shop_bt):
        engine = FlowEngine('coffee_shop')
        strategy = engine.get_offline_strategy()
        assert strategy['cache_products'] == True
        assert strategy['max_cached_products'] == 500
```

### Sync Processor
```python
# backend/apps/sync/tests/test_processor.py
class TestSyncConflictResolution:
    def test_duplicate_transaction_is_ignored(self, db, tenant):
        payload = build_sync_payload(local_id='tx_001')
        result1 = SyncProcessor(tenant).process(payload)
        assert result1['status'] == 'synced'
        result2 = SyncProcessor(tenant).process(payload)
        assert result2['status'] == 'synced'
        assert result2.get('note') == 'duplicate_ignored'
        assert Transaction.objects.filter(local_id='tx_001').count() == 1

    def test_stock_conflict_flagged(self, db, tenant):
        create_stock(tenant, product_id='prod_001', quantity=0)
        payload = build_sync_payload('tx_conflict',
            items=[{'product_id': 'prod_001', 'quantity': 2}])
        result = SyncProcessor(tenant).process(payload)
        assert result['status'] == 'conflict'
        assert result['conflict_data']['type'] == 'insufficient_stock'
```

## Integration Tests

### Tenant Isolation (KRITIS)
```python
# backend/tests/test_tenant_isolation.py
class TestTenantIsolation:
    def test_tenant_a_cannot_read_tenant_b_transactions(self, tenant_a, tenant_b):
        tx_b = create_transaction_for_tenant(tenant_b)
        client = APIClient()
        client.force_authenticate(user=tenant_a.admin_user)
        client.credentials(HTTP_HOST='shop-a.example.com')
        response = client.get(f'/api/v1/transactions/{tx_b.id}/')
        assert response.status_code == 404  # Tidak boleh 200!

    def test_product_list_only_returns_own_products(self, tenant_a, tenant_b):
        create_product(tenant_a, name='Produk A')
        create_product(tenant_b, name='Produk B')
        client = APIClient()
        client.force_authenticate(user=tenant_a.cashier)
        client.credentials(HTTP_HOST='shop-a.example.com')
        response = client.get('/api/v1/products/')
        names = [p['name'] for p in response.data['results']]
        assert 'Produk A' in names
        assert 'Produk B' not in names
```

## E2E Tests (Playwright)

```typescript
// e2e/tests/pos-flow.spec.ts
test('coffee shop flow — 5 langkah', async ({ page }) => {
  await page.goto('https://demo-coffee.saas.local')
  await loginAs(page, 'cashier')
  await page.click('[data-testid="start-transaction"]')

  // Step 1: Pilih menu
  await page.click('[data-product="kopi-hitam"]')
  await page.click('[data-testid="next-step"]')

  // Step 2: Review cart
  await expect(page.locator('.cart-item')).toHaveCount(1)
  await page.click('[data-testid="next-step"]')

  // Step 3: Bayar
  await page.click('[data-payment="cash"]')
  await page.fill('[data-testid="cash-amount"]', '20000')
  await page.click('[data-testid="process-payment"]')

  // Step 5: Struk muncul
  await expect(page.locator('.receipt')).toBeVisible()
})

test('offline flow — transaksi offline, sync saat online', async ({ page, context }) => {
  await context.setOffline(true)
  await completTransaction(page)
  await expect(page.locator('[data-testid="pending-sync"]')).toContainText('1 transaksi')
  await context.setOffline(false)
  await page.waitForTimeout(5000)
  await expect(page.locator('[data-testid="pending-sync"]')).not.toBeVisible()
})
```

## Load Tests (Locust)

```python
# load_tests/locustfile.py
class CashierUser(HttpUser):
    wait_time = between(1, 3)

    @task(5)  # Paling sering
    def create_transaction(self):
        self.client.post('/api/v1/transactions/', headers=self.headers, json={...})

    @task(3)
    def get_products(self):
        self.client.get('/api/v1/products/', headers=self.headers)

# Target: 1000 users, P95 < 500ms, error rate < 0.1%
# Run: locust -f locustfile.py --users 1000 --spawn-rate 50
```

## CI Pipeline

```yaml
# .github/workflows/test.yml
- name: Backend Tests
  run: |
    cd backend
    pytest --cov=apps --cov-report=xml -v
    coverage report --fail-under=80

- name: Security Scan
  run: |
    bandit -r backend/ -ll  # fail on medium+
    npm audit --audit-level=high

- name: E2E Tests
  run: npx playwright test
```

## Coverage Requirements

| Area | Minimum |
|------|---------|
| Backend overall | 80% |
| Flow Engine | 90% |
| Sync Processor | 85% |
| Tenant Isolation | 100% (semua test wajib hijau) |
| Payment Integration | 75% |
