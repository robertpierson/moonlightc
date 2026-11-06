# CI only: sets the helper up the way the app does, opens Windows' real credential box at normal rights, and checks who
# can type into it. Uses throwaway test text, no real secrets.
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
  & .\Probe.exe medium "cmd /c `"$cmd > `"$root\out\n.txt`" 2>&1`"" 30000
  if (Test-Path "$root\out\n.txt") { Get-Content "$root\out\n.txt" }
}
$node = (Get-Command node).Source
function Route($routeArgs) { Normal "`"$node`" `"$root\apps\desktop\pin-helper\ci-route.mjs`" $routeArgs" }
function Pipe($lines) { Normal "powershell -NoProfile -ExecutionPolicy Bypass -File `"$root\apps\desktop\pin-helper\send.ps1`" -lines `"$($lines -join ',')`"" }
function OpenBox($file) {
  Remove-Item $file -ErrorAction SilentlyContinue
  & .\Probe.exe medium "`"$root\Probe.exe`" prompt `"$file`""
  Start-Sleep 6
}

Write-Output "--- turn on, exactly as the app's button does ---"
& $node --input-type=module -e "import('file:///$($root -replace '\\','/')/apps/desktop/src/credential-box.mjs').then(m => process.stdout.write(m.installScript()))" | Set-Content "$root\install.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "$root\install.ps1"
$exe = "$env:ProgramFiles\MoonlightC PIN Helper\MoonlightCInput.exe"
if (-not (Test-Path $exe)) { $fails += 'helper was not built' }
if (Test-Path "$env:ProgramFiles\MoonlightC PIN Helper\MoonlightCInput.cs") { $fails += 'source left behind' }
# This runner's "normal" test token keeps its admin group, so the folder's permissions are read instead of tried.
$writers = (Get-Acl "$env:ProgramFiles\MoonlightC PIN Helper").Access | Where-Object { $_.AccessControlType -eq 'Allow' -and "$($_.FileSystemRights)" -match 'Write|Modify|FullControl|CreateFiles|AppendData' -and "$($_.IdentityReference)" -notmatch 'SYSTEM|Administrators|TrustedInstaller|CREATOR OWNER' }
"who else can change the helper's folder: $(if ($writers) { $writers.IdentityReference -join ', ' } else { 'nobody' })"
if ($writers) { $fails += "others can write to the helper folder: $($writers.IdentityReference -join ', ')" }

Write-Output "--- the credential box, opened at normal rights ---"
$file = "$root\out\typed.txt"
OpenBox $file
$front = (& .\Probe.exe inspect)
$front
Shot 'box-open'
if ("$front" -notmatch 'CredentialUIBroker.*integrity=0x200a') { $fails += "box not in front at the raised level: $front" }

Write-Output "--- typing at normal rights: Windows should drop it ---"
& .\Probe.exe medium "`"$root\Probe.exe`" type normalapp" 5000
Start-Sleep 1
Shot 'after-normal-typing'

Write-Output "--- typing the way MoonlightC does ---"
Route 'type-and-enter'
Start-Sleep 3
$got = if (Test-Path $file) { Get-Content $file } else { 'box still open' }
Shot 'after-typing'
"what the box received: $got"
if ($got -ne 'result=0 typed=routeduser|73') { $fails += "box received: $got" }

Write-Output "--- clicking Cancel the way MoonlightC does ---"
OpenBox $file
Route 'click 614 519'
Start-Sleep 3
$got = if (Test-Path $file) { Get-Content $file } else { 'box still open' }
"box result: $got"
if ($got -notmatch 'result=1223') { $fails += "click did not reach Cancel: $got" }

Write-Output "--- nothing is sent when the box is not in front ---"
$r = Route 'not-in-front'
$r
if ("$r" -notmatch 'handled: false') { $fails += "sent with no box: $r" }
$r = Pipe @('c 65', 'k 65 d', 'k 17 d', 'k 91 d', 'm l d 10 10')
$r
if ("$r" -notmatch 'replies: 0x5') { $fails += "helper not refusing: $r" }

Write-Output "--- the box in front, with Ctrl, Alt and Windows keys ---"
OpenBox $file
$r = Pipe @('k 17 d', 'k 18 d', 'k 91 d', 'k 112 d')
$r
if ("$r" -notmatch 'replies: 0x4') { $fails += "helper took a blocked key: $r" }
Pipe @('k 27 d', 'k 27 u') | Out-Null
Start-Sleep 2

Write-Output "--- the passkey box a website gets ---"
$pk = Start-Process .\Probe.exe -ArgumentList passkey -PassThru -RedirectStandardOutput "$root\out\passkey.txt"
Start-Sleep 12
Get-Process | Where-Object { $_.Name -match 'credentialuibroker' } | ForEach-Object { "$($_.Name): $($_.MainWindowTitle)" }
Shot 'passkey-box'
if (-not $pk.HasExited) { Stop-Process $pk -Force }

Write-Output "--- turn off, exactly as the app's button does ---"
& $node --input-type=module -e "import('file:///$($root -replace '\\','/')/apps/desktop/src/credential-box.mjs').then(m => process.stdout.write(m.removeScript()))" | Set-Content "$root\remove.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "$root\remove.ps1"
if (Test-Path $exe) { $fails += 'helper still there after turning off' }
if (Get-ScheduledTask -TaskName 'MoonlightC PIN helper' -ErrorAction SilentlyContinue) { $fails += 'task still there after turning off' }

if ($fails) { $fails | ForEach-Object { "FAILED: $_" }; exit 1 }
"all good"
exit 0
