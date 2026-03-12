# App: Flow Engine

Parser dan validator untuk JSON flow schema. Melayani schema ke frontend via API.

## Isi

```
apps/flow_engine/
├── engine.py          ← FlowEngine class — parse, validate, serve
├── validators.py      ← JSON schema validation (jsonschema library)
├── views.py           ← GET /flow/schema/, GET /flow/ui/{screen}/
├── models.py          ← Tidak punya model sendiri (pakai BusinessType dari tenants)
├── cache.py           ← Cache helper — Redis TTL 1 jam
└── tests/
    ├── test_engine.py
    └── test_validators.py
```

## FlowEngine Class

```python
# engine.py
class FlowEngine:
    def __init__(self, business_type_code: str):
        self.schema = self._load_schema(business_type_code)  # dari Redis atau DB

    def get_flow(self) -> list[FlowStep]:
        """Return list step dari transaction_flow."""

    def get_extra_flow(self, flow_key: str) -> list[FlowStep]:
        """Return extra flow (misal: pickup untuk laundry)."""

    def validate_step_data(self, step_key: str, data: dict) -> bool:
        """Validasi data sesuai validation rules di step."""

    def get_business_rules(self) -> dict:
        """Return business_rules dari schema."""

    def get_offline_strategy(self) -> dict:
        """Return offline_strategy dari schema."""

    def get_version(self) -> str:
        """Return versi schema yang aktif."""
```

## Caching

Schema di-cache di Redis dengan TTL 1 jam. Invalidate cache saat admin update schema:

```python
from apps.flow_engine.cache import invalidate_schema_cache
invalidate_schema_cache(tenant_id)  # Clear cache setelah update
```
