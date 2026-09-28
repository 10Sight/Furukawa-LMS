param (
  [string]$InputPath,
  [string]$OutputDir
)

try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $pres = $ppt.Presentations.Open($InputPath, [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)

  if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
  }

  $slideCount = $pres.Slides.Count
  Write-Output "EXPORTING_SLIDES_COUNT:$slideCount"

  for ($i = 1; $i -le $slideCount; $i++) {
    $outFile = Join-Path $OutputDir "slide_$i.png"
    # Export slide at 1920x1080 for ultra-crisp display
    $pres.Slides.Item($i).Export($outFile, "PNG", 1920, 1080)
  }

  $pres.Close()
  $ppt.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($pres) | Out-Null
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()

  Write-Output "CONVERSION_SUCCESS"
} catch {
  Write-Error "CONVERSION_FAILED: $($_.Exception.Message)"
  exit 1
}
