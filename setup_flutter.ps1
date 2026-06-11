# ── Script d'installation Flutter + initialisation du projet mobile ──
# Exécuter dans PowerShell en tant qu'administrateur après téléchargement

$zip     = "C:\Users\HP\Downloads\flutter_windows_3.44.1-stable.zip"
$dest    = "C:\Users\HP\flutter"
$project = "C:\Users\HP\Desktop\collectApp\collectapp-mobile"

Write-Host "=== Installation Flutter ===" -ForegroundColor Cyan

# 1. Extraction
if (-not (Test-Path "$dest\bin\flutter.bat")) {
  Write-Host "Extraction du SDK..." -ForegroundColor Yellow
  $ProgressPreference = 'SilentlyContinue'
  Expand-Archive -Path $zip -DestinationPath "C:\Users\HP" -Force
  Write-Host "SDK extrait dans $dest" -ForegroundColor Green
} else {
  Write-Host "SDK déjà présent." -ForegroundColor Green
}

# 2. Ajouter au PATH utilisateur (permanent)
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$flutterBin  = "$dest\bin"
if ($currentPath -notlike "*$flutterBin*") {
  [Environment]::SetEnvironmentVariable("Path", "$currentPath;$flutterBin", "User")
  Write-Host "Flutter ajouté au PATH utilisateur." -ForegroundColor Green
}
$env:PATH = "$flutterBin;" + $env:PATH

# 3. flutter doctor
Write-Host "`n=== Flutter Doctor ===" -ForegroundColor Cyan
& "$dest\bin\flutter.bat" doctor

# 4. Copier le logo dans assets du projet mobile
$logoSrc = "C:\Users\HP\Desktop\collectApp\collectapp-admin\public\logo_sim.webp"
$logoDst = "$project\assets\images\logo_sim.webp"
if (Test-Path $logoSrc) {
  Copy-Item -Path $logoSrc -Destination $logoDst -Force
  Write-Host "Logo copié dans assets." -ForegroundColor Green
}

# 5. flutter pub get
Write-Host "`n=== Installation des dépendances ===" -ForegroundColor Cyan
Set-Location $project
& "$dest\bin\flutter.bat" pub get

Write-Host "`n=== Projet prêt ! ===" -ForegroundColor Green
Write-Host "Pour lancer sur émulateur Android : flutter run" -ForegroundColor White
Write-Host "Pour lancer sur appareil physique : flutter run -d <device_id>" -ForegroundColor White
