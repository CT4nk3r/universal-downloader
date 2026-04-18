# Generate Python pydantic models from the canonical OpenAPI spec (Windows).
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\.."
$spec = Join-Path $root 'packages\shared-types\openapi.yaml'
$out  = Join-Path $root 'apps\api\app\models\generated.py'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
datamodel-codegen `
  --input $spec `
  --input-file-type openapi `
  --output $out `
  --output-model-type pydantic_v2.BaseModel `
  --target-python-version 3.12 `
  --use-standard-collections `
  --use-union-operator `
  --use-schema-description `
  --field-constraints `
  --enum-field-as-literal one `
  --use-double-quotes `
  --disable-timestamp
Write-Host "Generated $out"
