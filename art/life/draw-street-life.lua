-- Original pixel-coordinate artwork drawn and exported by native Aseprite Lua.
-- All marks are fictional game art. No sampled photos, generated imagery, or real banknote art.
local OUT='/private/tmp/vietnamtown-v3-life/'
local C={};local hex={ink='183d3c',shade='315452',stone='99a995',sand='d6c99d',cream='f8e8b9',light='fff4d1',ochre='d9a55a',ochreDark='aa7046',brick='ad5140',terra='d96c49',tile='ef9560',red='d94546',pink='ee6f9f',pinkLite='ffa1bb',pinkDark='b94678',purple='703e65',glass='326c73',aqua='79bdb0',jade='397a57',leaf='66a45b',leafHi='a4cb77',trunk='885b3c',river='469895',riverLight='87c9b6',white='fff8db',skin='dcb27d',skinShade='b67f56',helmet='efb24f'}
for k,v in pairs(hex) do C[k]=app.pixelColor.rgba(tonumber(v:sub(1,2),16),tonumber(v:sub(3,4),16),tonumber(v:sub(5,6),16),255) end
C.shadow=app.pixelColor.rgba(24,61,60,65)
local I
local function dot(x,y,c) x=math.floor(x);y=math.floor(y);if x>=0 and y>=0 and x<I.width and y<I.height then I:drawPixel(x,y,C[c] or c) end end
local function rect(x,y,w,h,c) for yy=y,y+h-1 do for xx=x,x+w-1 do dot(xx,yy,c) end end end
local function line(x0,y0,x1,y1,c)
 local dx=math.abs(x1-x0);local sx=x0<x1 and 1 or -1;local dy=-math.abs(y1-y0);local sy=y0<y1 and 1 or -1;local er=dx+dy
 while true do dot(x0,y0,c);if x0==x1 and y0==y1 then break end;local e2=2*er;if e2>=dy then er=er+dy;x0=x0+sx end;if e2<=dx then er=er+dx;y0=y0+sy end end
end
local function poly(p,c,outline)
 local miny,maxy=9999,-9999;for _,v in ipairs(p) do miny=math.min(miny,v[2]);maxy=math.max(maxy,v[2]) end
 for y=miny,maxy do local nodes={};local j=#p;for i=1,#p do local a,b=p[i],p[j];if (a[2]<=y and b[2]>y) or (b[2]<=y and a[2]>y) then nodes[#nodes+1]=a[1]+(y-a[2])/(b[2]-a[2])*(b[1]-a[1]) end;j=i end;table.sort(nodes);for i=1,#nodes-1,2 do for x=math.ceil(nodes[i]),math.floor(nodes[i+1]) do dot(x,y,c) end end end
 if outline then for j=1,#p do local a,b=p[j],p[j%#p+1];line(a[1],a[2],b[1],b[2],outline) end end
end
local function disk(x,y,rx,ry,c) for yy=y-ry,y+ry do for xx=x-rx,x+rx do if ((xx-x)^2)/(rx*rx)+((yy-y)^2)/(ry*ry)<=1 then dot(xx,yy,c) end end end end
local function box(x,y,w,h,c) rect(x,y,w,h,'ink');rect(x+1,y+1,w-2,h-2,c) end
local function layer(s,name,fn,frame)
 local l=s:newLayer();l.name=name;I=Image(s.width,s.height,ColorMode.RGB);I:clear();fn();s:newCel(l,frame or 1,I,Point(0,0));return l
end
local art={}
local function make(name,w,h,fn)
 local s=Sprite(w,h,ColorMode.RGB);s:deleteLayer(s.layers[1]);s.gridBounds=Rectangle(0,0,1,1);s.data='Vietnamtown original native Aseprite pixel art; integer pixels, transparent background, editable semantic layers.';fn(s);s:saveAs(OUT..name..'.aseprite');s:saveCopyAs(OUT..name..'.png');art[#art+1]={name=name,sprite=s,image=Image(s)};return s
end
local function wheel(x,y,r) disk(x,y,r,r,'ink');disk(x,y,r-2,r-2,'stone');dot(x,y,'cream') end
make('ninja-lead',48,48,function(s)
 layer(s,'01 Ground shadow and wheels',function() disk(25,42,21,3,'shadow');wheel(11,38,5);wheel(36,38,5);line(34,35,36,38,'stone');rect(5,39,3,2,'shade') end)
 layer(s,'02 Lead-style scooter body',function()
  poly({{5,32},{7,27},{15,26},{21,29},{24,34},{29,34},{30,24},{34,21},{38,23},{40,33},{35,35},{30,39},{14,39},{9,35}},'aqua','ink')
  poly({{6,31},{10,29},{17,29},{22,32},{20,35},{10,34}},'riverLight');line(8,35,17,37,'river');rect(23,36,9,2,'cream');line(31,28,31,34,'riverLight')
  poly({{34,24},{36,24},{38,29},{34,30}},'cream','ink');dot(36,26,'light');rect(6,30,2,3,'red');rect(8,26,14,3,'ink');rect(10,26,11,1,'cream');line(34,20,39,20,'ink');line(35,20,33,15,'ink');rect(31,14,5,2,'ink');rect(32,14,3,1,'aqua');rect(40,32,2,3,'ochre')
 end)
 layer(s,'03 Sun-protection skirt and sleeve',function()
  poly({{17,14},{25,14},{29,19},{29,24},{27,28},{29,35},{22,35},{19,29},{13,26},{14,21}},'pinkDark','ink')
  poly({{16,18},{22,18},{25,25},{23,29},{26,33},{23,33},{19,27},{15,25}},'pinkLite');line(17,19,16,24,'cream');line(20,26,22,29,'pink')
  poly({{23,17},{26,17},{30,21},{34,20},{35,23},{29,24},{24,21}},'pinkDark','ink');line(26,18,30,22,'pinkLite');rect(33,20,3,3,'cream');dot(35,20,'sand')
  rect(25,34,7,2,'ink');rect(27,34,4,1,'cream');rect(15,14,5,3,'pinkLite');line(15,16,14,18,'cream');dot(18,21,'cream');dot(21,30,'cream');dot(24,31,'cream')
 end)
 layer(s,'04 Helmet, eyes and face covering',function()
  poly({{17,8},{19,4},{26,4},{29,7},{29,13},{26,17},{19,16},{16,13}},'pinkLite','ink')
  poly({{17,8},{19,4},{25,3},{29,6},{30,9},{17,9}},'helmet','ink');line(20,5,26,5,'cream');line(17,10,30,10,'ink');rect(23,10,6,3,'skin');rect(26,11,2,1,'ink');rect(28,12,2,1,'skinShade')
  poly({{21,13},{28,13},{28,16},{24,18},{20,16}},'pinkLite','ink');rect(23,14,4,2,'cream');line(20,11,20,13,'ink');dot(19,12,'pinkDark')
 end)
end)
make('city-bus',72,40,function(s)
 layer(s,'01 Road shadow and wheels',function() disk(36,36,33,3,'shadow');wheel(16,33,5);wheel(56,33,5) end)
 layer(s,'02 Cream roof and green body',function()
  poly({{3,10},{7,5},{60,5},{67,9},{69,16},{69,30},{65,34},{61,34},{60,29},{53,28},{50,34},{22,34},{20,29},{12,28},{10,34},{4,33},{2,28}},'jade','ink')
  poly({{3,10},{7,5},{60,5},{65,8},{65,12},{4,12}},'cream','ink');line(7,6,58,6,'light');line(6,8,61,8,'sand');rect(5,12,60,11,'cream');rect(4,24,63,3,'ochre');rect(4,24,63,1,'cream');rect(4,31,6,1,'leaf');rect(24,30,23,2,'leaf');rect(62,31,4,1,'leaf')
  rect(3,27,3,2,'red');rect(66,27,3,2,'light');rect(65,30,5,2,'ink');rect(4,33,5,1,'stone');rect(25,33,23,1,'stone')
 end)
 layer(s,'03 Passenger windows and door',function()
  for x=7,40,11 do box(x,13,10,10,'glass');rect(x+1,14,8,2,'aqua');line(x+2,16,x+6,16,'riverLight');rect(x+2,20,5,2,'shade') end
  -- One passenger silhouette with skin/hat visible behind a window.
  rect(23,17,3,3,'ochre');rect(22,20,5,2,'terra');dot(26,18,'sand')
  box(50,12,10,21,'shade');rect(52,14,6,9,'glass');rect(52,14,6,2,'aqua');line(55,13,55,31,'cream');rect(52,25,6,5,'jade');rect(51,31,8,1,'stone');dot(54,24,'cream');dot(56,24,'cream')
  poly({{61,12},{65,12},{67,18},{67,23},{61,23}},'glass','ink');rect(62,13,2,3,'aqua');line(67,15,70,15,'ink');rect(69,15,2,5,'ink');rect(69,16,1,3,'aqua')
 end)
 layer(s,'04 Driver and city route details',function()
  rect(62,18,3,3,'skin');rect(62,17,3,1,'ink');rect(61,21,4,2,'cream');dot(64,19,'ink');line(65,21,66,22,'ink')
  rect(8,9,17,3,'ink');rect(9,10,2,1,'cream');rect(12,10,3,1,'cream');rect(16,10,2,1,'cream');rect(20,10,3,1,'ochre')
  rect(29,27,13,1,'cream');rect(31,29,9,1,'cream');rect(8,25,3,1,'red');rect(44,28,4,1,'aqua');rect(5,17,1,4,'leafHi');rect(13,33,6,1,'stone');rect(54,33,5,1,'stone')
 end)
end)
local function personBody(bob)
 poly({{8,11+bob},{14,11+bob},{16,17+bob},{14,22+bob},{8,22+bob},{6,18+bob}},'cream','ink');rect(9,12+bob,4,8,'light');line(8,16+bob,7,19+bob,'sand');rect(11,12+bob,1,3,'red');dot(11,16+bob,'ochreDark')
end
local function personHead(bob)
 poly({{8,4+bob},{12,3+bob},{16,5+bob},{16,9+bob},{14,12+bob},{9,11+bob},{7,8+bob}},'skin','ink');rect(8,4+bob,6,2,'ink');rect(7,5+bob,3,4,'ink');dot(15,7+bob,'ink');rect(15,8+bob,2,1,'skin');rect(10,10+bob,3,1,'skinShade')
 -- A simple peaked cap gives a readable silhouette without obscuring the person.
 poly({{7,5+bob},{8,3+bob},{13,2+bob},{15,4+bob},{18,5+bob}},'terra','ink');line(9,3+bob,12,3+bob,'tile')
end
local poses={
 {bob=0,far={{11,21},{13,22},{10,27},{7,29},{5,28},{9,24}},near={{10,21},{13,21},{15,25},{18,28},{17,30},{14,29},{11,26}}},
 {bob=1,far={{11,22},{14,22},{14,28},{11,29},{10,28}},near={{9,22},{12,22},{13,28},{15,29},{15,31},{10,31},{9,28}}},
 {bob=0,far={{10,21},{12,21},{15,25},{18,28},{17,30},{14,29},{11,26}},near={{11,21},{14,22},{10,27},{7,29},{5,28},{9,24}}},
 {bob=1,far={{9,22},{12,22},{13,28},{15,29},{15,31},{10,31},{9,28}},near={{11,22},{14,22},{14,28},{11,29},{10,28}}}
}
local ped=Sprite(24,32,ColorMode.RGB);ped:deleteLayer(ped.layers[1]);ped.gridBounds=Rectangle(0,0,1,1)
local pedLayers={};for _,n in ipairs({'01 Ground shadow','02 Far leg','03 Near leg','04 Shirt and swinging arms','05 Head and cap'}) do local l=ped:newLayer();l.name=n;pedLayers[#pedLayers+1]=l end
for f,p in ipairs(poses) do
 if f>1 then ped:newFrame() end;ped.frames[f].duration=0.16
 local draws={function() disk(12,30,8,1,'shadow') end,function() poly(p.far,'glass','ink');end,function() poly(p.near,'river','ink');end,function()
  personBody(p.bob)
  if f==1 or f==3 then line(7,14+p.bob,4,20+p.bob,'ink');line(8,15+p.bob,5,20+p.bob,'skin');rect(4,20+p.bob,2,2,'skin');line(14,14+p.bob,17,18+p.bob,'ink');line(16,18+p.bob,18,16+p.bob,'skin')
  else line(7,14+p.bob,7,21+p.bob,'ink');line(8,15+p.bob,8,20+p.bob,'sand');rect(7,21+p.bob,2,2,'skin');line(15,14+p.bob,16,20+p.bob,'ink');rect(15,20+p.bob,2,2,'skin') end
 end,function() personHead(p.bob) end}
 for j,fn in ipairs(draws) do I=Image(24,32,ColorMode.RGB);I:clear();fn();local old=pedLayers[j]:cel(f);if old then ped:deleteCel(old) end;ped:newCel(pedLayers[j],f,I,Point(0,0)) end
end
local tag=ped:newTag(1,4);tag.name='walk';tag.aniDir=AniDir.FORWARD;ped.data='Four-frame 160ms walking loop. Faces right. Native 24x32. Exported horizontal sheet 96x32; CSS steps(4).'
ped:saveAs(OUT..'pedestrian-walk.aseprite')
local sheet=Sprite(96,32,ColorMode.RGB);sheet:deleteLayer(sheet.layers[1]);local sl=sheet:newLayer();sl.name='Four walking frames - each 24x32';I=Image(96,32,ColorMode.RGB);I:clear()
for f=1,4 do local im=Image(24,32,ColorMode.RGB);im:drawSprite(ped,f,Point(0,0));I:drawImage(im,Point((f-1)*24,0)) end
sheet:newCel(sl,1,I,Point(0,0));sheet:saveAs(OUT..'pedestrian-walk-sheet.aseprite');sheet:saveCopyAs(OUT..'pedestrian-walk.png')
local still=Sprite(24,32,ColorMode.RGB);still:deleteLayer(still.layers[1]);local il=still:newLayer();il.name='Walk frame 1';I=Image(24,32,ColorMode.RGB);I:drawSprite(ped,1,Point(0,0));still:newCel(il,1,I,Point(0,0));still:saveAs(OUT..'pedestrian.aseprite');still:saveCopyAs(OUT..'pedestrian.png');art[#art+1]={name='pedestrian',sprite=still,image=Image(still)}
local digits={['1']={'010','110','010','010','111'},['0']={'111','101','101','101','111'}}
local function number(t,x,y,c) for char in t:gmatch('.') do for yy,row in ipairs(digits[char]) do for xx=1,3 do if row:sub(xx,xx)=='1' then dot(x+xx-1,y+yy-1,c) end end end;x=x+4 end end
make('game-banknote',48,24,function(s)
 layer(s,'01 Fictional paper and border',function() rect(0,2,47,21,'shadow');box(1,1,46,21,'aqua');rect(3,3,42,17,'cream');rect(4,4,40,15,'aqua');rect(5,5,38,13,'riverLight');for x=5,41,3 do dot(x,3,'aqua');dot(x,19,'aqua') end end)
 layer(s,'02 Lotus and patterned security-like ornament',function()
  disk(26,11,8,7,'river');disk(26,11,7,6,'aqua');poly({{26,6},{23,10},{26,14},{29,10}},'cream','jade');poly({{20,9},{21,14},{26,15},{25,12}},'cream','jade');poly({{32,9},{31,14},{26,15},{27,12}},'cream','jade');line(22,16,30,16,'jade')
  for y=6,16,2 do line(36,y,41,y,'aqua');dot(35,y+1,'cream') end
 end)
 layer(s,'03 Game value ten dong symbol',function()
  number('10',7,8,'ink');number('10',37,13,'jade')
  -- Lowercase dong mark: d stem with a horizontal stroke.
  rect(17,8,1,5,'ink');rect(15,10,3,1,'ink');rect(14,11,1,3,'ink');rect(15,14,3,1,'ink');rect(17,10,1,5,'ink');line(15,8,19,8,'ink')
  line(7,16,17,16,'jade');dot(6,6,'light');dot(42,17,'light')
 end)
end)
-- Review contact sheet, enlarged using Aseprite nearest-neighbor.
local contact=Sprite(256,144,ColorMode.RGB);contact:deleteLayer(contact.layers[1]);I=Image(256,144,ColorMode.RGB);I:clear();rect(0,0,256,144,'cream');rect(0,0,256,3,'ink');
local positions={{8,6},{74,16},{170,18},{195,22}}
for n,a in ipairs(art) do local p=positions[n];if p then I:drawImage(a.image,Point(p[1],p[2])) end end
I:drawImage(Image(sheet),Point(14,75));line(8,65,246,65,'sand')
local cl=contact:newLayer();cl.name='Review presentation';contact:newCel(cl,1,I,Point(0,0));contact:saveAs(OUT..'contact-sheet.aseprite');contact:resize(1024,576);contact:saveCopyAs(OUT..'contact-sheet.png')
print('Aseprite native assets saved to '..OUT)
