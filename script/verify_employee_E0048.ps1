try {
  $login = Invoke-RestMethod -Uri 'http://localhost:5000/api/login' -Method Post -ContentType 'application/json' -Body '{"employeeCode":"E0048","password":"admin123"}'
  Write-Output 'LOGIN OK (E0048)'
  $token = $login.token
  $projects = Invoke-RestMethod -Uri 'http://localhost:5000/api/projects' -Headers @{ Authorization = "Bearer $token" }
  Write-Output ("PROJECTS COUNT (E0048): " + ($projects | Measure-Object).Count)
  $projects | Select-Object -First 40 | ConvertTo-Json -Depth 5 | Write-Output
} catch {
  Write-Output ('ERROR: ' + $_.Exception.Message)
}
