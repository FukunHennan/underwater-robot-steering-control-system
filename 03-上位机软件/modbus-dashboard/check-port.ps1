# Check whether port 4173 is occupied
$port = 4173
$processes = netstat -ano | Select-String ":$port"

if ($processes) {
    Write-Host "Port $port is occupied. Finding and stopping the process..."
    
    # Extract process ID
    foreach ($process in $processes) {
        $parts = $process -split '\s+'
        $processId = $parts[-1]
        
        try {
            # Get process information
            $proc = Get-Process -Id $processId -ErrorAction Stop
            Write-Host "Found process: $($proc.ProcessName) (PID: $processId)"
            
            # Stop process
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Host "Stopped process $($proc.ProcessName) (PID: $processId)"
        } catch {
            Write-Host "Failed to stop process ${processId}: $($_.Exception.Message)"
        }
    }
} else {
    Write-Host "Port $port is available"
}

Write-Host "Port check completed. Starting dev server..."
