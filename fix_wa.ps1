$f = 'C:\sattva\src\pages\HomePage.jsx'
$c = [IO.File]::ReadAllText($f)

# Try CRLF version first
$old = "              <a`r`n                href={pageWhatsAppLink(`"/`")}`r`n                target=`"_blank`"`r`n                rel=`"noopener noreferrer`"`r`n                style={{ ...st.bs, fontSize: m ? 13 : 14, textDecoration: `"none`", display: `"inline-flex`", alignItems: `"center`", gap: 6 }}`r`n              >`r`n                WhatsApp Shipment Details`r`n              </a>"
$new = "              <a`r`n                href={pageWhatsAppLink(`"/`")}`r`n                target=`"_blank`"`r`n                rel=`"noopener noreferrer`"`r`n                onClick={() => trackWhatsAppClick('hero')}`r`n                style={{ ...st.bs, fontSize: m ? 13 : 14, textDecoration: `"none`", display: `"inline-flex`", alignItems: `"center`", gap: 6 }}`r`n              >`r`n                WhatsApp Shipment Details`r`n              </a>"

if ($c.Contains($old)) {
    [IO.File]::WriteAllText($f, $c.Replace($old, $new))
    Write-Host "REPLACED OK (CRLF)"
} else {
    # Try LF version
    $old2 = "              <a`n                href={pageWhatsAppLink(`"/`")}`n                target=`"_blank`"`n                rel=`"noopener noreferrer`"`n                style={{ ...st.bs, fontSize: m ? 13 : 14, textDecoration: `"none`", display: `"inline-flex`", alignItems: `"center`", gap: 6 }}`n              >`n                WhatsApp Shipment Details`n              </a>"
    $new2 = "              <a`n                href={pageWhatsAppLink(`"/`")}`n                target=`"_blank`"`n                rel=`"noopener noreferrer`"`n                onClick={() => trackWhatsAppClick('hero')}`n                style={{ ...st.bs, fontSize: m ? 13 : 14, textDecoration: `"none`", display: `"inline-flex`", alignItems: `"center`", gap: 6 }}`n              >`n                WhatsApp Shipment Details`n              </a>"
    if ($c.Contains($old2)) {
        [IO.File]::WriteAllText($f, $c.Replace($old2, $new2))
        Write-Host "REPLACED OK (LF)"
    } else {
        $idx = $c.IndexOf("WhatsApp Shipment Details")
        Write-Host "NOT FOUND - context:"
        Write-Host $c.Substring([Math]::Max(0,$idx-250), 350)
    }
}
