# ============================================================================
# restore.ps1 — восстановление БД TaskFlow из custom-дампа (Windows)
# Пример:
#   .\backup\restore.ps1 -DumpFile .\backups\taskflow_sql-....dump `
#                        -TargetDb taskflow_restore -CreateDatabase
# ============================================================================
param(
    [Parameter(Mandatory = $true)]
    [string]$DumpFile,
    [string]$TargetDb = 'taskflow_restore',
    [string]$DbUser = 'postgres',
    [string]$DbHost = 'localhost',
    [int]$Port = 5432,
    [string]$PgBin = '',
    [switch]$CreateDatabase,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

if (-not (Test-Path $DumpFile)) {
    throw "Дамп не найден: $DumpFile"
}

if ($TargetDb -eq 'taskflow_db' -and -not $Force) {
    throw 'Восстановление поверх рабочей taskflow_db запрещено без -Force'
}

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
$pgRestore = Resolve-PgTool -Name 'pg_restore'
$common = @('-h', $DbHost, '-p', "$Port", '-U', $DbUser)

if ($CreateDatabase) {
    $exists = & $psql @common -d postgres -tAc `
        "SELECT 1 FROM pg_database WHERE datname = '$TargetDb'"
    if ($exists -ne '1') {
        Write-Host "==> CREATE DATABASE $TargetDb" -ForegroundColor Cyan
        & $psql @common -d postgres -v ON_ERROR_STOP=1 `
            -c "CREATE DATABASE `"$TargetDb`" OWNER taskflow ENCODING 'UTF8'"
        if ($LASTEXITCODE -ne 0) {
            throw 'Не удалось создать целевую БД'
        }
    }
}

Write-Host "==> pg_restore: $DumpFile -> $TargetDb" -ForegroundColor Cyan
& $pgRestore @common -d $TargetDb --clean --if-exists --exit-on-error $DumpFile
if ($LASTEXITCODE -ne 0) {
    throw 'pg_restore завершился с ошибкой'
}

Write-Host '==> Проверка восстановленных данных' -ForegroundColor Cyan
& $psql @common -d $TargetDb -v ON_ERROR_STOP=1 `
    -c 'SELECT count(*) AS users FROM lib.users; SELECT count(*) AS tasks FROM lib.tasks;'
if ($LASTEXITCODE -ne 0) {
    throw 'Проверка восстановленной БД не прошла'
}

Write-Host "Готово: $TargetDb восстановлена из $DumpFile" -ForegroundColor Green
