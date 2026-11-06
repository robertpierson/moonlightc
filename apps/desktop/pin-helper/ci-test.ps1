# CI only: opens Windows' real credential box and checks who can type into it. Uses throwaway test text, no real secrets.
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force out | Out-Null
$root = (Get-Location).Path
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

function Shot($name) {
  $b = [Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object Drawing.Bitmap $b.Width, $b.Height
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($b.Location, [Drawing.Point]::Empty, $b.Size)
  $bmp.Save("$root\out\$name.png")
  $g.Dispose(); $bmp.Dispose()
}
# A normal-rights process, the way MoonlightC runs on a real PC.
function Normal($exeArgs) {
  $cmd = "cmd /c `"`"$root\Probe.exe`" $exeArgs > `"$root\out\normal.txt`" 2>&1`""
  runas /trustlevel:0x20000 $cmd | Out-Null
  Start-Sleep 2
  if (Test-Path "$root\out\normal.txt") { Get-Content "$root\out\normal.txt" }
}

Write-Output "--- the credential box, opened at normal rights ---"
$file = "$root\out\typed.txt"
runas /trustlevel:0x20000 "`"$root\Probe.exe`" prompt `"$file`"" | Out-Null
Start-Sleep 6
& .\Probe.exe inspect
Normal 'inspect'
Shot 'box-open'

Write-Output "--- typing at normal rights: should be ignored ---"
Normal 'type normalapp'
Start-Sleep 1
Shot 'after-normal-typing'

Write-Output "--- typing through the helper, started from a scheduled task with highest rights ---"
$a = New-ScheduledTaskAction -Execute "$root\MoonlightCInput.exe"
$p = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive
Register-ScheduledTask -TaskName 'MoonlightC PIN helper' -Action $a -Principal $p -Force | Out-Null
Start-ScheduledTask -TaskName 'MoonlightC PIN helper'
Start-Sleep 2
function Pipe($lines) {
  $c = New-Object IO.Pipes.NamedPipeClientStream('.', 'moonlightc-credential-input', 'InOut')
  $c.Connect(5000)
  $w = New-Object IO.StreamWriter($c); $w.AutoFlush = $true; $w.NewLine = "`n"
  $r = New-Object IO.StreamReader($c)
  $out = foreach ($l in $lines) { $w.WriteLine($l); $r.ReadLine() }
  $c.Dispose()
  "replies: " + (($out | Group-Object | ForEach-Object { "$($_.Name)x$($_.Count)" }) -join ' ')
}
$user = 'helperuser'.ToCharArray() | ForEach-Object { "c $([int]$_)" }
$tab = @('k 9 d', 'k 9 u')
$pass = '4821'.ToCharArray() | ForEach-Object { "c $([int]$_)" }
Pipe ($user + $tab + $pass)
Start-Sleep 1
Shot 'after-helper-typing'
Start-Sleep 1
Start-ScheduledTask -TaskName 'MoonlightC PIN helper'
Start-Sleep 2
Pipe @('k 13 d', 'k 13 u')
Start-Sleep 3
Write-Output "what the box received: $(if (Test-Path $file) { Get-Content $file } else { 'box still open' })"

Write-Output "--- refused when the box is not in front ---"
Start-Sleep 1
Start-ScheduledTask -TaskName 'MoonlightC PIN helper'
Start-Sleep 2
Pipe @('c 65', 'k 65 d', 'k 17 d', 'm l d 10 10')

Write-Output "--- the passkey box a website gets ---"
$pk = Start-Process .\Probe.exe -ArgumentList passkey -PassThru -RedirectStandardOutput "$root\out\passkey.txt"
Start-Sleep 8
& .\Probe.exe inspect
Shot 'passkey-box'
Start-ScheduledTask -TaskName 'MoonlightC PIN helper'
Start-Sleep 2
Pipe @('k 27 d', 'k 27 u')
Start-Sleep 3
if (-not $pk.HasExited) { Stop-Process $pk -Force }
Get-Content "$root\out\passkey.txt" -ErrorAction SilentlyContinue
exit 0
