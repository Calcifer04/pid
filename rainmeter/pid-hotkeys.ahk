#Requires AutoHotkey v2.0
#SingleInstance Force
; piD Alt+G — [πD | field] + GDI+ RGB glow ring

global gOpen := false
global gDim := 0
global gBar := 0
global gRing := 0
global gRingHwnd := 0
global gRingX := 0
global gRingY := 0
global gIn := 0
global gPick := 0
global gChips := 0
global gItems := []
global gFilt := []
global gRefs := []
global gPickIdx := 1
global gAt := 0
global gHue := 145.0
global gPhase := 0.0
global gToken := 0
global gPad := 28
global gRadius := 12   ; match Win11 DWM round roughly
global gBusy := false
global gDeskUrl := "http://127.0.0.1:4000/api/desk"

; larger command bar — full-width field, no brand bay
gW := 680
gH := 56

; ——— GDI+ ———
GdipStart() {
    global gToken
    if gToken
        return true
    if !DllCall("GetModuleHandle", "str", "gdiplus", "ptr")
        DllCall("LoadLibrary", "str", "gdiplus")
    si := Buffer(A_PtrSize = 8 ? 24 : 16, 0)
    NumPut("uint", 1, si, 0)
    token := 0
    if DllCall("gdiplus\GdiplusStartup", "ptr*", &token, "ptr", si, "ptr", 0) {
        gToken := 0
        return false
    }
    gToken := token
    return true
}

HslArgb(h, s := 0.92, l := 0.66, a := 255) {
    h := Mod(h, 360) / 360
    if h < 0
        h += 1
    if s = 0 {
        v := Round(l * 255)
        return (a << 24) | (v << 16) | (v << 8) | v
    }
    q := l < 0.5 ? l * (1 + s) : l + s - l * s
    p := 2 * l - q
    r := Round(Hue2(p, q, h + 1 / 3) * 255)
    g := Round(Hue2(p, q, h) * 255)
    b := Round(Hue2(p, q, h - 1 / 3) * 255)
    return (a << 24) | (r << 16) | (g << 8) | b
}

HslHex(h, s := 0.92, l := 0.66) {
    c := HslArgb(h, s, l, 255)
    return Format("{:02x}{:02x}{:02x}", (c >> 16) & 255, (c >> 8) & 255, c & 255)
}

Hue2(p, q, t) {
    if t < 0
        t += 1
    if t > 1
        t -= 1
    if t < 1 / 6
        return p + (q - p) * 6 * t
    if t < 1 / 2
        return q
    if t < 2 / 3
        return p + (q - p) * (2 / 3 - t) * 6
    return p
}

MakeRoundPath(x, y, w, h, r) {
    path := 0
    DllCall("gdiplus\GdipCreatePath", "int", 0, "ptr*", &path)
    d := r * 2.0
    ; continuous rounded rect (arcs join with implied lines)
    DllCall("gdiplus\GdipAddPathArc", "ptr", path, "float", x + w - d, "float", y, "float", d, "float", d, "float", 270.0, "float", 90.0)
    DllCall("gdiplus\GdipAddPathArc", "ptr", path, "float", x + w - d, "float", y + h - d, "float", d, "float", d, "float", 0.0, "float", 90.0)
    DllCall("gdiplus\GdipAddPathArc", "ptr", path, "float", x, "float", y + h - d, "float", d, "float", d, "float", 90.0, "float", 90.0)
    DllCall("gdiplus\GdipAddPathArc", "ptr", path, "float", x, "float", y, "float", d, "float", d, "float", 180.0, "float", 90.0)
    DllCall("gdiplus\GdipClosePathFigure", "ptr", path)
    return path
}

; Flatten GDI+ path → dense polyline (smooth corners, same geometry as stroke)
FlattenPathPoints(path, &xs, &ys, flatness := 0.35) {
    xs := []
    ys := []
    ; clone so ambient path stays curved
    clone := 0
    DllCall("gdiplus\GdipClonePath", "ptr", path, "ptr*", &clone)
    if !clone
        return 0
    DllCall("gdiplus\GdipFlattenPath", "ptr", clone, "ptr", 0, "float", flatness)
    cnt := 0
    DllCall("gdiplus\GdipGetPointCount", "ptr", clone, "int*", &cnt)
    if cnt < 2 {
        DllCall("gdiplus\GdipDeletePath", "ptr", clone)
        return 0
    }
    pts := Buffer(cnt * 8, 0) ; PointF = 2 floats
    if DllCall("gdiplus\GdipGetPathPoints", "ptr", clone, "ptr", pts, "int", cnt) {
        DllCall("gdiplus\GdipDeletePath", "ptr", clone)
        return 0
    }
    loop cnt {
        o := (A_Index - 1) * 8
        xs.Push(NumGet(pts, o, "float"))
        ys.Push(NumGet(pts, o + 4, "float"))
    }
    DllCall("gdiplus\GdipDeletePath", "ptr", clone)
    return cnt
}

PaintRing() {
    global gOpen, gRingHwnd, gRingX, gRingY, gW, gH, gPad, gRadius, gPhase, gHue, gToken, gBusy
    if !gOpen || !gRingHwnd || !gToken || gBusy
        return
    if !DllCall("IsWindow", "ptr", gRingHwnd)
        return
    gBusy := true

    try {
        pad := gPad
        bw := gW
        bh := gH
        tw := bw + pad * 2
        th := bh + pad * 2
        rx := gRingX
        ry := gRingY

        bi := Buffer(40, 0)
        NumPut("uint", 40, bi, 0)
        NumPut("int", tw, bi, 4)
        NumPut("int", -th, bi, 8)
        NumPut("ushort", 1, bi, 12)
        NumPut("ushort", 32, bi, 14)

        hdcScreen := DllCall("GetDC", "ptr", 0, "ptr")
        hdcMem := DllCall("CreateCompatibleDC", "ptr", hdcScreen, "ptr")
        ppvBits := 0
        hbm := DllCall("CreateDIBSection", "ptr", hdcMem, "ptr", bi, "uint", 0, "ptr*", &ppvBits, "ptr", 0, "uint", 0, "ptr")
        if !hbm {
            DllCall("DeleteDC", "ptr", hdcMem)
            DllCall("ReleaseDC", "ptr", 0, "ptr", hdcScreen)
            gBusy := false
            return
        }
        obm := DllCall("SelectObject", "ptr", hdcMem, "ptr", hbm, "ptr")

        gfx := 0
        DllCall("gdiplus\GdipCreateFromHDC", "ptr", hdcMem, "ptr*", &gfx)
        DllCall("gdiplus\GdipSetSmoothingMode", "ptr", gfx, "int", 4)
        DllCall("gdiplus\GdipSetCompositingQuality", "ptr", gfx, "int", 2)
        DllCall("gdiplus\GdipSetPixelOffsetMode", "ptr", gfx, "int", 2)
        DllCall("gdiplus\GdipGraphicsClear", "ptr", gfx, "uint", 0x00000000)

        ; inset half-pixel so stroke centers on bar edge
        rr := Min(gRadius, bw / 2, bh / 2) + 0.0
        basePath := MakeRoundPath(pad + 0.5, pad + 0.5, bw - 1.0, bh - 1.0, rr)

        ; ambient glow shells — true rounded path (smooth corners)
        loop 5 {
            u := 1.0 - (A_Index - 1) / 4.0
            wpen := 2.0 + u * 18.0
            alpha := Round(34 * u * u)
            if alpha < 3
                continue
            pen := 0
            DllCall("gdiplus\GdipCreatePen1", "uint", HslArgb(gHue, 0.78, 0.52, alpha), "float", wpen, "int", 2, "ptr*", &pen)
            DllCall("gdiplus\GdipSetPenLineJoin", "ptr", pen, "int", 2) ; round joins
            DllCall("gdiplus\GdipDrawPath", "ptr", gfx, "ptr", pen, "ptr", basePath)
            DllCall("gdiplus\GdipDeletePen", "ptr", pen)
        }

        penRail := 0
        DllCall("gdiplus\GdipCreatePen1", "uint", 0x882A2A34, "float", 1.4, "int", 2, "ptr*", &penRail)
        DllCall("gdiplus\GdipSetPenLineJoin", "ptr", penRail, "int", 2)
        DllCall("gdiplus\GdipDrawPath", "ptr", gfx, "ptr", penRail, "ptr", basePath)
        DllCall("gdiplus\GdipDeletePen", "ptr", penRail)

        ; traveling head along flattened path (dense on corners)
        n := FlattenPathPoints(basePath, &xs, &ys, 0.3)
        DllCall("gdiplus\GdipDeletePath", "ptr", basePath)
        if n < 8 {
            ; fallback skip head
        } else {
            ; phase 0..1 around loop
            headF := Mod(gPhase, 1.0)
            if headF < 0
                headF += 1.0
            head := headF * n
            sigma := n * 0.08  ; ~8% of perimeter
            if sigma < 4
                sigma := 4

            ; stride path points — keeps RGB smooth without melting the UI thread
            step := n > 160 ? 2 : 1
            i := 1
            while i <= n {
                j := (i >= n) ? 1 : Min(n, i + step)
                d := Abs((i - 1) - head)
                if d > n / 2
                    d := n - d
                fall := Exp(-(d * d) / (2 * sigma * sigma))
                if fall < 0.07 {
                    i += step
                    continue
                }

                hue := gHue + (i / n) * 50
                ; soft underglow + bright core — round caps bridge corner segments
                loop 2 {
                    k := A_Index
                    thick := (k = 1) ? (2.4 + 11.0 * fall) : (1.7 + 3.6 * fall)
                    alpha := (k = 1) ? Round(60 * fall) : Round(230 * fall)
                    pen := 0
                    DllCall("gdiplus\GdipCreatePen1"
                        , "uint", HslArgb(hue, 0.92, 0.55 + 0.14 * (k = 2), alpha)
                        , "float", thick, "int", 2, "ptr*", &pen)
                    DllCall("gdiplus\GdipSetPenStartCap", "ptr", pen, "int", 2)
                    DllCall("gdiplus\GdipSetPenEndCap", "ptr", pen, "int", 2)
                    DllCall("gdiplus\GdipSetPenLineJoin", "ptr", pen, "int", 2)
                    DllCall("gdiplus\GdipDrawLine", "ptr", gfx, "ptr", pen
                        , "float", xs[i], "float", ys[i], "float", xs[j], "float", ys[j])
                    DllCall("gdiplus\GdipDeletePen", "ptr", pen)
                }
                i += step
            }
        }

        DllCall("gdiplus\GdipDeleteGraphics", "ptr", gfx)

        ; premultiply — use chG not g (g* names collide with globals in AHK)
        if ppvBits {
            p := ppvBits
            nPx := tw * th
            loop nPx {
                chB := NumGet(p, 0, "uchar")
                chG := NumGet(p, 1, "uchar")
                chR := NumGet(p, 2, "uchar")
                chA := NumGet(p, 3, "uchar")
                if (chA > 0 && chA < 255) {
                    NumPut("uchar", chB * chA // 255, p, 0)
                    NumPut("uchar", chG * chA // 255, p, 1)
                    NumPut("uchar", chR * chA // 255, p, 2)
                } else if chA = 0 {
                    NumPut("uint", 0, p, 0)
                }
                p += 4
            }
        }

        ptDst := Buffer(8, 0)
        NumPut("int", rx, ptDst, 0)
        NumPut("int", ry, ptDst, 4)
        sz := Buffer(8, 0)
        NumPut("int", tw, sz, 0)
        NumPut("int", th, sz, 4)
        ptSrc := Buffer(8, 0)
        blend := Buffer(4, 0)
        NumPut("uchar", 0, blend, 0)
        NumPut("uchar", 0, blend, 1)
        NumPut("uchar", 255, blend, 2)
        NumPut("uchar", 1, blend, 3)

        DllCall("UpdateLayeredWindow"
            , "ptr", gRingHwnd
            , "ptr", hdcScreen
            , "ptr", ptDst
            , "ptr", sz
            , "ptr", hdcMem
            , "ptr", ptSrc
            , "uint", 0
            , "ptr", blend
            , "uint", 2)

        DllCall("SelectObject", "ptr", hdcMem, "ptr", obm)
        DllCall("DeleteObject", "ptr", hbm)
        DllCall("DeleteDC", "ptr", hdcMem)
        DllCall("ReleaseDC", "ptr", 0, "ptr", hdcScreen)
    } catch {
        ; never surface paint errors as dialog spam
    } finally {
        gBusy := false
    }
}

BlurDim(hwnd) {
    try {
        acc := Buffer(16, 0)
        NumPut("int", 3, acc, 0)
        NumPut("int", 0xE2, acc, 4)
        NumPut("uint", 0x00000000, acc, 8)
        data := Buffer(A_PtrSize = 8 ? 24 : 12, 0)
        NumPut("int", 19, data, 0)
        NumPut("ptr", acc.Ptr, data, A_PtrSize = 8 ? 8 : 4)
        NumPut("uptr", 16, data, A_PtrSize = 8 ? 16 : 8)
        DllCall("SetWindowCompositionAttribute", "ptr", hwnd, "ptr", data)
    }
}

; Win11 AA corners only — SetWindowRgn is what made edges look pixelated
RoundWin(hwnd, w := 0, h := 0, r := 0) {
    try {
        v := Buffer(4, 0)
        NumPut("int", 2, v, 0) ; DWMWCP_ROUND
        DllCall("dwmapi\DwmSetWindowAttribute", "ptr", hwnd, "uint", 33, "ptr", v, "uint", 4)
    }
    try {
        d := Buffer(4, 0)
        NumPut("int", 1, d, 0) ; dark mode
        DllCall("dwmapi\DwmSetWindowAttribute", "ptr", hwnd, "uint", 20, "ptr", d, "uint", 4)
    }
}

TickRgb(*) {
    global gOpen, gHue, gPhase, gBusy
    if !gOpen
        return
    ; drop a frame if still painting — never stall the timer permanently
    if gBusy
        return
    gPhase := Mod(gPhase + 0.016, 1.0)  ; 0..1 loop position
    gHue := Mod(gHue + 1.4, 360.0)
    PaintRing()
}

LoadItems() {
    global gItems
    gItems := []
    try {
        http := ComObject("WinHttp.WinHttpRequest.5.1")
        http.Open("GET", "http://127.0.0.1:4000/api/desk/items", false)
        http.SetTimeouts(400, 400, 1200, 1200)
        http.Send()
        if http.Status != 200
            return
        for line in StrSplit(http.ResponseText, "`n", "`r") {
            line := Trim(line)
            if (line = "")
                continue
            p := StrSplit(line, "|")
            if p.Length < 3
                continue
            gItems.Push({
                kind: p[1] = "s" ? "sop" : "task",
                id: p[2],
                title: p[3],
                meta: p.Length >= 4 ? p[4] : "",
                color: p.Length >= 5 ? p[5] : ""
            })
        }
    } catch {
    }
}

OpenSpot() {
    global gOpen, gDim, gBar, gRing, gRingHwnd, gRingX, gRingY, gIn, gW, gH, gHue, gPhase, gPad, gRadius
    CloseSpot()
    if !GdipStart() {
        ; still open bar without ring if GDI+ missing
    }
    LoadItems()
    gHue := 145.0
    gPhase := 0.0

    MonitorGetWorkArea(1, &L, &T, &R, &B)
    mw := R - L
    mh := B - T
    bx := L + (mw - gW) // 2
    by := T + (mh - gH) // 2 - 48

    ; dim
    gDim := Gui("+AlwaysOnTop -Caption +ToolWindow -DPIScale +E0x80000", "pid-dim")
    gDim.BackColor := "000000"
    gDim.Show("x" L " y" T " w" mw " h" mh)
    BlurDim(gDim.Hwnd)
    WinSetTransparent(120, gDim)
    gDim.Add("Text", "x0 y0 w" mw " h" mh).OnEvent("Click", (*) => CloseSpot())

    ; glow ring (behind bar, click-through)
    pad := gPad
    gRingX := bx - pad
    gRingY := by - pad
    gRing := Gui("+AlwaysOnTop -Caption +ToolWindow -DPIScale +E0x80000 +E0x20", "pid-ring")
    gRing.Show("x" gRingX " y" gRingY " w" (gW + pad * 2) " h" (gH + pad * 2) " NoActivate")
    gRingHwnd := gRing.Hwnd

    ; bar — full-width field only
    gBar := Gui("+AlwaysOnTop -Caption +ToolWindow -DPIScale", "pid-spot")
    gBar.BackColor := "0c0c10"
    gBar.MarginX := 0
    gBar.MarginY := 0

    padX := 20
    fieldH := 32
    gBar.SetFont("s16 ce6e6ef Norm", "Cascadia Mono")
    gIn := gBar.Add("Edit"
        , "x" padX " y" ((gH - fieldH) // 2) " w" (gW - padX * 2) " h" fieldH " Background0c0c10 ce6e6ef -E0x200 -VScroll")
    gIn.OnEvent("Change", OnType)
    try SendMessage(0x1501, 0, StrPtr("ask πD"), gIn)

    gBar.Add("Button", "Default Hidden w1 h1", "ok").OnEvent("Click", OnEnter)
    gBar.OnEvent("Close", (*) => CloseSpot())
    gBar.OnEvent("Escape", OnEsc)

    gBar.Show("x" bx " y" by " w" gW " h" gH)
    RoundWin(gBar.Hwnd, gW, gH, gRadius)

    gOpen := true
    ; bar above ring above dim
    try WinSetAlwaysOnTop(true, "ahk_id " gRingHwnd)
    try WinSetAlwaysOnTop(true, "ahk_id " gBar.Hwnd)
    PaintRing()

    WinActivate("ahk_id " gBar.Hwnd)
    Sleep(30)
    try gIn.Focus()
    try ControlFocus(gIn)
    SetTimer(TickRgb, 40)
}

ClosePick() {
    global gPick, gFilt, gPickIdx, gAt
    if IsObject(gPick)
        try gPick.Destroy()
    gPick := 0
    gFilt := []
    gPickIdx := 1
    gAt := 0
}

CloseChips() {
    global gChips
    if IsObject(gChips)
        try gChips.Destroy()
    gChips := 0
}

CloseSpot(*) {
    global gOpen, gDim, gBar, gRing, gRingHwnd, gIn, gBusy, gRefs
    gOpen := false
    gBusy := false
    SetTimer(TickRgb, 0)
    ClosePick()
    CloseChips()
    gRefs := []
    if IsObject(gBar)
        try gBar.Destroy()
    if IsObject(gRing)
        try gRing.Destroy()
    if IsObject(gDim)
        try gDim.Destroy()
    gBar := 0
    gRing := 0
    gRingHwnd := 0
    gDim := 0
    gIn := 0
}

OnEsc(*) {
    global gPick
    if IsObject(gPick)
        ClosePick()
    else
        CloseSpot()
}

OnEnter(*) {
    global gFilt, gPickIdx, gPick
    if IsObject(gPick) && gFilt.Length {
        i := Min(Max(1, gPickIdx), gFilt.Length)
        InsertRef(gFilt[i])
        return
    }
    SendDesk()
}

OnType(*) {
    global gIn, gItems, gFilt, gPickIdx, gAt
    if !IsObject(gIn)
        return
    text := gIn.Value
    at := 0
    pos := 1
    while ((p := InStr(text, "@", false, pos))) {
        at := p
        pos := p + 1
    }
    if !at {
        ClosePick()
        return
    }
    rest := SubStr(text, at + 1)
    if InStr(rest, " ") || InStr(rest, "`t") {
        ClosePick()
        return
    }
    q := StrLower(rest)
    gAt := at
    gFilt := []
    for it in gItems {
        if (q = "" || InStr(StrLower(it.title), q) || InStr(it.kind, q) || InStr(StrLower(it.meta), q))
            gFilt.Push(it)
        if gFilt.Length >= 8
            break
    }
    if !gFilt.Length {
        ClosePick()
        return
    }
    gPickIdx := 1
    ShowPick()
}

/** Custom @ menu — color chip rows, void neon, matches Grok glass. */
ShowPick() {
    global gPick, gFilt, gPickIdx, gBar, gChips, gW, gRadius
    if !gFilt.Length {
        ClosePick()
        return
    }
    if gPickIdx < 1 || gPickIdx > gFilt.Length
        gPickIdx := 1

    if IsObject(gPick)
        try gPick.Destroy()
    gPick := 0

    ; taller rows so mono descenders (y/g/p) never clip
    rowH := 42
    padY := 6
    ph := gFilt.Length * rowH + padY * 2
    if !IsObject(gBar)
        return
    gBar.GetPos(&sx, &sy, &sw, &sh)
    ; sit under chip strip when present
    top := sy + sh + 8
    if IsObject(gChips) {
        gChips.GetPos(&cx, &cy, &cw, &ch)
        top := cy + ch + 6
    }

    gPick := Gui("+AlwaysOnTop -Caption +ToolWindow -DPIScale", "pid-pick")
    gPick.BackColor := "0c0c10"
    gPick.MarginX := 0
    gPick.MarginY := 0

    railW := 3
    sw := 10
    swX := 14
    titleX := swX + sw + 12
    titleH := 26
    metaW := 88
    metaX := gW - 10 - metaW
    titleW := metaX - titleX - 12
    if titleW < 140
        titleW := 140

    y := padY
    loop gFilt.Length {
        i := A_Index
        it := gFilt[i]
        active := (i = gPickIdx)
        rowBg := active ? "14141c" : "0c0c10"
        ink := active ? "e6e6ef" : "c4c4d0"
        muted := "7a7a8a"
        hex := NormalizeHex(it.HasOwnProp("color") ? it.color : "")
        swY := y + ((rowH - sw) // 2)
        titleY := y + ((rowH - titleH) // 2)
        metaY := y + ((rowH - 16) // 2)

        gPick.Add("Text", "x0 y" y " w" gW " h" rowH " Background" rowBg, "")
        gPick.Add("Text", "x0 y" y " w" railW " h" rowH " Background" hex, "")
        gPick.Add("Text", "x" swX " y" swY " w" sw " h" sw " Background" hex, "")

        gPick.SetFont("s13 c" ink " Norm", "Cascadia Mono")
        gPick.Add("Text"
            , "x" titleX " y" titleY " w" titleW " h" titleH " Background" rowBg " c" ink " -Wrap"
            , it.title)

        meta := it.HasOwnProp("meta") ? it.meta : ""
        if (meta = "sop")
            meta := ""
        gPick.SetFont("s10 c" muted " Norm", "Cascadia Mono")
        gPick.Add("Text"
            , "x" metaX " y" metaY " w" metaW " h16 Right Background" rowBg " c" muted " -Wrap"
            , meta)

        hit := gPick.Add("Text", "x0 y" y " w" gW " h" rowH " BackgroundTrans", " ")
        hit.OnEvent("Click", PickChoose.Bind(i))
        y += rowH
    }

    gPick.Show("x" sx " y" top " w" gW " h" ph " NoActivate")
    RoundWin(gPick.Hwnd, gW, ph, gRadius)
}

PickChoose(i, *) {
    global gFilt, gPickIdx
    if i < 1 || i > gFilt.Length
        return
    gPickIdx := i
    InsertRef(gFilt[i])
}

/** #rrggbb / rrggbb → 6-char hex for AHK Background colors. */
NormalizeHex(c) {
    c := StrLower(Trim(c))
    c := StrReplace(c, "#", "")
    if RegExMatch(c, "^[0-9a-f]{3}$")
        c := SubStr(c, 1, 1) SubStr(c, 1, 1) SubStr(c, 2, 1) SubStr(c, 2, 1) SubStr(c, 3, 1) SubStr(c, 3, 1)
    if !RegExMatch(c, "^[0-9a-f]{6}$")
        return "9a9aab"
    return c
}

ShortTitle(t, max := 22) {
    t := Trim(t)
    if StrLen(t) <= max
        return t
    return SubStr(t, 1, max - 1) "…"
}

/** Pin ref as a chip — never dump uuid into the input. */
InsertRef(it) {
    global gIn, gAt, gRefs
    if !IsObject(gIn)
        return

    ; strip trailing @filter from the field
    text := gIn.Value
    before := gAt > 1 ? SubStr(text, 1, gAt - 1) : ""
    gIn.Value := RTrim(before)

    ; dedupe
    for r in gRefs {
        if r.id = it.id && r.kind = it.kind {
            ClosePick()
            RenderChips()
            gIn.Focus()
            Send("{End}")
            return
        }
    }
    gRefs.Push(it)
    ClosePick()
    RenderChips()
    gIn.Focus()
    Send("{End}")
}

/** Chip strip under the bar — color + short title, click to remove. */
RenderChips() {
    global gChips, gRefs, gBar, gW, gRadius, gPick, gFilt
    CloseChips()
    if !gRefs.Length || !IsObject(gBar)
        return

    gBar.GetPos(&sx, &sy, &sw, &sh)
    chipH := 34
    gChips := Gui("+AlwaysOnTop -Caption +ToolWindow -DPIScale", "pid-chips")
    gChips.BackColor := "0c0c10"
    gChips.MarginX := 0
    gChips.MarginY := 0

    x := 10
    y := 7
    gap := 8
    maxX := gW - 10

    for i, r in gRefs {
        hex := NormalizeHex(r.HasOwnProp("color") ? r.color : "")
        label := ShortTitle(r.title, 24)
        ; approx width: 10 swatch + pad + ~7px/char + × + pad
        cw := 10 + 10 + (StrLen(label) * 8) + 22
        if cw < 72
            cw := 72
        if cw > 220
            cw := 220
        if x + cw > maxX
            break

        ; chip body
        gChips.Add("Text", "x" x " y" y " w" cw " h20 Background121218", "")
        gChips.Add("Text", "x" x " y" y " w3 h20 Background" hex, "")
        gChips.Add("Text", "x" (x + 8) " y" (y + 5) " w10 h10 Background" hex, "")
        gChips.SetFont("s11 ce6e6ef Norm", "Cascadia Mono")
        gChips.Add("Text"
            , "x" (x + 22) " y" (y + 2) " w" (cw - 40) " h16 Background121218 ce6e6ef -Wrap"
            , label)
        gChips.SetFont("s11 c555566 Norm", "Cascadia Mono")
        gChips.Add("Text", "x" (x + cw - 16) " y" (y + 2) " w14 h16 Background121218 c555566", "×")

        hit := gChips.Add("Text", "x" x " y" y " w" cw " h20 BackgroundTrans", " ")
        hit.OnEvent("Click", RemoveRef.Bind(i))
        x += cw + gap
    }

    gChips.Show("x" sx " y" (sy + sh + 6) " w" gW " h" chipH " NoActivate")
    RoundWin(gChips.Hwnd, gW, chipH, gRadius)

    ; keep picker under chips if still open
    if IsObject(gPick) && IsObject(gFilt) && gFilt.Length
        ShowPick()
}

RemoveRef(i, *) {
    global gRefs, gIn
    if i < 1 || i > gRefs.Length
        return
    gRefs.RemoveAt(i)
    RenderChips()
    if IsObject(gIn)
        gIn.Focus()
}

/** Same payload shape as web GrokPanel — human text + refs block. */
BuildOutbound(text, refs) {
    body := Trim(text)
    if !refs.Length
        return body
    lines := ""
    for r in refs {
        title := StrReplace(r.title, '"', "'")
        lines .= r.kind ":" r.id ' "' title '"' "`n"
    }
    block := "refs:`n" RTrim(lines, "`n")
    return body != "" ? body "`n`n" block : block
}

SendDesk(*) {
    global gIn, gOpen, gRefs
    if !gOpen || !IsObject(gIn)
        return
    msg := Trim(gIn.Value)
    if msg = "" && !gRefs.Length {
        CloseSpot()
        return
    }
    gIn.Enabled := false
    outbound := BuildOutbound(msg, gRefs)
    reply := PostDesk(outbound)
    Toast(SubStr(reply, 1, 120))
    CloseSpot()
}

/** Direct HTTP to πD — no PowerShell window flash. */
PostDesk(msg) {
    global gDeskUrl
    try {
        http := ComObject("WinHttp.WinHttpRequest.5.1")
        http.Open("POST", gDeskUrl, false)
        http.SetRequestHeader("Content-Type", "application/json; charset=utf-8")
        http.SetTimeouts(2000, 2000, 120000, 120000)
        body := '{"message":"' JsonEscape(msg) '"}'
        http.Send(body)
        text := http.ResponseText
        if http.Status = 200 {
            r := JsonField(text, "reply")
            return r != "" ? r : "ok"
        }
        err := JsonField(text, "error")
        if err != ""
            return err
        return "err " http.Status
    } catch as e {
        return "err " e.Message
    }
}

JsonEscape(s) {
    s := StrReplace(s, "\", "\\")
    s := StrReplace(s, '"', '\"')
    s := StrReplace(s, "`n", "\n")
    s := StrReplace(s, "`r", "\r")
    s := StrReplace(s, "`t", "\t")
    return s
}

JsonField(text, key) {
    ; naive "key":"value" pull (desk replies stay simple)
    needle := '"' key '":"'
    p := InStr(text, needle)
    if !p
        return ""
    i := p + StrLen(needle)
    out := ""
    while i <= StrLen(text) {
        ch := SubStr(text, i, 1)
        if ch = "\" {
            n := SubStr(text, i + 1, 1)
            if n = "n"
                out .= "`n"
            else if n = '"'
                out .= '"'
            else if n = "\"
                out .= "\"
            else
                out .= n
            i += 2
            continue
        }
        if ch = '"'
            break
        out .= ch
        i++
    }
    return out
}

Toast(text) {
    global gRadius
    ; NOTE: AHK v2 vars are case-insensitive — never use t/T together
    ; (MonitorGetWorkArea &T would clobber a Gui named t).
    toastGui := Gui("+AlwaysOnTop -Caption +ToolWindow -DPIScale", "pid-toast")
    toastGui.BackColor := "0c0c10"
    toastGui.SetFont("s10 c9a9aab", "Cascadia Mono")
    toastGui.Add("Text", "w400 Wrap", text)
    toastGui.Show("Hide")
    toastGui.GetPos(,, &tw, &th)
    RoundWin(toastGui.Hwnd, tw, th, gRadius)
    MonitorGetWorkArea(1, &monL, &monT, &monR, &monB)
    tx := monL + (monR - monL - tw) // 2
    ty := monT + (monB - monT) // 2 + 30
    toastGui.Show(Format("x{1} y{2}", tx, ty))
    hold := toastGui
    SetTimer(() => ToastDestroy(hold), -1600)
}

ToastDestroy(guiObj) {
    try {
        if IsObject(guiObj)
            guiObj.Destroy()
    }
}

!g:: {
    global gOpen
    if gOpen
        CloseSpot()
    else
        OpenSpot()
}

#HotIf gOpen
Esc:: OnEsc()
Up:: {
    global gFilt, gPickIdx, gPick
    if IsObject(gPick) && gFilt.Length {
        gPickIdx := gPickIdx > 1 ? gPickIdx - 1 : gFilt.Length
        ShowPick()
    }
}
Down:: {
    global gFilt, gPickIdx, gPick
    if IsObject(gPick) && gFilt.Length {
        gPickIdx := gPickIdx < gFilt.Length ? gPickIdx + 1 : 1
        ShowPick()
    }
}
Tab:: {
    global gFilt, gPickIdx, gPick
    if IsObject(gPick) && gFilt.Length {
        i := Min(Max(1, gPickIdx), gFilt.Length)
        InsertRef(gFilt[i])
    }
}
; empty field + backspace pops last @ chip (same as web Grok)
Backspace:: {
    global gIn, gRefs, gPick
    if IsObject(gPick) {
        Send("{Backspace}")
        return
    }
    if IsObject(gIn) && Trim(gIn.Value) = "" && gRefs.Length {
        gRefs.Pop()
        RenderChips()
        return
    }
    Send("{Backspace}")
}
#HotIf
