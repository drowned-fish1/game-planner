Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot

function New-Color {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Hex,
    [int]$Alpha = 255
  )

  $baseColor = [System.Drawing.ColorTranslator]::FromHtml($Hex)
  return [System.Drawing.Color]::FromArgb($Alpha, $baseColor.R, $baseColor.G, $baseColor.B)
}

function New-RoundedRectPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2

  if ($Radius -le 0) {
    $path.AddRectangle([System.Drawing.RectangleF]::new($X, $Y, $Width, $Height))
    return $path
  }

  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-RoundedRect {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Brush]$Brush,
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-RoundedRectPath -X $X -Y $Y -Width $Width -Height $Height -Radius $Radius
  try {
    $Graphics.FillPath($Brush, $path)
  } finally {
    $path.Dispose()
  }
}

function Draw-RoundedRectOutline {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Pen]$Pen,
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-RoundedRectPath -X $X -Y $Y -Width $Width -Height $Height -Radius $Radius
  try {
    $Graphics.DrawPath($Pen, $path)
  } finally {
    $path.Dispose()
  }
}

function Fill-Circle {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Brush]$Brush,
    [float]$X,
    [float]$Y,
    [float]$Diameter
  )

  $Graphics.FillEllipse($Brush, $X, $Y, $Diameter, $Diameter)
}

function Draw-Background {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Size
  )

  $backgroundBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.PointF]::new(0, 0),
    [System.Drawing.PointF]::new($Size, $Size),
    (New-Color '#0f172a'),
    (New-Color '#134e4a')
  )

  try {
    $Graphics.FillRectangle($backgroundBrush, 0, 0, $Size, $Size)
  } finally {
    $backgroundBrush.Dispose()
  }

  $glowBrushA = [System.Drawing.SolidBrush]::new((New-Color '#34d399' 48))
  $glowBrushB = [System.Drawing.SolidBrush]::new((New-Color '#f59e0b' 38))
  $gridPen = [System.Drawing.Pen]::new((New-Color '#e2e8f0' 20), [Math]::Max($Size / 160.0, 1))
  $framePen = [System.Drawing.Pen]::new((New-Color '#ffffff' 28), [Math]::Max($Size / 86.0, 1.5))

  try {
    $Graphics.FillEllipse($glowBrushA, $Size * 0.52, -$Size * 0.14, $Size * 0.62, $Size * 0.62)
    $Graphics.FillEllipse($glowBrushB, -$Size * 0.18, $Size * 0.64, $Size * 0.48, $Size * 0.48)

    $gridStep = $Size / 8.0
    for ($offset = $gridStep; $offset -lt $Size; $offset += $gridStep) {
      $Graphics.DrawLine($gridPen, $offset, 0, $offset, $Size)
      $Graphics.DrawLine($gridPen, 0, $offset, $Size, $offset)
    }

    Draw-RoundedRectOutline -Graphics $Graphics -Pen $framePen -X ($Size * 0.03) -Y ($Size * 0.03) -Width ($Size * 0.94) -Height ($Size * 0.94) -Radius ($Size * 0.18)
  } finally {
    $glowBrushA.Dispose()
    $glowBrushB.Dispose()
    $gridPen.Dispose()
    $framePen.Dispose()
  }
}

function Draw-BoardCore {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Size
  )

  $shadowBrush = [System.Drawing.SolidBrush]::new((New-Color '#020617' 68))
  $boardBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.PointF]::new(0, $Size * 0.15),
    [System.Drawing.PointF]::new($Size, $Size * 0.92),
    (New-Color '#f8fafc'),
    (New-Color '#dbeafe')
  )
  $tabBrush = [System.Drawing.SolidBrush]::new((New-Color '#0f172a'))
  $tabAccentBrush = [System.Drawing.SolidBrush]::new((New-Color '#34d399'))
  $boardStroke = [System.Drawing.Pen]::new((New-Color '#0f172a' 60), [Math]::Max($Size / 110.0, 1.5))
  $noteShadowBrush = [System.Drawing.SolidBrush]::new((New-Color '#0f172a' 20))
  $emeraldBrush = [System.Drawing.SolidBrush]::new((New-Color '#10b981'))
  $emeraldDarkBrush = [System.Drawing.SolidBrush]::new((New-Color '#059669'))
  $lineBrush = [System.Drawing.SolidBrush]::new((New-Color '#475569'))
  $greenMarkerBrush = [System.Drawing.SolidBrush]::new((New-Color '#10b981'))
  $amberMarkerBrush = [System.Drawing.SolidBrush]::new((New-Color '#f59e0b'))
  $cyanMarkerBrush = [System.Drawing.SolidBrush]::new((New-Color '#38bdf8'))
  $sparkBrush = [System.Drawing.SolidBrush]::new((New-Color '#f8fafc' 218))

  $boardX = $Size * 0.18
  $boardY = $Size * 0.17
  $boardWidth = $Size * 0.64
  $boardHeight = $Size * 0.66
  $boardRadius = $Size * 0.11

  try {
    Fill-RoundedRect -Graphics $Graphics -Brush $shadowBrush -X ($boardX + $Size * 0.018) -Y ($boardY + $Size * 0.025) -Width $boardWidth -Height $boardHeight -Radius $boardRadius
    Fill-RoundedRect -Graphics $Graphics -Brush $boardBrush -X $boardX -Y $boardY -Width $boardWidth -Height $boardHeight -Radius $boardRadius
    Draw-RoundedRectOutline -Graphics $Graphics -Pen $boardStroke -X $boardX -Y $boardY -Width $boardWidth -Height $boardHeight -Radius $boardRadius

    Fill-RoundedRect -Graphics $Graphics -Brush $tabBrush -X ($Size * 0.35) -Y ($Size * 0.11) -Width ($Size * 0.30) -Height ($Size * 0.09) -Radius ($Size * 0.03)
    Fill-RoundedRect -Graphics $Graphics -Brush $tabAccentBrush -X ($Size * 0.425) -Y ($Size * 0.135) -Width ($Size * 0.15) -Height ($Size * 0.024) -Radius ($Size * 0.012)

    $dPadSize = $Size * 0.11
    $dPadRadius = $Size * 0.026
    $dPadGap = $Size * 0.016
    $dPadCenterX = $Size * 0.36
    $dPadCenterY = $Size * 0.51

    $dPadRects = @(
      @{ X = $dPadCenterX - $dPadSize / 2; Y = $dPadCenterY - $dPadSize / 2; Brush = $emeraldDarkBrush },
      @{ X = $dPadCenterX - $dPadSize / 2; Y = $dPadCenterY - $dPadSize - $dPadGap; Brush = $emeraldBrush },
      @{ X = $dPadCenterX - $dPadSize / 2; Y = $dPadCenterY + $dPadGap; Brush = $emeraldBrush },
      @{ X = $dPadCenterX - $dPadSize - $dPadGap; Y = $dPadCenterY - $dPadSize / 2; Brush = $emeraldBrush },
      @{ X = $dPadCenterX + $dPadGap; Y = $dPadCenterY - $dPadSize / 2; Brush = $emeraldBrush }
    )

    foreach ($rect in $dPadRects) {
      Fill-RoundedRect -Graphics $Graphics -Brush $noteShadowBrush -X ($rect.X + $Size * 0.01) -Y ($rect.Y + $Size * 0.01) -Width $dPadSize -Height $dPadSize -Radius $dPadRadius
      Fill-RoundedRect -Graphics $Graphics -Brush $rect.Brush -X $rect.X -Y $rect.Y -Width $dPadSize -Height $dPadSize -Radius $dPadRadius
    }

    $lineConfigs = @(
      @{ Marker = $greenMarkerBrush; Y = $Size * 0.36; Width = $Size * 0.18 },
      @{ Marker = $amberMarkerBrush; Y = $Size * 0.49; Width = $Size * 0.15 },
      @{ Marker = $cyanMarkerBrush; Y = $Size * 0.62; Width = $Size * 0.20 }
    )

    foreach ($config in $lineConfigs) {
      Fill-Circle -Graphics $Graphics -Brush $config.Marker -X ($Size * 0.57) -Y ($config.Y - $Size * 0.022) -Diameter ($Size * 0.044)
      Fill-RoundedRect -Graphics $Graphics -Brush $lineBrush -X ($Size * 0.63) -Y ($config.Y - $Size * 0.018) -Width $config.Width -Height ($Size * 0.036) -Radius ($Size * 0.018)
    }

    $starPoints = [System.Drawing.PointF[]]@(
      [System.Drawing.PointF]::new($Size * 0.71, $Size * 0.27),
      [System.Drawing.PointF]::new($Size * 0.734, $Size * 0.31),
      [System.Drawing.PointF]::new($Size * 0.774, $Size * 0.334),
      [System.Drawing.PointF]::new($Size * 0.734, $Size * 0.358),
      [System.Drawing.PointF]::new($Size * 0.71, $Size * 0.398),
      [System.Drawing.PointF]::new($Size * 0.686, $Size * 0.358),
      [System.Drawing.PointF]::new($Size * 0.646, $Size * 0.334),
      [System.Drawing.PointF]::new($Size * 0.686, $Size * 0.31)
    )
    $Graphics.FillPolygon($sparkBrush, $starPoints)
  } finally {
    $shadowBrush.Dispose()
    $boardBrush.Dispose()
    $tabBrush.Dispose()
    $tabAccentBrush.Dispose()
    $boardStroke.Dispose()
    $noteShadowBrush.Dispose()
    $emeraldBrush.Dispose()
    $emeraldDarkBrush.Dispose()
    $lineBrush.Dispose()
    $greenMarkerBrush.Dispose()
    $amberMarkerBrush.Dispose()
    $cyanMarkerBrush.Dispose()
    $sparkBrush.Dispose()
  }
}

function New-IconBitmap {
  param(
    [int]$Size,
    [bool]$WithBackground,
    [bool]$CircleMask
  )

  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  try {
    if ($WithBackground) {
      Draw-Background -Graphics $graphics -Size $Size
    }

    Draw-BoardCore -Graphics $graphics -Size $Size
  } finally {
    $graphics.Dispose()
  }

  if (-not $CircleMask) {
    return $bitmap
  }

  $masked = [System.Drawing.Bitmap]::new($Size, $Size)
  $maskGraphics = [System.Drawing.Graphics]::FromImage($masked)
  $maskGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $maskGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $maskGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $maskGraphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $maskGraphics.Clear([System.Drawing.Color]::Transparent)

  try {
    $clip = [System.Drawing.Drawing2D.GraphicsPath]::new()
    try {
      $clip.AddEllipse(0, 0, $Size, $Size)
      $maskGraphics.SetClip($clip)
      $maskGraphics.DrawImage($bitmap, 0, 0, $Size, $Size)
    } finally {
      $clip.Dispose()
    }
  } finally {
    $maskGraphics.Dispose()
    $bitmap.Dispose()
  }

  return $masked
}

function Save-Png {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$Path
  )

  $directory = Split-Path -Parent $Path
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
  }

  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Write-Ico {
  param(
    [string]$Path,
    [int[]]$Sizes
  )

  $entries = New-Object System.Collections.Generic.List[object]
  try {
    foreach ($size in $Sizes) {
      $bitmap = New-IconBitmap -Size $size -WithBackground $true -CircleMask $false
      try {
        $stream = [System.IO.MemoryStream]::new()
        try {
          $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
          $entries.Add([pscustomobject]@{
            Size = $size
            Data = $stream.ToArray()
          }) | Out-Null
        } finally {
          $stream.Dispose()
        }
      } finally {
        $bitmap.Dispose()
      }
    }

    $directory = Split-Path -Parent $Path
    if (-not (Test-Path $directory)) {
      New-Item -ItemType Directory -Path $directory | Out-Null
    }

    $fileStream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Create)
    $writer = [System.IO.BinaryWriter]::new($fileStream)
    try {
      $writer.Write([UInt16]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]$entries.Count)

      $offset = 6 + (16 * $entries.Count)
      foreach ($entry in $entries) {
        $iconDimension = if ($entry.Size -ge 256) { 0 } else { [byte]$entry.Size }
        $writer.Write([byte]$iconDimension)
        $writer.Write([byte]$iconDimension)
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]32)
        $writer.Write([UInt32]$entry.Data.Length)
        $writer.Write([UInt32]$offset)
        $offset += $entry.Data.Length
      }

      foreach ($entry in $entries) {
        $writer.Write($entry.Data)
      }
    } finally {
      $writer.Dispose()
      $fileStream.Dispose()
    }
  } finally {
    $entries.Clear()
  }
}

$brandingDir = Join-Path $projectRoot 'assets\branding'
$publicDir = Join-Path $projectRoot 'public'
$androidResDir = Join-Path $projectRoot 'android\app\src\main\res'

$preview = New-IconBitmap -Size 1024 -WithBackground $true -CircleMask $false
try {
  Save-Png -Bitmap $preview -Path (Join-Path $brandingDir 'app-icon-1024.png')
} finally {
  $preview.Dispose()
}

$publicIcon = New-IconBitmap -Size 512 -WithBackground $true -CircleMask $false
try {
  Save-Png -Bitmap $publicIcon -Path (Join-Path $publicDir 'icon.png')
} finally {
  $publicIcon.Dispose()
}

Write-Ico -Path (Join-Path $publicDir 'icon.ico') -Sizes @(256, 128, 64, 48, 32, 16)

$launcherSizes = @{
  'mdpi' = 48
  'hdpi' = 72
  'xhdpi' = 96
  'xxhdpi' = 144
  'xxxhdpi' = 192
}

$foregroundSizes = @{
  'mdpi' = 108
  'hdpi' = 162
  'xhdpi' = 216
  'xxhdpi' = 324
  'xxxhdpi' = 432
}

foreach ($density in $launcherSizes.Keys) {
  $bitmap = New-IconBitmap -Size $launcherSizes[$density] -WithBackground $true -CircleMask $false
  try {
    Save-Png -Bitmap $bitmap -Path (Join-Path $androidResDir ("mipmap-{0}\ic_launcher.png" -f $density))
  } finally {
    $bitmap.Dispose()
  }

  $roundBitmap = New-IconBitmap -Size $launcherSizes[$density] -WithBackground $true -CircleMask $true
  try {
    Save-Png -Bitmap $roundBitmap -Path (Join-Path $androidResDir ("mipmap-{0}\ic_launcher_round.png" -f $density))
  } finally {
    $roundBitmap.Dispose()
  }
}

foreach ($density in $foregroundSizes.Keys) {
  $bitmap = New-IconBitmap -Size $foregroundSizes[$density] -WithBackground $false -CircleMask $false
  try {
    Save-Png -Bitmap $bitmap -Path (Join-Path $androidResDir ("mipmap-{0}\ic_launcher_foreground.png" -f $density))
  } finally {
    $bitmap.Dispose()
  }
}

Write-Output 'Generated project icons for Electron and Android.'
