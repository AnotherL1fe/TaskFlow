# ============================================================================
# apply.ps1 — последовательное применение db/00…08 на Windows
# Пример: .\db\apply.ps1 -DbName taskflow_sql
# ============================================================================
param(
    [string]$DbName = 'taskflow_db',
    [string]$DbHost = 'localhost',
    [int]$Port = 5432,
    [string]$DbUser = 'postgres',
    [string]$PgBin = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$root = Split-Path -Parent $PSScriptRoot

function Resolve-PgTool {
    param([string]$Name)

    if ($PgBin) {
        foreach ($candidate in @(
            (Join-Path $PgBin "$Name.exe"),
            (Join-Path $PgBin $Name)
        )) {
            if (Test-Path $candidate) {
                return $candidate
            }
        }
    }

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    throw "Не найден $Name. Укажите -PgBin или добавьте PostgreSQL bin в PATH."
}

$psql = Resolve-PgTool -Name 'psql'
$common = @('-h', $DbHost, '-p', "$Port", '-U', $DbUser, '-v', 'ON_ERROR_STOP=1')

Write-Host "==> 00_init.sql (database: $DbName)" -ForegroundColor Cyan
& $psql @common -d postgres -v "dbname=$DbName" -f (Join-Path $root 'db/00_init.sql')
if ($LASTEXITCODE -ne 0) { throw '00_init.sql failed' }

foreach ($file in @(
    '01_tables.sql',
    '02_indexes.sql',
    '03_constraints.sql',
    '04_views.sql',
    '05_functions.sql',
    '06_roles.sql',
    '07_seed.sql',
    '08_checks.sql'
)) {
    Write-Host "==> $file" -ForegroundColor Cyan
    & $psql @common -d $DbName -f (Join-Path $root "db/$file")
    if ($LASTEXITCODE -ne 0) {
        throw "$file failed"
    }
}

Write-Host "Готово: контур $DbName создан и проверен." -ForegroundColor Green
