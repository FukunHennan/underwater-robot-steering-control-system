# 检查端口5173是否被占用
$port = 5173
$processes = netstat -ano | Select-String ":$port"

if ($processes) {
    Write-Host "端口 $port 被占用，正在查找并停止占用进程..."
    
    # 提取进程ID
    foreach ($process in $processes) {
        $parts = $process -split '\s+'
        $pid = $parts[-1]
        
        try {
            # 获取进程信息
            $proc = Get-Process -Id $pid -ErrorAction Stop
            Write-Host "找到占用进程: $($proc.ProcessName) (PID: $pid)"
            
            # 停止进程
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "已成功停止进程 $($proc.ProcessName) (PID: $pid)"
        } catch {
            Write-Host "无法停止进程 $pid: $($_.Exception.Message)"
        }
    }
} else {
    Write-Host "端口 $port 未被占用，可以正常启动服务"
}

Write-Host "端口检查完成，准备启动开发服务器..."
