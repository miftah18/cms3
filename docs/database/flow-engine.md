# Flow Engine

Flow Engine adalah jantung dari Server-Driven UI. Setiap business type mendefinisikan alur transaksi sebagai JSON schema yang disimpan di database dan dieksekusi oleh `FlowRenderer` di frontend.

## Konsep Dasar

```
Business Type JSON Schema
         ↓
   FlowEngine (backend)
         ↓ GET /flow/schema/
   FlowRenderer (frontend)
         ↓
ComponentRegistry.resolve(step.component)
         ↓
   <ProductGrid props={step.props} />
         ↓ emit event
   flowStore.nextStep()
```

## Struktur JSON Schema

```json
{
  "business_type": "coffee_shop",
  "version": "v1",
  "display_name": "Coffee Shop / Kafe",
  "icon": "coffee",

  "transaction_flow": [
    {
      "step": 1,
      "key": "select_items",
      "label": "Pilih Menu",
      "component": "product_grid",
      "props": {
        "show_search": true,
        "show_categories": true,
        "grid_columns": 3
      },
      "validation": { "min_items": 1 },
      "on_complete": "emit:ITEMS_SELECTED",
      "can_go_back": false
    }
  ],

  "extra_flows": {
    "pickup": { ... }
  },

  "business_rules": {
    "stock": { "track": true, "allow_negative": false },
    "customer": { "required": false },
    "shift": { "require_opening_cash": true }
  },

  "offline_strategy": {
    "cache_products": true,
    "max_cached_products": 500,
    "cache_ttl_hours": 8
  }
}
```

## Flow per Business Type

| Business Type | Steps | Extra Flows |
|---------------|-------|-------------|
| coffee_shop | 5 | — |
| laundry | 3 | pickup (3 step) |
| vehicle_dealer | 7 | — |
| clinic | 6 | — |
| retail_store | 4 | — |
| salon_barbershop | 4 | — |
| hotel_guesthouse | 4 | checkout (4 step) |
| restaurant | 5 | — |

## FlowEngine Class (Backend)

```python
# apps/flow_engine/engine.py
class FlowEngine:
    def __init__(self, business_type_code: str):
        self.schema = self._load_schema(business_type_code)

    def get_flow(self) -> list[FlowStep]:
        return [FlowStep(**s) for s in self.schema['transaction_flow']]

    def validate_step_data(self, step_key: str, data: dict) -> bool:
        step = self._get_step(step_key)
        validation = step.get('validation', {})
        if 'min_items' in validation:
            return len(data.get('items', [])) >= validation['min_items']
        return True

    def get_business_rules(self) -> dict:
        return self.schema.get('business_rules', {})

    def get_offline_strategy(self) -> dict:
        return self.schema.get('offline_strategy', {})
```

## FlowRenderer (Frontend)

```typescript
// components/FlowRenderer.tsx
export default function FlowRenderer() {
  const { schema, currentStep, nextStep } = useFlowStore()

  useEffect(() => {
    // Subscribe ke semua events yang bisa advance step
    const events = schema.transaction_flow.map(s => s.on_complete.replace('emit:', ''))
    events.forEach(event => {
      eventBus.on(event, (data) => {
        flowStore.setStepData(currentStep.key, data)
        nextStep()
      })
    })
    return () => events.forEach(e => eventBus.off(e))
  }, [currentStep])

  const Component = ComponentRegistry.resolve(currentStep.component)
  if (!Component) return <ErrorBoundary message={`Komponen tidak ditemukan: ${currentStep.component}`} />

  return (
    <>
      <StepWizard steps={schema.transaction_flow.map(s => s.label)} current={currentStep.step} />
      <ErrorBoundary>
        <Component
          {...currentStep.props}
          isOffline={!isOnline}
          onComplete={(data) => eventBus.emit(currentStep.on_complete.replace('emit:', ''), data)}
          onBack={currentStep.can_go_back ? prevStep : undefined}
        />
      </ErrorBoundary>
    </>
  )
}
```

## Versioning Flow

```
business_type: coffee_shop
├── v1  → flow 5 langkah (current)
├── v2  → flow 6 langkah + loyalty input (in development)
└── v3  → flow dengan table selection (future)

Tenant pilih versi di settings:
{
  "flow_version": "v1"   // tetap di v1 sampai tenant siap upgrade
}
```

## Seed Data

```bash
# Seed semua 8 business type
python manage.py seed_business_types

# Seed 1 business type saja
python manage.py seed_business_types --type coffee_shop

# Validasi schema yang ada
python manage.py validate_flow_schemas
```

## Referensi

- [Business Type Catalog](../business-types/README.md)
- [Component Registry](../components/README.md)
- [API: GET /flow/schema/](../api/endpoints.md#flow-engine)
