local root='/private/tmp/vietnamtown-landmarks/'
local names={'tan-dinh','ben-thanh','thao-dien','cho-lon','binh-thanh','phu-nhuan'}
for _,name in ipairs(names) do
 local s=app.open(root..name..'.aseprite');local img=Image{fromFile=root..name..'.png'}
 assert(s.width==96 and s.height==96 and #s.layers==4,name..' source mismatch')
 assert(img.width==96 and img.height==96,name..' export dimensions')
 local n=0;local colors={};local x0,y0,x1,y1=96,96,-1,-1
 for y=0,95 do for x=0,95 do local p=img:getPixel(x,y);local a=app.pixelColor.rgbaA(p);if a>0 then n=n+1;colors[p]=true;x0=math.min(x0,x);y0=math.min(y0,y);x1=math.max(x1,x);y1=math.max(y1,y) end end end
 assert(app.pixelColor.rgbaA(img:getPixel(0,0))==0,name..' missing transparency')
 assert(x0>0 and x1<95 and y0>0 and y1<95,name..' clipped edge')
 local count=0;for _ in pairs(colors) do count=count+1 end
 print(name..': 96x96 RGBA, 4 layers, '..n..' visible pixels, '..count..' colors, bounds '..x0..','..y0..' to '..x1..','..y1)
end
local atlas=app.open(root..'neighborhood-landmarks.aseprite');assert(atlas.width==288 and atlas.height==192 and #atlas.layers==24);print('Atlas: 288x192, 24 native layers; PASS')
