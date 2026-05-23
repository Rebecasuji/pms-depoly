try {
  $emps = Invoke-RestMethod -Uri 'http://localhost:5000/api/employees' -Method Get
  Write-Output ('EMPLOYEES COUNT: ' + ($emps | Measure-Object).Count)
  $emps | Select-Object id, empCode, name, department | ConvertTo-Json -Depth 3 | Write-Output
} catch {
  Write-Output ('ERROR: ' + $_.Exception.Message)
}
