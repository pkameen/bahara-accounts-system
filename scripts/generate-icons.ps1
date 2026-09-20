Add-Type -AssemblyName System.Drawing

$sourcePath = "src\assets\bahara.logo.jpg"
$destDir = "public"

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir
}

$resolvedSource = (Resolve-Path $sourcePath).Path
$origImg = [System.Drawing.Image]::FromFile($resolvedSource)

function Create-PwaIcon {
    param(
        [int]$Width,
        [int]$Height,
        [string]$OutName,
        [bool]$Maskable = $false
    )

    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background color matching brand dark theme #111111
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#111111"))
    $g.FillRectangle($brush, 0, 0, $Width, $Height)

    if ($Maskable) {
        # Safe area padding (80% of width/height)
        $paddingX = [int]($Width * 0.1)
        $paddingY = [int]($Height * 0.1)
        $targetW = [int]($Width * 0.8)
        $targetH = [int]($Height * 0.8)
        $g.DrawImage($origImg, $paddingX, $paddingY, $targetW, $targetH)
    } else {
        $g.DrawImage($origImg, 0, 0, $Width, $Height)
    }

    $outPath = Join-Path $destDir $OutName
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: $outPath ($Width x $Height)"
}

Create-PwaIcon -Width 192 -Height 192 -OutName "pwa-192x192.png"
Create-PwaIcon -Width 192 -Height 192 -OutName "pwa-192x192-maskable.png" -Maskable $true
Create-PwaIcon -Width 512 -Height 512 -OutName "pwa-512x512.png"
Create-PwaIcon -Width 512 -Height 512 -OutName "pwa-512x512-maskable.png" -Maskable $true
Create-PwaIcon -Width 180 -Height 180 -OutName "apple-touch-icon.png"
Create-PwaIcon -Width 64 -Height 64 -OutName "favicon.png"
Create-PwaIcon -Width 32 -Height 32 -OutName "favicon.ico"


$origImg.Dispose()
