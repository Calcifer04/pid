-- piD accent + task swatch + bg width

function Initialize()
  counter = 0
  lastAccent = ""
  lastSwatch = ""
  lastW = 0
end

local function hsl(h, s, l)
  h = (h % 360) / 360
  local function f(p, q, t)
    if t < 0 then t = t + 1 end
    if t > 1 then t = t - 1 end
    if t < 1 / 6 then return p + (q - p) * 6 * t end
    if t < 1 / 2 then return q end
    if t < 2 / 3 then return p + (q - p) * (2 / 3 - t) * 6 end
    return p
  end
  if s == 0 then
    local v = math.floor(l * 255 + 0.5)
    return v, v, v
  end
  local q = l < 0.5 and l * (1 + s) or l + s - l * s
  local p = 2 * l - q
  return math.floor(f(p, q, h + 1 / 3) * 255 + 0.5),
    math.floor(f(p, q, h) * 255 + 0.5),
    math.floor(f(p, q, h - 1 / 3) * 255 + 0.5)
end

local function hexToRgb(hex)
  if not hex or hex == "" then return 154, 154, 171 end
  hex = tostring(hex):gsub("#", ""):lower()
  if #hex == 3 then
    hex = hex:sub(1, 1):rep(2) .. hex:sub(2, 2):rep(2) .. hex:sub(3, 3):rep(2)
  end
  if #hex < 6 then return 154, 154, 171 end
  return tonumber(hex:sub(1, 2), 16) or 154,
    tonumber(hex:sub(3, 4), 16) or 154,
    tonumber(hex:sub(5, 6), 16) or 171
end

function Update()
  counter = (counter or 0) + 1
  local dirty = false

  local r, g, b = hsl(counter * 6.0, 0.92, 0.66)
  local c = string.format("%d,%d,%d,255", r, g, b)
  if c ~= lastAccent then
    lastAccent = c
    dirty = true
    SKIN:Bang(
      "!SetOption",
      "MeterBrandBg",
      "Shape",
      "Rectangle 0,0,34,30,0 | Fill Color " .. c .. " | StrokeWidth 0"
    )
    SKIN:Bang("!SetOption", "MeterBarFill", "BarColor", c)
    SKIN:Bang("!UpdateMeter", "MeterBrandBg")
    SKIN:Bang("!UpdateMeter", "MeterBarFill")
  end

  local cm = SKIN:GetMeasure("MeasureColor")
  local hex = cm and cm:GetStringValue() or ""
  if hex ~= "" and hex ~= lastSwatch then
    lastSwatch = hex
    dirty = true
    local sr, sg, sb = hexToRgb(hex)
    local sc = string.format("%d,%d,%d,255", sr, sg, sb)
    SKIN:Bang(
      "!SetOption",
      "MeterSwatch",
      "Shape",
      "Rectangle 0,0,8,8,1 | Fill Color " .. sc .. " | StrokeWidth 0"
    )
    SKIN:Bang("!UpdateMeter", "MeterSwatch")
  end

  local bar = SKIN:GetMeter("MeterBarTrack")
  if bar then
    local w = math.floor(bar:GetX() + bar:GetW() + 14)
    if w < 320 then w = 320 end
    if w > 1100 then w = 1100 end
    if math.abs(w - (lastW or 0)) >= 2 then
      lastW = w
      dirty = true
      SKIN:Bang(
        "!SetOption",
        "MeterBg",
        "Shape",
        string.format(
          "Rectangle 0,0,%d,30,0 | Fill Color 3,3,4,235 | StrokeWidth 0",
          w
        )
      )
      SKIN:Bang("!UpdateMeter", "MeterBg")
    end
  end

  if dirty then
    SKIN:Bang("!Redraw")
  end
  return counter
end
