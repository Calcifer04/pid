# -*- coding: utf-8 -*-
from pathlib import Path

content = r'''#Requires AutoHotkey v2.0
#SingleInstance Force
; piD Alt+G — void bar: RGB πD | search | @ picker | /api/desk

global gOpen := false
global gDim := 0
global gBar := 0
global gIn := 0
global gBrand := 0
global gPick := 0
global gList := 0
global gItems := []
global gFilt := []
global gAt := 0
global gHue := 145
global gDesk := EnvGet("USERPROFILE") "\Documents\piD\desk-grok.ps1"
if !FileExist(gDesk)
    gDesk := EnvGet("USERPROFILE") "\Projects\routine\rainmeter\piDSpotlight\desk-grok.ps1"

gW := 520
gH := 40

BlurDim(hwnd) {
    try {
        acc := Buffer(16, 0)
        NumPut("int", 4, acc, 0)
        NumPut("int", 0xE2, acc, 4)
        NumPut("uint", 0xBB000000, acc, 8)
        data := Buffer(A_PtrSize = 8 ? 24 : 12, 0)
        NumPut("int", 19, data, 0)
        NumPut("ptr", acc.Ptr, data, A_PtrSize = 8 ? 8 : 4)
        NumPut("uptr", 16, data, A_PtrSize = 8 ? 16 : 8)
        DllCall("SetWindowCompositionAttribute", "ptr", hwnd, "ptr", data)
    }
}

RoundWin(hwnd, w, h, r := 10) {
    rg := DllCall("gdi32\CreateRoundRectRgn", "int", 0, "int", 0, "int", w + 1, "int", h + 1, "int", r * 2, "int", r * 2, "ptr")
    DllCall("user32\SetWindowRgn", "ptr", hwnd, "ptr", rg, "int", 1)
}

HslHex(h, s := 0.92, l := 0.66) {
    h := h / 360
    if s = 0 {
        v := Format("{:02x}", Round(l * 255))
        return v v v
    }
    q := l < 0.5 ? l * (1 + s) : l + s - l * s
    p := 2 * l - q
    r := Hue2(p, q, h + 1 / 3)
    g := Hue2(p, q, h)
    b := Hue2(p, q, h - 1 / 3)
    return Format("{:02x}{:02x}{:02x}", Round(r * 255), Round(g * 255), Round(b * 255))
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

TickRgb(*) {
    global gOpen, gBrand, gHue
    if !gOpen || !IsObject(gBrand)
        return
    gHue := Mod(gHue + 4, 360)
    hex := HslHex(gHue)
    try gBrand.Opt("Background" hex)
}

LoadItems() {
    global gItems
    gItems := []
    try {
        http := ComObject("WinHttp.WinHttpRequest.5.1")
        http.Open("GET", "http://127.0.0.1:4000/api/desk/items", false)
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
            gItems.Push({ kind: p[1] = "s" ? "sop" : "task", id: p[2], title: p[3], meta: p.Length >= 4 ? p[4] : "" })
        }
    } catch {
    }
}

OpenSpot() {
    global gOpen, gDim, gBar, gIn, gBrand, gW, gH, gHue
    CloseSpot()
    LoadItems()
    gHue := 145

    MonitorGetWorkArea(1, &L, &T, &R, &B)
    mw := R - L, mh := B - T
    bx := L + (mw - gW) // 2
    by := T + (mh - gH) // 2 - 48

    gDim := Gui("+AlwaysOnTop -Caption +ToolWindow -DPIScale +E0x80000", "pid-dim")
    gDim.BackColor := "000000"
    gDim.Show("x" L " y" T " w" mw " h" mh)
    BlurDim(gDim.Hwnd)
    WinSetTransparent(155, gDim)
    gDim.Add("Text", "x0 y0 w" mw " h" mh).OnEvent("Click", (*) => CloseSpot())

    ; pure void #030304 — logo | field only
    gBar := Gui("+AlwaysOnTop -Caption +ToolWindow -DPIScale", "pid-spot")
    gBar.BackColor := "030304"
    gBar.MarginX := 0
    gBar.MarginY := 0

    gBar.SetFont("s11 c030304 Bold", "Cascadia Mono")
    gBrand := gBar.Add("Text", "x0 y0 w44 h" gH " Center 0x200 Background5af78e c030304", Chr(0x03C0) "D")
    gBrand.SetFont("s11 Bold", "Cascadia Mono")

    gBar.SetFont("s13 ce6e6ef Norm", "Cascadia Mono")
    gIn := gBar.Add("Edit", "x52 y" ((gH - 26) // 2) " w" (gW - 64) " h26 Background030304 ce6e6ef -E0x200")
    gIn.OnEvent("Change", OnType)

    gBar.Add("Button", "Default Hidden w1 h1", "ok").OnEvent("Click", OnEnter)
    gBar.OnEvent("Close", (*) => CloseSpot())
    gBar.OnEvent("Escape", OnEsc)

    gBar.Show("x" bx " y" by " w" gW " h" gH)
    RoundWin(gBar.Hwnd, gW, gH, 10)
    WinActivate("ahk_id " gBar.Hwnd)
    Sleep(40)
    gIn.Focus()
    try ControlFocus(gIn)
    gOpen := true
    SetTimer(TickRgb, 50)
}

ClosePick() {
    global gPick, gList, gFilt, gAt
    if IsObject(gPick)
        try gPick.Destroy()
    gPick := 0
    gList := 0
    gFilt := []
    gAt := 0
}

CloseSpot(*) {
    global gOpen, gDim, gBar, gIn, gBrand
    gOpen := false
    SetTimer(TickRgb, 0)
    ClosePick()
    if IsObject(gBar)
        try gBar.Destroy()
    if IsObject(gDim)
        try gDim.Destroy()
    gBar := 0
    gDim := 0
    gIn := 0
    gBrand := 0
}

OnEsc(*) {
    global gPick
    if IsObject(gPick)
        ClosePick()
    else
        CloseSpot()
}

OnEnter(*) {
    global gList, gFilt
    if IsObject(gList) && gFilt.Length && gList.Value {
        InsertRef(gFilt[gList.Value])
        return
    }
    SendDesk()
}

OnType(*) {
    global gIn, gItems, gFilt, gAt, gPick, gList, gBar, gW
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
    gBar.GetPos(&sx, &sy, &sw, &sh)
    ph := Min(8, gFilt.Length) * 28 + 12
    if !IsObject(gPick) {
        gPick := Gui("+AlwaysOnTop -Caption +ToolWindow -DPIScale", "pid-pick")
        gPick.BackColor := "030304"
        gPick.SetFont("s12 ce6e6ef", "Cascadia Mono")
        gList := gPick.Add("ListBox", "x6 y6 w" (gW - 12) " r8 -Multi Background0c0c10 ce6e6ef")
        gList.OnEvent("DoubleClick", (*) => gList.Value && InsertRef(gFilt[gList.Value]))
    }
    gList.Delete()
    for it in gFilt {
        tag := it.kind = "sop" ? "s" : "t"
        gList.Add([tag "  " it.title (it.meta != "" ? "  · " it.meta : "")])
    }
    gList.Choose(1)
    gPick.Show("x" sx " y" (sy + sh + 8) " w" gW " h" ph)
    RoundWin(gPick.Hwnd, gW, ph, 10)
}

InsertRef(it) {
    global gIn, gAt
    if !IsObject(gIn)
        return
    ref := it.kind ":" it.id ' "' StrReplace(it.title, '"', "'") '"'
    before := gAt > 1 ? SubStr(gIn.Value, 1, gAt - 1) : ""
    left := RTrim(before)
    if left != "" && !InStr(" `t", SubStr(left, -1))
        left .= " "
    gIn.Value := left ref " "
    ClosePick()
    gIn.Focus()
    Send("{End}")
}

SendDesk(*) {
    global gIn, gOpen, gDesk
    if !gOpen || !IsObject(gIn)
        return
    msg := Trim(gIn.Value)
    if msg = "" {
        CloseSpot()
        return
    }
    if !FileExist(gDesk) {
        Toast("missing desk-grok.ps1")
        CloseSpot()
        return
    }
    gIn.Enabled := false
    reply := "ok"
    try {
        cmd := Format('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{1}" "{2}"', gDesk, StrReplace(msg, '"', '""'))
        ex := ComObject("WScript.Shell").Exec(cmd)
        n := 0
        while ex.Status = 0 && n < 1200 {
            Sleep(100)
            n++
        }
        reply := Trim(ex.StdOut.ReadAll() " " ex.StdErr.ReadAll())
        if reply = ""
            reply := "ok"
    } catch as e {
        reply := "err " e.Message
    }
    Toast(SubStr(reply, 1, 120))
    CloseSpot()
}

Toast(text) {
    t := Gui("+AlwaysOnTop -Caption +ToolWindow -DPIScale", "pid-toast")
    t.BackColor := "030304"
    t.SetFont("s10 c9a9aab", "Cascadia Mono")
    t.Add("Text", "w400", text)
    t.Show("Hide")
    t.GetPos(,, &tw, &th)
    RoundWin(t.Hwnd, tw, th, 10)
    MonitorGetWorkArea(1, &L, &T, &R, &B)
    t.Show("x" (L + (R - L - tw) // 2) " y" (T + (B - T) // 2 + 30))
    SetTimer(() => (IsObject(t) && t.Destroy()), -1600)
}

BlurDim(hwnd) {
    BlurDimImpl(hwnd)
}

BlurDimImpl(hwnd) {
    try {
        acc := Buffer(16, 0)
        NumPut("int", 4, acc, 0)
        NumPut("int", 0xE2, acc, 4)
        NumPut("uint", 0xBB000000, acc, 8)
        data := Buffer(A_PtrSize = 8 ? 24 : 12, 0)
        NumPut("int", 19, data, 0)
        NumPut("ptr", acc.Ptr, data, A_PtrSize = 8 ? 8 : 4)
        NumPut("uptr", 16, data, A_PtrSize = 8 ? 16 : 8)
        DllCall("SetWindowCompositionAttribute", "ptr", hwnd, "ptr", data)
    }
}

; fix: OpenSpot calls BlurDim - keep one BlurDim only
; remove BlurDim wrapper - already have BlurDim at top as BlurDim

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
    global gList, gFilt
    if IsObject(gList) && gFilt.Length {
        v := Max(1, Integer(gList.Value || 1))
        gList.Choose(v > 1 ? v - 1 : gFilt.Length)
    }
}
Down:: {
    global gList, gFilt
    if IsObject(gList) && gFilt.Length {
        v := Max(1, Integer(gList.Value || 1))
        gList.Choose(v < gFilt.Length ? v + 1 : 1)
    }
}
Tab:: {
    global gList, gFilt
    if IsObject(gList) && gFilt.Length && gList.Value
        InsertRef(gFilt[gList.Value])
}
#HotIf
'''

# Clean up the draft - remove broken BlurDim duplicate and fix OpenSpot to call BlurDim
content = content.replace('BlurDim(gDim.Hwnd)', 'BlurDim(gDim.Hwnd)')
# Remove BlurDimImpl and wrapper at bottom
import re
content = re.sub(
    r'\nBlurDim\(hwnd\) \{\n    BlurDimImpl\(hwnd\)\n\}\n\nBlurDimImpl\(hwnd\) \{.*?\n\}\n\n; fix:.*?\n\n',
    '\n',
    content,
    flags=re.S,
)
content = re.sub(r'\n; fix:.*?(?=\n!g::)', '\n', content, flags=re.S)

# Use real pi character
content = content.replace('Chr(0x03C0) "D"', '"πD"')

paths = [
    Path(r"C:\Users\basco\Projects\routine\rainmeter\pid-hotkeys.ahk"),
    Path(r"C:\Users\basco\Documents\piD\pid-hotkeys.ahk"),
]
for p in paths:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8-sig", newline="\n")  # BOM helps AHK unicode
    print("wrote", p, p.stat().st_size)

from collections import Counter
funcs = re.findall(r"^(\w+)\(", content, re.M)
print("dups", {k: v for k, v in Counter(funcs).items() if v > 1})
print("has pi", "πD" in content)
print("has !g", "!g::" in content)
'''

Path(r'C:\Users\basco\Projects\routine\scripts\write-hotkeys.py').write_text(content if False else open(__file__).read() if False else '', encoding='utf-8')
# just exec the logic inline without the broken meta
exec(open(r'C:\Users\basco\Projects\routine\scripts\_hk.py', encoding='utf-8').read()) if False else None
print('use direct write')
