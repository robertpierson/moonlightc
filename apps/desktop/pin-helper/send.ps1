# CI only: what MoonlightC does at normal rights. Asks Windows to start the helper, then talks to it over the pipe.
param($lines)
schtasks /run /tn "MoonlightC PIN helper" | Out-Null
"schtasks exit $LASTEXITCODE"
Start-Sleep 2
$c = New-Object IO.Pipes.NamedPipeClientStream('.', 'moonlightc-credential-input', 'InOut')
try { $c.Connect(5000) } catch { "pipe refused: $($_.Exception.Message)"; exit }
$w = New-Object IO.StreamWriter($c); $w.AutoFlush = $true; $w.NewLine = "`n"
$r = New-Object IO.StreamReader($c)
$out = foreach ($l in ($lines -split ',')) { $w.WriteLine($l); $r.ReadLine() }
$c.Dispose()
"replies: " + (($out | Group-Object | ForEach-Object { "$($_.Name)x$($_.Count)" }) -join ' ')
