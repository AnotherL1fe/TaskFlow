# ============================================================================
# backup.ps1 — резервное копирование БД TaskFlow (Windows)
# Пример:
#   .\backup\backup.ps1 -DbName taskflow_sql -PgBin "C:\Program Files\PostgreSQL\15\bin"
# Пароль задаётся через PGPASSWORD или .pgpass.
# ============================================================================
param(
    [string]$DbName = 'taskflow_db',
    [string]$DbUser = 'postgres',
    [string]$DbHost = 'localhost',
    [int]$Port = 5432,
    [string]$OutDir = 'backups',
    [string]$PgBin = '',
    [int]$RetentionDays = 14,
    [switch]$SkipRoles
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

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

$pgDump = Resolve-PgTool -Name 'pg_dump'
$pgRestore = Resolve-PgTool -Name 'pg_restore'

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$dumpFile = Join-Path $OutDir "$DbName-$stamp.dump"

Write-Host "==> pg_dump: $DbName -> $dumpFile" -ForegroundColor Cyan
& $pgDump -h $DbHost -p $Port -U $DbUser -d $DbName `
    --format=custom --compress=6 --file=$dumpFile
if ($LASTEXITCODE -ne 0) {
    throw 'pg_dump завершился с ошибкой'
}

if (-not (Test-Path $dumpFile) -or (Get-Item $dumpFile).Length -le 0) {
    throw "Дамп не создан или пуст: $dumpFile"
}

# Проверка читаемости дампа без восстановления.
& $pgRestore --list $dumpFile | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'pg_restore --list не смог прочитать дамп'
}

$sizeMb = [math]::Round((Get-Item $dumpFile).Length / 1MB, 2)

if (-not $SkipRoles) {
    $pgDumpall = Resolve-PgTool -Name 'pg_dumpall'
    $rolesFile = Join-Path $OutDir "$DbName-$stamp.roles.sql"
    Write-Host "==> pg_dumpall --roles-only -> $rolesFile" -ForegroundColor Cyan
    & $pgDumpall -h $DbHost -p $Port -U $DbUser --roles-only --file=$rolesFile
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'Не удалось сохранить роли (нужны права суперпользователя)'
    }
}

# Retention: удаляем старые дампы этой же БД.
$threshold = (Get-Date).ToUniversalTime().AddDays(-$RetentionDays)
Get-ChildItem -Path $OutDir -Filter "$DbName-*.dump" -File |
    Where-Object { $_.LastWriteTimeUtc -lt $threshold } |
    ForEach-Object {
        Write-Host "==> retention: удалён $($_.Name)" -ForegroundColor DarkGray
        Remove-Item $_.FullName -Force
    }

Write-Host "Готово: $dumpFile ($sizeMb MB), retention ${RetentionDays} дн." -ForegroundColor Green
