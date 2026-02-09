Start-Process npm -ArgumentList 'start' -NoNewWindow
Start-Sleep -Seconds 4
try {
  $login = Invoke-RestMethod -Uri 'http://localhost:5000/api/login' -Method Post -ContentType 'application/json' -Body '{"employeeCode":"E0001","password":"admin123"}'
  Write-Output 'LOGIN OK'
  $token = $login.token
  $projects = Invoke-RestMethod -Uri 'http://localhost:5000/api/projects' -Headers @{ Authorization = "Bearer $token" }
  Write-Output ("PROJECTS COUNT: " + ($projects | Measure-Object).Count)
  $projects | Select-Object -First 5 | ConvertTo-Json -Depth 5 | Write-Output
} catch {
  Write-Output ('ERROR: ' + $_.Exception.Message)
}
