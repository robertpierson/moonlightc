# CI only: opens Windows' real credential box and checks who can type into it. Uses throwaway test text, no real secrets.
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force out | Out-Null
$root = (Get-Location).Path
$fails = @()
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

function Shot($name) {
  $b = [Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object Drawing.Bitmap $b.Width, $b.Height
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Location, [Drawing.Point]::Empty, $b.Size)
  $bmp.Save("$root\out\$name.png")
  $g.Dispose(); $bmp.Dispose()
}
# Runs a command at normal rights, the way MoonlightC runs on a real PC, and waits for it.
function Normal($cmd) {
  Remove-Item "$root\out\n.txt" -ErrorAction SilentlyContinue
  & .\Probe.exe medium "cmd /c $cmd > `"$root\out\n.txt`" 2>&1" 20000
  if (Test-Path "$root\out\n.txt") { Get-Content "$root\out\n.txt" }
}
function Send($lines) { Normal "powershell -NoProfile -ExecutionPolicy Bypass -File `"$root\apps\desktop\pin-helper\send.ps1`" -lines `"$($lines -join ',')`"" }

$a = New-ScheduledTaskAction -Execute "$root\MoonlightCInput.exe"
$p = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive
Register-ScheduledTask -TaskName 'MoonlightC PIN helper' -Action $a -Principal $p -Force | Out-Null

Write-Output "--- the credential box, opened at normal rights ---"
$file = "$root\out\typed.txt"
& .\Probe.exe medium "`"$root\Probe.exe`" prompt `"$file`""
Start-Sleep 6
$front = (& .\Probe.exe inspect)
$front
Normal "`"$root\Probe.exe`" inspect"
Shot 'box-open'
if ("$front" -notmatch 'CredentialUIBroker') { $fails += 'box did not come to the front' }

Write-Output "--- typing at normal rights: Windows should drop it ---"
& .\Probe.exe medium "`"$root\Probe.exe`" type normalapp" 5000
Start-Sleep 1
Shot 'after-normal-typing'

Write-Output "--- typing through the helper ---"
$user = 'helperuser'.ToCharArray() | ForEach-Object { "c $([int]$_)" }
$pass = '4821'.ToCharArray() | ForEach-Object { "c $([int]$_)" }
Send ($user + @('k 9 d', 'k 9 u') + $pass + @('k 13 d', 'k 13 u'))
Start-Sleep 3
$got = if (Test-Path $file) { Get-Content $file } else { 'box still open' }
Shot 'after-helper-typing'
"what the box received: $got"
if ($got -ne 'result=0 typed=helperuser|4821') { $fails += "box received: $got" }

Write-Output "--- refused when the box is not in front ---"
$r = Send @('c 65', 'k 65 d', 'k 17 d', 'k 91 d', 'm l d 10 10')
$r
if ("$r" -notmatch 'replies: 0x5') { $fails += "not refused: $r" }

Write-Output "--- the passkey box a website gets ---"
$pk = Start-Process .\Probe.exe -ArgumentList passkey -PassThru -RedirectStandardOutput "$root\out\passkey.txt"
Start-Sleep 12
& .\Probe.exe inspect
Get-Process | Where-Object { $_.MainWindowTitle -or $_.Name -match 'credential|webauth|hello|ngc' } | ForEach-Object { "$($_.Name): $($_.MainWindowTitle)" }
Shot 'passkey-box'
Send @('k 27 d', 'k 27 u')
Start-Sleep 3
if (-not $pk.HasExited) { Stop-Process $pk -Force }
Get-Content "$root\out\passkey.txt" -ErrorAction SilentlyContinue

if ($fails) { $fails | ForEach-Object { "FAILED: $_" }; exit 1 }
"all good"
exit 0
