#!/usr/bin/env bash
# Generate Python pydantic models from the canonical OpenAPI spec.
# Requires: datamodel-code-generator (installed via `pip install -r apps/api/requirements-dev.txt`)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SPEC="$ROOT/packages/shared-types/openapi.yaml"
OUT="$ROOT/apps/api/app/models/generated.py"
mkdir -p "$(dirname "$OUT")"
datamodel-codegen \
  --input "$SPEC" \
  --input-file-type openapi \
  --output "$OUT" \
  --output-model-type pydantic_v2.BaseModel \
  --target-python-version 3.12 \
  --use-standard-collections \
  --use-union-operator \
  --use-schema-description \
  --field-constraints \
  --enum-field-as-literal one \
  --use-double-quotes \
  --disable-timestamp
echo "Generated $OUT"
