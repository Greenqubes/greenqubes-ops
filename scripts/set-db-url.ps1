# Set SUPABASE_DB_URL as System Environment Variable
# Run this script as Administrator

$dbUrl = "postgresql://postgres.<ref>:<password>@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"

Write-Host "Setting SUPABASE_DB_URL as System environment variable..."
[Environment]::SetEnvironmentVariable("SUPABASE_DB_URL", $dbUrl, "Machine")

Write-Host "✓ Environment variable set successfully"
Write-Host ""
Write-Host "To verify, run in a NEW PowerShell window:"
Write-Host "  [Environment]::GetEnvironmentVariable('SUPABASE_DB_URL', 'Machine')"
