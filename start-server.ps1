param(
  [int]$Port = 5001
)

$requestReadTimeoutMilliseconds = 5000
$responseWriteTimeoutMilliseconds = 5000

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
}

<#
.SYNOPSIS
Sendet eine vollständige HTTP-Antwort an den verbundenen Browser.
.PARAMETER Stream
Der beschreibbare Netzwerkstream der aktuellen Verbindung.
.PARAMETER StatusCode
Der numerische HTTP-Statuscode.
.PARAMETER ReasonPhrase
Die zum Statuscode gehörende Kurzbeschreibung.
.PARAMETER ContentType
Der MIME-Typ des Antwortinhalts.
.PARAMETER Body
Der bereits als Bytefolge codierte Antwortinhalt.
.OUTPUTS
Keine Rückgabe.
#>
function Send-HttpResponse {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$ReasonPhrase,
    [string]$ContentType,
    [byte[]]$Body
  )

  $header = "HTTP/1.1 $StatusCode $ReasonPhrase`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  $Stream.Write($Body, 0, $Body.Length)
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$resolvedRoot = [System.IO.Path]::GetFullPath($root)
$rootPrefix = $resolvedRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)

try {
  $listener.Start()
  Write-Host "carshareOrNot läuft auf http://localhost:$Port/"
  Write-Host "Zum Beenden Strg+C drücken."

  while ($true) {
    $client = $listener.AcceptTcpClient()
    $client.NoDelay = $true
    $reader = $null

    try {
    $stream = $client.GetStream()
    # Verhindert, dass unvollständige oder absichtlich langsame Requests den
    # einzigen Entwicklungsserver-Thread dauerhaft blockieren.
    $client.ReceiveTimeout = $requestReadTimeoutMilliseconds
    $client.SendTimeout = $responseWriteTimeoutMilliseconds
    $stream.ReadTimeout = $requestReadTimeoutMilliseconds
    $stream.WriteTimeout = $responseWriteTimeoutMilliseconds
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()

      # Browser können eine vorab geöffnete Verbindung ohne HTTP-Anfrage schließen.
      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      $headerLine = $reader.ReadLine()
      while ($null -ne $headerLine -and $headerLine.Length -gt 0) {
        $headerLine = $reader.ReadLine()
      }
      # EOF vor der Leerzeile bedeutet, dass die Anfrage unvollständig blieb.
      if ($null -eq $headerLine) {
        continue
      }

      $requestParts = $requestLine.Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)
      if ($requestParts.Length -lt 2 -or $requestParts[0] -ne "GET") {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("400 - Ungültige Anfrage")
        Send-HttpResponse -Stream $stream -StatusCode 400 -ReasonPhrase "Bad Request" -ContentType "text/plain; charset=utf-8" -Body $bytes
        continue
      }

      $requestTarget = $requestParts[1]
      if ([string]::IsNullOrWhiteSpace($requestTarget)) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("400 - Ungültige Anfrage")
        Send-HttpResponse -Stream $stream -StatusCode 400 -ReasonPhrase "Bad Request" -ContentType "text/plain; charset=utf-8" -Body $bytes
        continue
      }

      $requestTarget = $requestTarget.Split([char]"?")[0]
      if ($null -eq $requestTarget) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("400 - Ungültige Anfrage")
        Send-HttpResponse -Stream $stream -StatusCode 400 -ReasonPhrase "Bad Request" -ContentType "text/plain; charset=utf-8" -Body $bytes
        continue
      }
      $requestPath = [System.Uri]::UnescapeDataString($requestTarget).TrimStart([char]"/")
      if ([string]::IsNullOrWhiteSpace($requestPath)) {
        $requestPath = "index.html"
      }

      $relativePath = $requestPath.Replace([char]"/", [System.IO.Path]::DirectorySeparatorChar)
      $filePath = [System.IO.Path]::GetFullPath((Join-Path $resolvedRoot $relativePath))
      if (-not $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 - Datei nicht gefunden")
        Send-HttpResponse -Stream $stream -StatusCode 404 -ReasonPhrase "Not Found" -ContentType "text/plain; charset=utf-8" -Body $bytes
        continue
      }

      if (-not (Test-Path $filePath -PathType Leaf)) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 - Datei nicht gefunden")
        Send-HttpResponse -Stream $stream -StatusCode 404 -ReasonPhrase "Not Found" -ContentType "text/plain; charset=utf-8" -Body $bytes
        continue
      }

      $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $contentType = $contentTypes[$extension]
      if (-not $contentType) {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 - Datei nicht gefunden")
        Send-HttpResponse -Stream $stream -StatusCode 404 -ReasonPhrase "Not Found" -ContentType "text/plain; charset=utf-8" -Body $bytes
        continue
      }

      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      Send-HttpResponse -Stream $stream -StatusCode 200 -ReasonPhrase "OK" -ContentType $contentType -Body $bytes
    }
    catch {
      Write-Warning "Anfrage konnte nicht verarbeitet werden: $($_.Exception.Message)"
    }
    finally {
      if ($null -ne $reader) {
        $reader.Dispose()
      }
      if ($null -ne $client) {
        $client.Close()
      }
    }
  }
}
finally {
  $listener.Stop()
}
