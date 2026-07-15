param(
  [int]$StartIndex = 0,
  [int]$BatchSize = 10,
  [string]$DataPath = "src/data/pesquisadores.json",
  [string]$OutputDir = "public/fotos"
)

$ErrorActionPreference = 'Stop'
$today = (Get-Date).ToString('yyyy-MM-dd')

function Fold([string]$value) {
  if (-not $value) { return '' }
  return ($value.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '').ToLowerInvariant()
}

function Repair([string]$value) {
  if ($value.IndexOf([char]0x00C3) -lt 0 -and $value.IndexOf([char]0x00C2) -lt 0) { return $value }
  try { return [Text.Encoding]::UTF8.GetString([Text.Encoding]::GetEncoding(1252).GetBytes($value)) }
  catch { return $value }
}

function Slug([string]$value) { return ((Fold $value) -replace '[^a-z0-9]+', '-').Trim('-') }

function Get-ApiJson([string]$url) {
  try {
    return Invoke-RestMethod -Uri $url -Headers @{ 'User-Agent' = 'SenaiParceiros/1.0 public-media-batch' } -TimeoutSec 25
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 429) { throw 'RATE_LIMIT' }
    throw
  }
}

function Get-WikipediaPhoto([string]$name) {
  foreach ($lang in @('en', 'pt')) {
    try {
      $slug = [uri]::EscapeDataString(($name -replace ' ', '_'))
      $u = "https://$lang.wikipedia.org/api/rest_v1/page/summary/$slug"
      $j = Invoke-RestMethod -Uri $u -Headers @{ 'User-Agent' = 'SenaiParceiros/1.0 public-media-batch' } -TimeoutSec 15
      if ($j.type -eq 'standard' -and $j.thumbnail.source) {
        return [ordered]@{ image = $j.thumbnail.source; page = $j.content_urls.desktop.page; license = 'unknown'; attribution = "Wikipedia: $($j.title)" }
      }
    } catch { }
  }
  return $null
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$parsed = Get-Content $DataPath -Raw | ConvertFrom-Json
$researchers = if ($parsed -is [array]) { $parsed } else { @($parsed) }
$targets = @($researchers | Where-Object { -not $_.image } | Select-Object -Skip $StartIndex -First $BatchSize)
$downloaded = 0
$stopped = $false

foreach ($person in $targets) {
  $searchName = Repair $person.nome
  $foldedName = Fold $searchName
  $tokens = @($foldedName -split '[^a-z0-9]+' | Where-Object { $_.Length -ge 4 })
  if ($tokens.Count -lt 2) { continue }
  try {
    $wiki = Get-WikipediaPhoto $searchName
    if ($wiki) {
      $fileName = "researcher-$($person.id)-$(Slug $person.nome).jpg"
      Invoke-WebRequest -Uri $wiki.image -OutFile (Join-Path $OutputDir $fileName) -Headers @{ 'User-Agent' = 'SenaiParceiros/1.0' } -TimeoutSec 30
      $person.foto = "/fotos/$fileName"
      $person.image = [ordered]@{ path = "/fotos/$fileName"; sourceUrl = $wiki.page; sourceType = 'public-professional'; license = $wiki.license; attribution = $wiki.attribution; retrievedAt = $today; status = 'needs-review'; confidence = 70; reviewedAt = $null }
      $downloaded++
      Write-Output "DOWNLOADED_WIKIPEDIA $($person.id) $($person.nome) -> $fileName"
      Start-Sleep -Seconds 2
      continue
    }
    $query = [uri]::EscapeDataString($searchName)
    $searchUrl = "https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=$query&srnamespace=6&srlimit=10&format=json"
    $search = Get-ApiJson $searchUrl
    $hit = $search.query.search | Where-Object {
      $title = Fold $_.title
      ($tokens | Where-Object { $title -match [regex]::Escape($_) }).Count -ge 2
    } | Select-Object -First 1
    if (-not $hit) { Write-Output "NO_MATCH $($person.id) $($person.nome)"; Start-Sleep -Seconds 2; continue }

    $titleEncoded = [uri]::EscapeDataString($hit.title)
    $infoUrl = "https://commons.wikimedia.org/w/api.php?action=query&titles=$titleEncoded&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&format=json"
    $info = Get-ApiJson $infoUrl
    $page = @($info.query.pages.PSObject.Properties | ForEach-Object Value)[0]
    $imageInfo = $page.imageinfo[0]
    if (-not $imageInfo.thumburl) { Write-Output "NO_IMAGE $($person.id) $($person.nome)"; continue }

    $ext = [IO.Path]::GetExtension(([uri]$imageInfo.thumburl).AbsolutePath)
    if ($ext -notmatch '^\.(jpg|jpeg|png|webp)$') { $ext = '.jpg' }
    $fileName = "researcher-$($person.id)-$(Slug $person.nome)$ext"
    Invoke-WebRequest -Uri $imageInfo.thumburl -OutFile (Join-Path $OutputDir $fileName) -Headers @{ 'User-Agent' = 'SenaiParceiros/1.0' } -TimeoutSec 30
    $license = $imageInfo.extmetadata.LicenseShortName.value
    if (-not $license) { $license = 'unknown' }
    $person.foto = "/fotos/$fileName"
    $person.image = [ordered]@{
      path = "/fotos/$fileName"
      sourceUrl = "https://commons.wikimedia.org/wiki/$titleEncoded"
      sourceType = 'public-professional'
      license = [string]$license
      attribution = "Wikimedia Commons: $($hit.title)"
      retrievedAt = $today
      status = 'needs-review'
      confidence = 70
      reviewedAt = $null
    }
    $downloaded++
    Write-Output "DOWNLOADED $($person.id) $($person.nome) -> $fileName"
    Start-Sleep -Seconds 3
  } catch {
    if ($_.Exception.Message -eq 'RATE_LIMIT') { Write-Warning 'RATE_LIMIT: lote interrompido sem marcar imagens'; $stopped = $true; break }
    Write-Warning "SKIPPED $($person.id) $($person.nome): $($_.Exception.Message)"
  }
}

if ($downloaded -gt 0) {
  $tmp = "$DataPath.batch.tmp"
  $researchers | ConvertTo-Json -Depth 20 | Set-Content -Path $tmp -Encoding UTF8
  Move-Item -Force $tmp $DataPath
}
Write-Output "SUMMARY batch=$StartIndex/$BatchSize downloaded=$downloaded stopped=$stopped"
