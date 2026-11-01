local OUT='/private/tmp/saigon-v8-assets/'
local bases={'39a883','eec353','dc6f57','7fb5cf'}
for n,base in ipairs(bases)do
 local im=Image{fromFile=OUT..'stool-'..(n-1)..'.png'};assert(im.width==64 and im.height==64)
 local transparent,opaque,basePixels=0,0,0
 for y=0,63 do for x=0,63 do
  local p=im:getPixel(x,y);local a=app.pixelColor.rgbaA(p)
  assert(a==0 or a==255,'Unexpected smoothing / partial alpha')
  if a==0 then transparent=transparent+1 else opaque=opaque+1 end
  if a==255 and app.pixelColor.rgbaR(p)==tonumber(base:sub(1,2),16)and app.pixelColor.rgbaG(p)==tonumber(base:sub(3,4),16)and app.pixelColor.rgbaB(p)==tonumber(base:sub(5,6),16)then basePixels=basePixels+1 end
 end end
 assert(transparent>1500 and opaque>700 and basePixels>50,'Stool silhouette or player base color missing')
 print('PASS stool-'..(n-1)..': 64x64; '..transparent..' transparent pixels; '..basePixels..' exact player-color pixels')
end
for _,size in ipairs({512,192,180})do local im=Image{fromFile=OUT..'app-icon-'..size..'.png'};assert(im.width==size and im.height==size);print('PASS app icon '..size..'x'..size)end
local og=Image{fromFile=OUT..'saigon-town-og.png'};assert(og.width==1200 and og.height==630);print('PASS share art: 1200x630')
