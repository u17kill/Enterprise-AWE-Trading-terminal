$ErrorActionPreference = 'Stop'

$project = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$node = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $node -PathType Leaf)) {
  $installedNode = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $installedNode) { throw 'Node.js is required to run the local preview.' }
  $node = $installedNode.Source
}

$next = Join-Path $project 'node_modules\next\dist\bin\next'
if (-not (Test-Path -LiteralPath $next -PathType Leaf)) { throw 'Install project dependencies before starting the local preview.' }

$logDirectory = Join-Path $project '.local'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
Set-Location -LiteralPath $project
$env:PATH = (Split-Path -Parent $node) + [IO.Path]::PathSeparator + $env:PATH

if (Get-NetTCPConnection -LocalPort 3101 -State Listen -ErrorAction SilentlyContinue) { exit 0 }

& $node $next build *>> (Join-Path $logDirectory 'preview-startup.log')
if ($LASTEXITCODE -ne 0) { throw "Next.js build failed with exit code $LASTEXITCODE." }

& $node $next start --hostname 127.0.0.1 --port 3101 *>> (Join-Path $logDirectory 'preview-startup.log')
if ($LASTEXITCODE -ne 0) { throw "Next.js server exited with code $LASTEXITCODE." }
