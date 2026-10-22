# Baut aus den Quelldateien eine einzelne HTML-Datei fuers iPhone.
# Aufruf: .\build.ps1                -> ls-dashboard-aktuell.html (Projektordner + Downloads)
#                                       und docs\index.html (Online-Version ueber GitHub Pages)
#         .\build.ps1 -Version v1.1  -> versionen\v1.1\ (schreibgeschuetzt) + Downloads
param([string]$Version)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$html = Get-Content -LiteralPath (Join-Path $root 'camper-dashboard.html') -Raw
$js = Get-Content -LiteralPath (Join-Path $root 'camper-bluetooth.js') -Raw
$bundle = $html.Replace('<script src="camper-bluetooth.js"></script>', "<script>`n$js`n</script>").Replace('und die Datei camper-bluetooth.js pruefen', 'pruefen')
if ($bundle -match 'src="camper-bluetooth.js"') { throw 'Skript konnte nicht eingebettet werden.' }
$downloads = [Environment]::ExpandEnvironmentVariables((Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders').'{374DE290-123F-4565-9164-39C4925E467B}')
if ($Version) {
  $dir = Join-Path $root "versionen\$Version"
  if (Test-Path $dir) { throw "Version $Version existiert bereits." }
  New-Item -ItemType Directory -Path $dir | Out-Null
  $name = "ls-dashboard-$Version.html"
  $target = Join-Path $dir $name
  Copy-Item -LiteralPath (Join-Path $root 'camper-dashboard.html'), (Join-Path $root 'camper-bluetooth.js') -Destination $dir
} else {
  $name = 'ls-dashboard-aktuell.html'
  $target = Join-Path $root $name
  $docs = New-Item -ItemType Directory -Force -Path (Join-Path $root 'docs')
  [IO.File]::WriteAllText((Join-Path $docs.FullName 'index.html'), $bundle, [Text.UTF8Encoding]::new($false))
}
[IO.File]::WriteAllText($target, $bundle, [Text.UTF8Encoding]::new($false))
Copy-Item -LiteralPath $target -Destination (Join-Path $downloads $name) -Force
if ($Version) { Get-ChildItem -LiteralPath $dir -File | ForEach-Object { $_.IsReadOnly = $true } }
Write-Output "Gebaut: $target"
Write-Output "Kopie: $(Join-Path $downloads $name)"
