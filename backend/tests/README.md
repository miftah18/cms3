# Integration Tests

Test suite lintas app — fokus pada tenant isolation, sync scenarios, dan full business flow.

## Isi

```
backend/tests/
├── conftest.py                    ← Fixtures: tenant_a, tenant_b, users, products
├── test_tenant_isolation.py       ← KRITIS: data tidak bocor antar tenant
├── test_sync_scenarios.py         ← Skenario sync kompleks (race condition, conflict)
├── test_full_flow_coffee_shop.py  ← Full flow coffee shop (login → transaksi → laporan)
├── test_full_flow_laundry.py      ← Full flow laundry termasuk pickup
├── test_full_flow_clinic.py       ← Full flow klinik termasuk BPJS
├── test_payment_scenarios.py      ← Semua payment method (mock gateway)
└── test_performance.py            ← Query count assertions (cegah N+1)
```

## conftest.py

```python
# backend/tests/conftest.py
import pytest
from django.test import TestCase
from rest_framework.test import APIClient

@pytest.fixture
def tenant_a(db):
    """Tenant A — Coffee Shop."""
    return create_full_tenant(
        name='Kedai Kopi A',
        slug='kedai-kopi-a',
        domain='shop-a.example.com',
        business_type='coffee_shop'
    )

@pytest.fixture
def tenant_b(db):
    """Tenant B — Laundry. Data harus terisolasi dari Tenant A."""
    return create_full_tenant(
        name='Laundry B',
        slug='laundry-b',
        domain='laundry-b.example.com',
        business_type='laundry'
    )

@pytest.fixture
def cashier_a(tenant_a):
    return create_user(tenant_a, role='cashier', email='kasir@a.com')

@pytest.fixture
def manager_a(tenant_a):
    return create_user(tenant_a, role='branch_manager', email='manager@a.com')

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def auth_client_a(api_client, cashier_a, tenant_a):
    api_client.force_authenticate(user=cashier_a)
    api_client.credentials(HTTP_HOST='shop-a.example.com')
    return api_client
```

## Tenant Isolation Tests (KRITIS)

```python
# backend/tests/test_tenant_isolation.py

class TestTenantIsolation:
    """
    Test ini WAJIB lulus 100%.
    Jika ada yang gagal → data bisa bocor antar tenant → security issue serius.
    """

    def test_transaction_not_visible_cross_tenant(
        self, auth_client_a, tenant_b
    ):
        """Kasir A tidak bisa lihat transaksi B."""
        tx_b = create_transaction(tenant_b)
        response = auth_client_a.get(f'/api/v1/transactions/{tx_b.id}/')
        assert response.status_code == 404, (
            f"SECURITY BUG: Tenant A bisa akses transaksi Tenant B! "
            f"Status: {response.status_code}"
        )

    def test_product_list_isolated(self, auth_client_a, tenant_a, tenant_b):
        """GET /products/ hanya return produk tenant sendiri."""
        prod_a = create_product(tenant_a, name='Kopi Hitam')
        prod_b = create_product(tenant_b, name='Baju Kotor')

        response = auth_client_a.get('/api/v1/products/')
        names = [p['name'] for p in response.data['results']]

        assert 'Kopi Hitam' in names,     "Produk sendiri tidak muncul"
        assert 'Baju Kotor' not in names, "SECURITY BUG: Produk tenant lain terlihat!"

    def test_user_from_other_tenant_cannot_login_on_wrong_domain(
        self, api_client, tenant_a, tenant_b
    ):
        """User Tenant B tidak bisa login di domain Tenant A."""
        user_b = create_user(tenant_b, email='user@b.com', password='pass123')
        api_client.credentials(HTTP_HOST='shop-a.example.com')
        response = api_client.post('/api/v1/auth/login/', {
            'email': 'user@b.com',
            'password': 'pass123',
        })
        assert response.status_code == 401

    def test_sync_payload_tenant_mismatch_rejected(
        self, auth_client_a, tenant_b
    ):
        """Payload sync dengan branch dari tenant lain harus ditolak."""
        branch_b = create_branch(tenant_b)
        response = auth_client_a.post('/api/v1/sync/delta/', {
            'device_id': 'device-001',
            'branch_id': str(branch_b.id),    # Branch dari tenant lain!
            'checksum':  'xxx',
            'queue':     [],
        })
        assert response.status_code in (403, 404)

    def test_stock_adjust_cross_tenant_rejected(
        self, auth_client_a, tenant_b
    ):
        """Adjust stok branch dari tenant lain harus ditolak."""
        branch_b  = create_branch(tenant_b)
        product_b = create_product(tenant_b)
        response  = auth_client_a.post('/api/v1/stock/adjust/', {
            'branch_id':  str(branch_b.id),
            'product_id': str(product_b.id),
            'adjustment_type': 'add',
            'quantity': 10,
        })
        assert response.status_code in (403, 404)
```

## Sync Scenario Tests

```python
# backend/tests/test_sync_scenarios.py

class TestSyncScenarios:

    def test_duplicate_transaction_idempotent(self, auth_client_a, products):
        """Upload transaksi dua kali dengan local_id sama → hanya 1 yang tersimpan."""
        payload = build_sync_payload(local_id='tx-local-001', products=products)

        r1 = auth_client_a.post('/api/v1/sync/delta/', payload)
        r2 = auth_client_a.post('/api/v1/sync/delta/', payload)  # Upload ulang

        assert r1.status_code == 200
        assert r2.status_code == 200
        assert Transaction.objects.filter(local_id='tx-local-001').count() == 1

    def test_stock_conflict_flagged(self, auth_client_a, product_zero_stock):
        """Transaksi dengan stok 0 harus di-flag sebagai conflict, bukan error 500."""
        payload = build_sync_payload(
            local_id='tx-conflict-001',
            items=[{'product_id': str(product_zero_stock.id), 'quantity': 2}]
        )
        response = auth_client_a.post('/api/v1/sync/delta/', payload)

        assert response.status_code == 200
        assert len(response.data['conflicts']) == 1
        assert response.data['conflicts'][0]['conflict_type'] == 'insufficient_stock'

    def test_batch_sync_partial_success(self, auth_client_a, products):
        """Batch dengan 2 transaksi valid + 1 conflict → 2 synced, 1 conflict."""
        payload = {
            'device_id': 'dev-001',
            'branch_id': str(products[0].branch_id),
            'checksum':  generate_checksum_for_test(payload),
            'queue': [
                build_queue_item('tx-001', products=products[:2], quantities=[1,1]),
                build_queue_item('tx-002', products=products[:2], quantities=[1,1]),
                build_queue_item('tx-003', products=products[:2], quantities=[999,999]),  # Stok pasti kurang
            ]
        }
        response = auth_client_a.post('/api/v1/sync/delta/', payload)
        assert response.data['synced'] == 2
        assert len(response.data['conflicts']) == 1

    def test_concurrent_sync_no_negative_stock(self, tenant_a, product_with_stock_5):
        """
        2 device sync bersamaan, total qty = 10, stok = 5.
        Salah satu harus jadi conflict — tidak boleh ada stok negatif.
        """
        from concurrent.futures import ThreadPoolExecutor

        def sync(device_id):
            client = create_auth_client(tenant_a)
            return client.post('/api/v1/sync/delta/', build_sync_payload(
                local_id=f'tx-{device_id}',
                items=[{'product_id': str(product_with_stock_5.id), 'quantity': 5}],
            ))

        with ThreadPoolExecutor(max_workers=2) as ex:
            results = list(ex.map(sync, ['dev-A', 'dev-B']))

        # Total yang diproses tidak boleh melebihi stok
        stock_after = Stock.objects.get(product=product_with_stock_5).quantity
        assert stock_after >= 0, "STOCK WENT NEGATIVE!"
```

## Performance Tests

```python
# backend/tests/test_performance.py
from django.test.utils import override_settings
from django.db import connection, reset_queries

@override_settings(DEBUG=True)
class TestQueryPerformance:

    def test_product_list_no_n_plus_one(self, auth_client_a):
        """Buat 50 produk, pastikan GET /products/ tidak trigger N+1 queries."""
        create_products(count=50)
        reset_queries()

        auth_client_a.get('/api/v1/products/')

        # Max 5 queries: auth check, tenant resolve, product list, category, stock
        assert len(connection.queries) <= 5, (
            f"N+1 detected! {len(connection.queries)} queries untuk 50 produk"
        )

    def test_transaction_create_query_count(self, auth_client_a, products):
        """POST /transactions/ max 10 queries (validate, create, deduct stock, payment)."""
        reset_queries()
        auth_client_a.post('/api/v1/transactions/', build_transaction_payload(products))
        assert len(connection.queries) <= 10
```

## Menjalankan Tests

```bash
# Semua integration tests
pytest backend/tests/ -v

# Hanya isolation tests (wajib hijau sebelum deploy)
pytest backend/tests/test_tenant_isolation.py -v --tb=short

# Dengan coverage
pytest backend/tests/ --cov=apps --cov-report=html

# Parallel (lebih cepat)
pytest backend/tests/ -n auto
```
