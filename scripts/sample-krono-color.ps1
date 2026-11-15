
Add-Type -AssemblyName System.Drawing
Get-ChildItem -LiteralPath 'C:\Users\vasko\OneDrive\Dokumente\SketchCut\public\kronospan' -Filter *.jpg | ForEach-Object {
  $bmp = [System.Drawing.Bitmap]::FromFile($_.FullName)
  try {
    $stepX = [Math]::Max(1, [int][Math]::Floor($bmp.Width / 12))
    $stepY = [Math]::Max(1, [int][Math]::Floor($bmp.Height / 12))
    $sr = 0; $sg = 0; $sb = 0; $n = 0
    for ($y = 0; $y -lt $bmp.Height; $y += $stepY) {
      for ($x = 0; $x -lt $bmp.Width; $x += $stepX) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.A -lt 16) { continue }
        if ($c.R -ge 247 -and $c.G -ge 247 -and $c.B -ge 247) { continue }
        $sr += $c.R; $sg += $c.G; $sb += $c.B; $n++
      }
    }
    if ($n -eq 0) {
      $c = $bmp.GetPixel([int]($bmp.Width / 2), [int]($bmp.Height / 2))
      $sr = $c.R; $sg = $c.G; $sb = $c.B; $n = 1
    }
    $hex = '{0:X2}{1:X2}{2:X2}' -f [int]($sr / $n), [int]($sg / $n), [int]($sb / $n)
    Write-Output ($_.BaseName + ' #' + $hex)
  } finally {
    $bmp.Dispose()
  }
}
