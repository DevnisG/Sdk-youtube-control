# PowerShell script to call the shutdown endpoint

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/shutdown" -Method GET
    
    Write-Host "Shutdown request sent successfully."
    Write-Host "Server response: $($response.StatusCode) - $($response.StatusDescription)"
} 
catch {
    Write-Host "Error sending shutdown request: $_" -ForegroundColor Red
}
