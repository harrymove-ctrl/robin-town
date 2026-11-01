-- Original VietnamTown pixel art. Drawn and exported by Aseprite.
local out = "/private/tmp/vietnamtown-materials/"
local function col(s,a)
  s=s:gsub('#','')
  return app.pixelColor.rgba(tonumber(s:sub(1,2),16),tonumber(s:sub(3,4),16),tonumber(s:sub(5,6),16),a or 255)
end
local function px(im,x,y,c)
  x=math.floor(x);y=math.floor(y)
  if x>=0 and y>=0 and x<im.width and y<im.height then im:drawPixel(x,y,c) end
end
local function rect(im,x1,y1,x2,y2,c)
  for y=y1,y2 do for x=x1,x2 do px(im,x,y,c) end end
end
local function ellipse(im,cx,cy,rx,ry,c)
  for y=math.floor(cy-ry),math.ceil(cy+ry) do
    for x=math.floor(cx-rx),math.ceil(cx+rx) do
      if ((x-cx)/rx)^2+((y-cy)/ry)^2<=1 then px(im,x,y,c) end
    end
  end
end
local function line(im,x1,y1,x2,y2,c,w)
  local n=math.max(math.abs(x2-x1),math.abs(y2-y1));w=w or 1
  for k=0,n do
    local x=math.floor(x1+(x2-x1)*k/math.max(1,n)+.5)
    local y=math.floor(y1+(y2-y1)*k/math.max(1,n)+.5)
    rect(im,x-math.floor((w-1)/2),y-math.floor((w-1)/2),x+math.ceil((w-1)/2),y+math.ceil((w-1)/2),c)
  end
end
local function poly(im,pts,c)
  local miny,maxy=9999,-1
  for _,p in ipairs(pts) do miny=math.min(miny,p[2]);maxy=math.max(maxy,p[2]) end
  for y=miny,maxy do
    local nodes={};local j=#pts
    for i=1,#pts do
      local a,b=pts[i],pts[j]
      if (a[2]<=y and b[2]>y) or (b[2]<=y and a[2]>y) then nodes[#nodes+1]=a[1]+(y-a[2])/(b[2]-a[2])*(b[1]-a[1]) end
      j=i
    end
    table.sort(nodes)
    for i=1,#nodes-1,2 do for x=math.ceil(nodes[i]),math.floor(nodes[i+1]) do px(im,x,y,c) end end
  end
end
local function new(w,h,name)
  local sp=Sprite(w,h,ColorMode.RGB)
  sp.layers[1].name=name
  sp.cels[1].image:clear()
  return sp,sp.cels[1].image
end
local function save(sp,name)
  sp:saveAs(out..name..'.aseprite')
  sp:saveCopyAs(out..name..'.png')
end
local function blendHex(s,f)
  local a={}
  for i=1,5,2 do a[#a+1]=math.max(0,math.min(255,math.floor(tonumber(s:sub(i,i+1),16)*f+.5))) end
  return app.pixelColor.rgba(a[1],a[2],a[3],255)
end
local assets={}

-- Four thick molded-plastic ownership discs. The light is upper-left.
local bases={'39a883','eec353','dc6f57','7fb5cf'}
for k,base in ipairs(bases) do
  local sp,im=new(32,32,'Molded plastic disc')
  local c={edge=blendHex(base,.36),deep=blendHex(base,.52),side=blendHex(base,.68),rim=blendHex(base,.86),face=col(base),shine=blendHex(base,1.2),glint=blendHex(base,1.42),engrave=blendHex(base,.74)}
  ellipse(im,16,25,13,4,col('183f36',32))
  ellipse(im,16,24,12,3,col('183f36',46))
  ellipse(im,15.5,18,13,9,c.edge)
  rect(im,3,13,28,19,c.edge)
  ellipse(im,15.5,17.5,12,8,c.deep)
  rect(im,4,13,27,19,c.deep)
  ellipse(im,15.5,16,12,8,c.side)
  rect(im,4,13,27,17,c.side)
  line(im,5,19,8,22,c.rim,1)
  line(im,9,23,16,24,c.rim,1)
  line(im,23,21,26,18,c.deep,1)
  ellipse(im,15.5,12.5,13,9,c.edge)
  ellipse(im,15.5,12,12,8,c.shine)
  ellipse(im,15.5,12.5,11,7,c.rim)
  ellipse(im,15.5,12,10,6,c.face)
  line(im,8,7,11,6,c.glint,1)
  line(im,12,5,18,5,c.glint,1)
  line(im,6,9,6,11,c.shine,1)
  -- A small recessed maker's star, with a one-pixel bevel at its foot.
  poly(im,{{15,8},{16,11},{20,12},{17,14},{16,17},{14,14},{11,13},{14,11}},c.shine)
  poly(im,{{15,8},{16,11},{19,12},{16,13},{15,16},{14,13},{11,12},{14,11}},c.engrave)
  px(im,15,11,c.face)
  save(sp,'token-'..(k-1));assets['token-'..(k-1)]=im:clone()
end

-- Vacant urban lot: laid-stone curb around compacted, weathered earth.
do
  local sp,im=new(64,64,'Stone curb and quiet earth')
  local edge=col('757760'); local top=col('e8dec9');local stone=col('bfbba4');local seam=col('93967e')
  rect(im,0,0,63,63,col('8b8b73'))
  rect(im,0,0,63,59,edge)
  rect(im,1,1,62,59,top)
  rect(im,2,3,61,61,stone)
  rect(im,5,5,58,58,col('8f9579'))
  rect(im,6,6,57,57,col('d1c6ac'))
  rect(im,7,7,56,56,col('d8ceb8'))
  line(im,6,6,57,6,col('b5ad92'))
  line(im,6,7,6,57,col('b5ad92'))
  line(im,7,57,57,57,col('e2d8c2'))
  line(im,57,7,57,56,col('e2d8c2'))
  -- Individual curb blocks; vertical breaks offset on opposing edges.
  for _,x in ipairs({15,31,47}) do
    line(im,x,1,x,4,seam);line(im,x+1,1,x+1,4,top)
  end
  for _,x in ipairs({10,26,42,56}) do
    line(im,x,59,x,62,seam);line(im,x+1,59,x+1,61,col('d1cbb4'))
  end
  for _,y in ipairs({14,30,46}) do
    line(im,1,y,4,y,seam);line(im,1,y+1,4,y+1,top)
  end
  for _,y in ipairs({10,26,42,56}) do
    line(im,59,y,62,y,seam);line(im,59,y+1,62,y+1,col('d8cfb6'))
  end
  -- Deterministic broken cobble marks, sparse through the number area.
  for y=9,54,4 do for x=9,54,5 do
    local hash=(x*73+y*131)%29
    local center=x>20 and x<44 and y>20 and y<44
    if hash<9 and not center then
      local c=hash%2==0 and col('c8bea7') or col('e0d6c0')
      line(im,x,y,x+(hash%3)+1,y,c)
      if hash==2 then px(im,x+2,y+1,col('c4bba3')) end
    end
  end end
  line(im,8,18,10,18,col('bdb8a0'));line(im,10,18,12,20,col('bdb8a0'))
  line(im,52,43,54,44,col('c1b9a2'));line(im,54,44,55,47,col('c1b9a2'))
  for _,p in ipairs({{7,49},{9,52},{48,7},{51,8}}) do
    px(im,p[1],p[2],col('8b9b78'));px(im,p[1]+1,p[2],col('a9ae86'))
  end
  rect(im,1,62,62,62,col('727963'))
  save(sp,'plot-ground');assets['plot-ground']=im:clone()
end

-- Consistent 32-pixel animal badges, intentionally no rasterized lettering.
local ink=col('183f36');local pale=col('f3df9f');local brass=col('e5c173');local umber=col('755334');local shade=col('9f783f')
local icons={}
local function animal(name,draw)
  local sp,im=new(32,32,'Hand-pixeled '..name)
  draw(im)
  save(sp,'zodiac-'..name);assets['zodiac-'..name]=im:clone();icons[#icons+1]=im:clone()
end
animal('snake',function(im)
  -- Curled jade snake, raised head to the right.
  ellipse(im,15,23,10,5,ink);ellipse(im,15,22,9,4,col('81ae75'))
  ellipse(im,15,21,5,2,ink);rect(im,5,20,8,22,col('94bd80'))
  poly(im,{{8,22},{10,23},{18,22},{22,18},{23,13},{21,10},{17,11},{16,15},{19,15},{18,18},{12,19}},ink)
  poly(im,{{10,21},{11,22},{18,21},{21,18},{22,13},{20,11},{18,12},{17,14},{20,14},{19,18},{13,20}},col('83b577'))
  ellipse(im,20,10,6,4,ink);ellipse(im,20,9.5,5,3,col('a7c885'))
  rect(im,21,7,24,10,col('b8cf8c'));px(im,23,8,ink)
  line(im,25,11,27,11,col('dc6f57'));px(im,28,10,col('dc6f57'));px(im,28,12,col('dc6f57'))
  line(im,10,25,17,25,col('d1d493'));px(im,21,17,col('bed397'));px(im,18,20,col('bed397'))
end)
animal('horse',function(im)
  poly(im,{{7,27},{8,20},{9,15},{11,11},{11,5},{14,8},{18,5},{20,11},{25,13},{27,18},{25,21},{20,20},{19,27}},ink)
  poly(im,{{8,27},{9,19},{11,14},{12,12},{12,6},{15,10},{18,7},{19,13},{24,14},{26,18},{24,20},{20,18},{18,27}},col('c89756'))
  poly(im,{{8,26},{8,20},{10,14},{12,11},{15,12},{12,16},{11,21},{11,27}},umber)
  poly(im,{{14,14},{17,11},{19,14},{19,19},{16,23},{16,27},{12,27},{13,21}},col('e5bd78'))
  line(im,19,16,24,18,col('e9c684'));rect(im,24,17,26,19,col('a47b4d'))
  px(im,19,13,ink);px(im,25,17,ink);px(im,13,7,brass)
  line(im,10,25,10,27,col('9f783f'))
end)
animal('goat',function(im)
  -- A cream muzzle, drooping ears, curved paired horns, and beard.
  line(im,11,10,7,6,ink,3);line(im,7,6,8,3,ink,2)
  line(im,20,10,24,6,ink,3);line(im,24,6,23,3,ink,2)
  line(im,11,9,8,6,brass,1);line(im,8,6,8,3,brass,1)
  line(im,20,9,23,6,brass,1);line(im,23,6,23,3,brass,1)
  poly(im,{{10,11},{4,12},{5,17},{10,19},{12,24},{15,29},{18,26},{21,19},{26,17},{27,12},{21,11}},ink)
  poly(im,{{10,12},{5,13},{6,16},{11,18},{13,24},{16,26},{19,23},{21,17},{25,16},{26,13},{21,12}},col('e2d5a9'))
  poly(im,{{11,10},{15,8},{20,10},{21,17},{19,22},{16,25},{12,22},{10,17}},pale)
  poly(im,{{12,21},{16,24},{19,21},{18,26},{15,28}},col('c4af79'))
  rect(im,11,14,13,15,ink);rect(im,18,14,20,15,ink)
  rect(im,14,20,17,21,shade);px(im,15,22,ink)
  line(im,6,14,9,16,col('b7a575'));line(im,22,16,25,14,col('b7a575'))
end)
animal('monkey',function(im)
  ellipse(im,6,16,4,5,ink);ellipse(im,25,16,4,5,ink)
  ellipse(im,6,16,3,4,col('ba8551'));ellipse(im,25,16,3,4,col('ba8551'))
  ellipse(im,6,16,1,2,brass);ellipse(im,25,16,1,2,brass)
  ellipse(im,15.5,15,10,11,ink);ellipse(im,15.5,15,9,10,umber)
  poly(im,{{11,8},{14,8},{16,10},{18,8},{21,10},{23,14},{22,20},{19,24},{12,24},{8,19},{8,13}},col('dbb476'))
  ellipse(im,11.5,13.5,4,4,pale);ellipse(im,19.5,13.5,4,4,pale)
  ellipse(im,15.5,20,6,5,col('ebca88'))
  rect(im,11,13,12,14,ink);rect(im,19,13,20,14,ink)
  rect(im,14,17,17,18,umber);line(im,12,21,14,23,umber);line(im,14,23,18,23,umber);line(im,18,23,20,21,umber)
  line(im,12,5,14,3,ink);line(im,14,3,17,5,ink)
end)
animal('rooster',function(im)
  -- Upright rooster with a red comb and layered green tail.
  poly(im,{{12,20},{7,19},{3,11},{7,11},{10,15},{7,7},{11,9},{14,16},{17,14},{22,15},{25,21},{21,25},{13,25}},ink)
  poly(im,{{12,20},{8,18},{5,13},{8,13},{12,17},{10,10},{12,12},{15,18}},col('6eaa82'))
  poly(im,{{12,20},{14,17},{18,16},{22,17},{24,21},{20,24},{14,24}},brass)
  ellipse(im,21,12,5,6,ink);ellipse(im,21,12,4,5,pale)
  rect(im,18,5,23,8,ink);rect(im,18,4,19,7,col('dc6f57'));rect(im,21,3,23,7,col('dc6f57'));rect(im,24,5,25,8,col('dc6f57'))
  poly(im,{{24,11},{29,13},{24,15}},shade);poly(im,{{25,12},{28,13},{25,14}},brass)
  px(im,23,10,ink);rect(im,23,15,25,18,col('dc6f57'))
  poly(im,{{17,17},{21,19},{21,22},{16,23},{14,20}},col('bd8c47'))
  line(im,16,24,16,28,shade);line(im,21,24,21,28,shade)
  line(im,14,28,17,28,shade);line(im,20,28,23,28,shade)
end)
animal('dog',function(im)
  poly(im,{{10,9},{6,7},{3,10},{4,21},{8,24},{11,20},{20,20},{24,24},{28,20},{28,10},{24,7},{20,9}},ink)
  poly(im,{{10,10},{6,8},{4,11},{5,20},{8,22},{11,17},{20,17},{24,22},{27,19},{27,11},{24,8},{20,10}},umber)
  poly(im,{{10,9},{15,7},{21,9},{23,15},{22,22},{19,26},{12,26},{9,23},{8,16}},col('d9b273'))
  poly(im,{{12,9},{16,8},{18,10},{17,17},{21,20},{20,25},{12,25},{10,21},{14,18}},pale)
  rect(im,10,14,12,15,ink);rect(im,20,14,21,15,ink)
  ellipse(im,15.5,21,5,4,col('ecd19b'));rect(im,14,19,18,21,ink)
  line(im,16,21,16,23,umber);line(im,13,24,19,24,umber)
  rect(im,16,25,18,27,col('dc6f57'));px(im,17,25,col('ee9b77'))
  px(im,6,11,col('a57e4e'));px(im,25,11,col('a57e4e'))
end)

-- Carved six-year board calendar: six medallions around a transparent center.
do
  local sp,im=new(192,192,'Carved calendar wood and brass')
  local cx,cy=95.5,95.5
  -- Hard-edged two-step shadow, deliberately kept pixel crisp.
  for y=1,191 do for x=0,191 do
    local d=((x-cx)^2+(y-(cy+4))^2)^.5
    if d<92 and d>45 then px(im,x,y,col('183f36',44)) end
  end end
  for y=3,187 do for x=3,187 do
    local dx,dy=x-cx,y-cy;local d=(dx*dx+dy*dy)^.5
    if d>=43 and d<=91 then
      local a=math.atan(dy,dx)
      local c
      if d>89 then c=col('183f36')
      elseif d>87 then c=dy<0 and col('f0d38d') or col('b28a4e')
      elseif d>83 then c=col('e5c173')
      elseif d>81 then c=col('674a30')
      elseif d<45 then c=col('183f36')
      elseif d<47 then c=dy<0 and col('b08b52') or col('ecd18a')
      elseif d<50 then c=col('e5c173')
      elseif d<52 then c=col('493e2b')
      else
        local sector=math.floor(((a+math.pi/2+math.pi/6)%(2*math.pi))/(math.pi/3))
        c=sector%2==0 and col('755334') or col('805c39')
        local grain=(math.floor(x/5)+y*7)%37
        if grain==1 then c=col('8c683f') elseif grain==7 then c=col('694b31') end
      end
      px(im,x,y,c)
    end
  end end
  -- Thin brass division joints, between the animal medallions.
  for i=0,5 do
    local a=-math.pi/2+math.pi/6+i*math.pi/3
    line(im,math.floor(cx+53*math.cos(a)),math.floor(cy+53*math.sin(a)),math.floor(cx+81*math.cos(a)),math.floor(cy+81*math.sin(a)),col('493e2b'),3)
    line(im,math.floor(cx+53*math.cos(a)),math.floor(cy+53*math.sin(a)),math.floor(cx+81*math.cos(a)),math.floor(cy+81*math.sin(a)),col('bd9959'),1)
    local tx=math.floor(cx+85*math.cos(a)+.5);local ty=math.floor(cy+85*math.sin(a)+.5)
    ellipse(im,tx,ty,2,2,ink);px(im,tx,ty-1,pale);px(im,tx-1,ty,brass)
  end
  -- Small engraved outer tick marks.
  for i=0,59 do
    local a=-math.pi/2+i*math.pi/30
    local r=84
    if i%10~=5 then
      local x=math.floor(cx+r*math.cos(a)+.5);local y=math.floor(cy+r*math.sin(a)+.5)
      px(im,x,y,col('9e7d48'))
      if i%5==0 then px(im,math.floor(cx+86*math.cos(a)+.5),math.floor(cy+86*math.sin(a)+.5),col('9e7d48')) end
    end
  end
  for i=0,5 do
    local a=-math.pi/2+i*math.pi/3
    local x=math.floor(cx+68*math.cos(a)+.5);local y=math.floor(cy+68*math.sin(a)+.5)
    ellipse(im,x,y+1,18,18,col('493e2b'))
    ellipse(im,x,y,17,17,col('e5c173'))
    ellipse(im,x,y,15,15,col('183f36'))
    ellipse(im,x,y-1,14,14,col('254e40'))
    -- Art has a one-pixel built-in margin and fits the dark inset.
    im:drawImage(icons[i+1],Point(x-16,y-16))
    px(im,x-11,y-11,col('f3df9f'));px(im,x-10,y-12,col('f3df9f'))
  end
  save(sp,'calendar-wheel');assets['calendar-wheel']=im:clone()
end

-- Seamless road surface, quiet enough for road markings drawn by the UI.
do
  local sp,im=new(64,64,'Seamless compacted road')
  rect(im,0,0,63,63,col('596f64'))
  for y=0,63 do for x=0,63 do
    local n=(x*41+y*89+x*y*13)%127
    if n<4 then px(im,x,y,col('61776a'))
    elseif n==31 or n==53 then px(im,x,y,col('52685e'))
    elseif n==90 then px(im,x,y,col('718276')) end
  end end
  save(sp,'street-texture');assets['street-texture']=im:clone()
end

-- Editable native atlas and presentation contact sheet. Every asset stays native 1x.
do
  local sp,im=new(384,272,'Warm paper backing')
  rect(im,0,0,383,271,col('e8ddc2'))
  rect(im,8,8,375,263,col('ddd0ae'))
  local function tile(name,x,y)
    local layer=sp:newLayer();layer.name=name
    sp:newCel(layer,1,assets[name],Point(x,y))
  end
  tile('calendar-wheel',12,10)
  tile('plot-ground',224,24);tile('street-texture',304,24)
  for i=0,3 do tile('token-'..i,224+(i%2)*64,108+math.floor(i/2)*52) end
  local names={'snake','horse','goat','monkey','rooster','dog'}
  for i,name in ipairs(names) do tile('zodiac-'..name,20+(i-1)*60,220) end
  save(sp,'materials-atlas')
end
print('Finished original Aseprite materials: 13 PNG assets plus layered native atlas.')
