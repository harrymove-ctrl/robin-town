local path='/private/tmp/vietnamtown-shops/'
for _,name in ipairs({'coffee','banhmi','pho','flowers','tailor','grocery'}) do
 local png=app.open(path..name..'.png')
 assert(png.width==96 and png.height==96)
 local im=Image(png);local transparent,opaque,partial=0,0,0
 for y=0,95 do for x=0,95 do local a=app.pixelColor.rgbaA(im:getPixel(x,y));if a==0 then transparent=transparent+1 elseif a==255 then opaque=opaque+1 else partial=partial+1 end end end
 assert(app.pixelColor.rgbaA(im:getPixel(0,0))==0,'Top-left pixel must remain transparent')
 assert(transparent>3000,'Sprite must have transparent silhouette border')
 local native=app.open(path..name..'.aseprite')
 assert(#native.layers>=6)
 print(name..': 96x96 RGBA; '..transparent..' transparent pixels, '..opaque..' solid, '..partial..' shadow pixels; '..#native.layers..' native layers')
end
