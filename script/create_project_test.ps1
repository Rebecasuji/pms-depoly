try {
  $admin = Invoke-RestMethod -Uri 'http://localhost:5000/api/login' -Method Post -ContentType 'application/json' -Body '{"employeeCode":"E0001","password":"admin123"}'
  $token = $admin.token
  $payload = @{
    title = 'AUTOMATED TEST PURCHASE'
    department = @('Purchase')
    startDate = (Get-Date).ToString('yyyy-MM-dd')
    endDate = (Get-Date).AddDays(7).ToString('yyyy-MM-dd')
  } | ConvertTo-Json

  $create = Invoke-RestMethod -Uri 'http://localhost:5000/api/projects' -Method Post -ContentType 'application/json' -Body $payload -Headers @{ Authorization = "Bearer $token" }
  Write-Output ('CREATED PROJECT ID: ' + $create.id)

  # Now login as E0051 and fetch projects
  $login = Invoke-RestMethod -Uri 'http://localhost:5000/api/login' -Method Post -ContentType 'application/json' -Body '{"employeeCode":"E0051","password":"admin123"}'
  $token2 = $login.token
  $projects = Invoke-RestMethod -Uri 'http://localhost:5000/api/projects' -Headers @{ Authorization = "Bearer $token2" }
  Write-Output ('PROJECTS COUNT AFTER CREATE (E0051): ' + ($projects | Measure-Object).Count)
  $found = $projects | Where-Object { $_.title -eq 'AUTOMATED TEST PURCHASE' }
  if ($found) { Write-Output 'TEST PROJECT VISIBLE TO E0051' } else { Write-Output 'TEST PROJECT NOT VISIBLE' }
} catch {
  Write-Output ('ERROR: ' + $_.Exception.Message)
}
