function Initialize()
  counter = 0
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

function Update()
  counter = (counter or 0) + 1
  local r, g, b = hsl(counter * 1.5, 0.92, 0.66)
  local c = string.format("%d,%d,%d,255", r, g, b)
  SKIN:Bang(
    "!SetOption",
    "MeterBrandBg",
    "Shape",
    "Rectangle 0,0,34,30,0 | Fill Color " .. c .. " | StrokeWidth 0"
  )
  SKIN:Bang("!SetOption", "MeterPrompt", "FontColor", c)
  SKIN:Bang("!UpdateMeter", "MeterBrandBg")
  SKIN:Bang("!UpdateMeter", "MeterPrompt")
  SKIN:Bang("!Redraw")
  return counter
end
