-- Original pixel-coordinate artwork. Rendered by Aseprite's native Lua image API.
-- All architecture is fictionalized for the Vietnamtown board game.
local OUT = '/private/tmp/vietnamtown-landmarks/'
local C={}
local hex={ink='183d3c',shade='315452',stone='99a995',sand='d6c99d',cream='f8e8b9',light='fff4d1',ochre='d9a55a',ochreDark='aa7046',brick='ad5140',terra='d96c49',tile='ef9560',red='d94546',pink='ee6f9f',pinkLite='ffa1bb',pinkDark='b94678',purple='703e65',glass='326c73',aqua='79bdb0',jade='397a57',leaf='66a45b',leafHi='a4cb77',trunk='885b3c',river='469895',riverLight='87c9b6',white='fff8db'}
for k,v in pairs(hex) do C[k]=app.pixelColor.rgba(tonumber(v:sub(1,2),16),tonumber(v:sub(3,4),16),tonumber(v:sub(5,6),16),255) end
C.shadow=app.pixelColor.rgba(24,61,60,65)
local I
local function dot(x,y,c) x=math.floor(x); y=math.floor(y); if x>=0 and y>=0 and x<I.width and y<I.height then I:drawPixel(x,y,C[c] or c) end end
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
local function box(x,y,w,h,fill,edge) rect(x,y,w,h,edge or 'ink');rect(x+1,y+1,w-2,h-2,fill) end
local function disk(x,y,rx,ry,c) for yy=y-ry,y+ry do for xx=x-rx,x+rx do if ((xx-x)^2)/(rx*rx)+((yy-y)^2)/(ry*ry)<=1 then dot(xx,yy,c) end end end end
local function arch(x,y,w,h,fill)
 rect(x+1,y+2,w-2,h-2,'ink');rect(x+2,y+1,w-4,2,'ink');rect(x+3,y,w-6,1,'ink');rect(x+2,y+3,w-4,h-3,fill);rect(x+3,y+2,w-6,2,fill)
end
local function window(x,y,w,h)
 box(x,y,w,h,'glass');rect(x+1,y+1,w-2,1,'aqua');line(x+math.floor(w/2),y+1,x+math.floor(w/2),y+h-2,'sand');rect(x-1,y+h,w+2,1,'cream')
end
local function ground()
 poly({{9,77},{69,66},{90,78},{80,85},{27,89},{6,82}},'shadow')
 poly({{12,74},{69,64},{86,75},{79,80},{27,85},{10,81}},'sand','ink')
 line(12,76,27,82,'cream');line(27,82,78,77,'cream');line(27,84,78,79,'ochreDark')
end
local function tree(x,y,scale)
 local r=scale or 10
 rect(x-1,y-r,3,r+7,'ink');rect(x,y-r,1,r+5,'trunk');line(x,y-2,x-4,y-7,'trunk')
 disk(x,y-r-4,r,r,'ink');disk(x-3,y-r-6,r-2,r-3,'jade');disk(x+4,y-r-7,r-3,r-3,'leaf');disk(x-3,y-r-10,r-4,r-4,'leafHi');disk(x+5,y-r-1,r-5,r-5,'leaf')
end
local function palm(x,y,h)
 poly({{x-2,y},{x,y-h},{x+2,y-h},{x+1,y}},'trunk','ink');for yy=y-h+6,y-2,5 do line(x-1,yy,x+1,yy-1,'ochre') end
 local yy=y-h
 for _,p in ipairs({{{x,yy},{x-11,yy-7},{x-18,yy-2},{x-9,yy-3}},{{x,yy},{x-10,yy+2},{x-14,yy+12},{x-6,yy+5}},{{x,yy},{x+9,yy-7},{x+17,yy-3},{x+8,yy-3}},{{x,yy},{x+11,yy+2},{x+14,yy+11},{x+6,yy+5}},{{x,yy},{x-2,yy-11},{x+3,yy-15},{x+2,yy-4}}}) do poly(p,'jade','ink') end
 line(x-12,yy-3,x-4,yy-3,'leafHi');line(x+4,yy-3,x+13,yy-4,'leafHi');line(x-7,yy+3,x-10,yy+7,'leaf');line(x+6,yy+3,x+10,yy+7,'leaf');line(x,yy-9,x+1,yy-12,'leafHi')
end
local function roof(x,y,w,depth)
 poly({{x,y},{x+depth,y-depth},{x+w+depth,y-depth},{x+w,y}},'terra','ink')
 for yy=2,depth-2,3 do line(x+yy,y-yy,x+w+yy,y-yy,'tile') end
 for xx=4,w-3,7 do line(x+xx,y-1,x+xx+depth-2,y-depth+1,'brick') end
 line(x+1,y,x+w-1,y,'ochreDark')
end
local function house(x,y,w,h,body)
 local d=8
 poly({{x+w,y},{x+w+d,y-d},{x+w+d,y+h-d},{x+w,y+h}},'ochreDark','ink')
 box(x,y,w,h,body or 'ochre');rect(x+1,y+1,w-2,2,'cream');roof(x-2,y,w+4,d)
end
local function shrub(x,y) disk(x,y,6,4,'ink');disk(x-2,y-1,4,3,'leaf');disk(x+3,y,3,2,'jade');dot(x-3,y-2,'leafHi') end
local function stall(x,y,w,color)
 box(x+1,y+7,w-2,8,'ochre');rect(x+2,y+8,w-4,2,'cream');line(x+2,y+1,x+2,y+9,'ink');line(x+w-3,y+1,x+w-3,y+9,'ink')
 poly({{x,y},{x+3,y-5},{x+w-3,y-5},{x+w,y}},color or 'red','ink')
 for xx=x+3,x+w-4,6 do poly({{xx,y-1},{xx+2,y-4},{xx+4,y-4},{xx+3,y-1}},'cream') end
 rect(x,y,w,3,'ink');for xx=x+1,x+w-2 do dot(xx,y+1,(math.floor((xx-x)/3)%2==0) and (color or 'red') or 'cream') end
 disk(x+4,y+7,2,2,'leafHi');disk(x+8,y+7,2,2,'red');disk(x+12,y+7,2,2,'ochre')
end
local function scooter(x,y)
 disk(x,y,3,3,'ink');disk(x+12,y,3,3,'ink');dot(x,y,'sand');dot(x+12,y,'sand')
 poly({{x-2,y-5},{x+4,y-7},{x+7,y-4},{x+10,y-4},{x+10,y-10},{x+13,y-10},{x+14,y-3},{x+9,y-1},{x+1,y-1}},'aqua','ink')
 rect(x,y-8,6,2,'ink');rect(x+1,y-7,3,1,'cream');line(x+10,y-11,x+15,y-11,'ink');rect(x+13,y-9,2,2,'cream')
end
local font={A={'010','101','111','101','101'},B={'110','101','110','101','110'},C={'011','100','100','100','011'},D={'110','101','101','101','110'},E={'111','100','110','100','111'},F={'111','100','110','100','100'},G={'011','100','101','101','011'},H={'101','101','111','101','101'},I={'111','010','010','010','111'},J={'001','001','001','101','010'},K={'101','101','110','101','101'},L={'100','100','100','100','111'},M={'10001','11011','10101','10001','10001'},N={'1001','1101','1011','1001','1001'},O={'010','101','101','101','010'},P={'110','101','110','100','100'},Q={'010','101','101','111','011'},R={'110','101','110','101','101'},S={'011','100','010','001','110'},T={'111','010','010','010','010'},U={'101','101','101','101','111'},V={'101','101','101','101','010'},W={'10001','10001','10101','10101','01010'},X={'101','101','010','101','101'},Y={'101','101','010','010','010'},Z={'111','001','010','100','111'},[' ']={'0','0','0','0','0'},['-']={'000','000','111','000','000'},['0']={'111','101','101','101','111'},['1']={'010','110','010','010','111'},['2']={'110','001','010','100','111'},['3']={'110','001','010','001','110'},['4']={'101','101','111','001','001'},['5']={'111','100','110','001','110'},['6']={'011','100','111','101','111'},['7']={'111','001','010','010','010'},['8']={'111','101','111','101','111'},['9']={'111','101','111','001','110'}}
local function textWidth(t) local w=0;for ch in t:gmatch('.') do local f=font[ch] or font[' '];w=w+#f[1]+1 end;return w-1 end
local function label(t,x,y,c) for ch in t:gmatch('.') do local f=font[ch] or font[' '];for yy,row in ipairs(f) do for xx=1,#row do if row:sub(xx,xx)=='1' then dot(x+xx-1,y+yy-1,c) end end end;x=x+#f[1]+1 end end

local art={}
local function layer(s,name,fn)
 local l=s:newLayer();l.name=name;I=Image(96,96,ColorMode.RGB);I:clear();fn();s:newCel(l,1,I,Point(0,0));return l
end
local function make(name,fn)
 local s=Sprite(96,96,ColorMode.RGB);s:deleteLayer(s.layers[1]);s.gridBounds=Rectangle(0,0,1,1);s.data='Original Aseprite pixel artwork for Vietnamtown. Fictionalized Saigon neighborhood landmark. Native 96x96; nearest-neighbor display only.';fn(s);s:saveAs(OUT..name..'.aseprite');s:saveCopyAs(OUT..name..'.png');art[#art+1]={name=name,sprite=s,image=Image(s)}
end

make('tan-dinh',function(s)
 layer(s,'01 Courtyard and shadow',function() ground();line(28,80,63,76,'ochreDark');line(25,77,66,73,'cream') end)
 layer(s,'02 Nave and chapels',function()
  poly({{39,49},{58,30},{76,41},{76,71},{60,78},{39,70}},'pinkDark','ink')
  poly({{38,48},{57,28},{76,40},{58,59}},'pink','ink');line(40,46,58,29,'pinkLite');line(48,48,63,34,'pinkDark');line(55,52,70,39,'pinkDark')
  poly({{58,58},{76,40},{76,71},{58,79}},'pinkDark','ink');line(61,57,74,44,'pinkLite')
  for k=0,2 do arch(61+k*5,60-k*5,5,11,'purple');line(60+k*5,72-k*5,64+k*5,69-k*5,'pinkLite') end
  box(22,57,38,23,'pink');rect(23,59,36,2,'pinkLite');arch(26,66,9,13,'purple');arch(46,64,9,15,'purple')
  for _,x in ipairs({21,54}) do box(x,48,10,31,'pink');poly({{x-1,48},{x+5,39},{x+11,48}},'pinkDark','ink');rect(x+2,48,6,2,'pinkLite');arch(x+2,53,6,8,'purple');rect(x+1,64,8,2,'cream') end
 end)
 layer(s,'03 Bell tower and white tracery',function()
  poly({{34,27},{44,22},{49,25},{49,74},{44,81},{34,78}},'pinkDark','ink');box(31,28,15,53,'pink')
  rect(32,30,13,2,'pinkLite');rect(30,42,17,3,'cream');rect(30,55,17,3,'cream');rect(32,43,13,1,'pinkDark');rect(32,56,13,1,'pinkDark')
  arch(34,32,9,9,'purple');line(38,33,38,40,'pinkLite');arch(34,46,9,8,'purple');line(38,47,38,52,'pinkLite');arch(34,64,9,17,'purple');line(38,67,38,80,'pinkDark')
  rect(29,27,19,3,'pinkLite');poly({{31,26},{38,13},{46,26}},'pinkDark','ink');poly({{33,25},{38,15},{40,25}},'pinkLite');rect(36,11,5,4,'pink');rect(37,4,3,11,'ink');rect(34,7,9,3,'ink');line(38,5,38,13,'cream');line(35,8,41,8,'cream')
  disk(38,60,3,3,'cream');disk(38,60,1,1,'pinkDark');rect(28,80,23,2,'cream');rect(27,82,25,2,'ochreDark');line(29,82,50,82,'sand')
  for _,x in ipairs({31,44}) do line(x,60,x,77,'pinkLite') end
 end)
 layer(s,'04 Garden edges',function() shrub(18,78);shrub(72,75);rect(76,76,5,5,'ochreDark');rect(75,76,7,2,'ochre');disk(78,71,4,5,'jade');disk(77,69,3,3,'leaf') end)
end)

make('ben-thanh',function(s)
 layer(s,'01 Paved plaza',function() ground();line(17,79,30,81,'cream');line(60,79,76,76,'cream') end)
 layer(s,'02 Market hall',function()
  house(13,53,62,25,'ochre');roof(10,53,66,17)
  for x=17,67,10 do arch(x,60,8,17,'glass');rect(x-1,76,10,2,'cream');rect(x-1,55,10,2,'cream') end
  line(14,58,73,58,'ochreDark');line(76,55,81,50,'cream');window(77,59,5,9)
 end)
 layer(s,'03 Clock tower gateway',function()
  poly({{40,33},{49,27},{58,32},{58,74},{50,82},{40,77}},'ochreDark','ink');box(33,33,20,48,'cream');rect(34,35,18,2,'light');rect(34,53,18,3,'ochre');rect(32,55,22,3,'ochreDark');rect(32,55,21,1,'cream')
  poly({{29,34},{36,23},{49,23},{57,33},{53,36},{32,36}},'terra','ink');line(32,32,53,32,'tile');line(34,28,51,28,'tile');rect(36,21,13,3,'ochreDark');line(37,21,48,21,'cream')
  disk(43,44,7,7,'ink');disk(43,44,6,6,'light');dot(43,39,'ink');dot(48,44,'ink');dot(43,49,'ink');dot(38,44,'ink');line(43,44,43,40,'ink');line(43,44,46,46,'ink')
  arch(37,63,13,19,'glass');arch(40,65,7,17,'ink');rect(35,60,16,2,'terra');rect(35,78,2,3,'ochre');rect(50,77,2,4,'ochre');rect(31,81,24,2,'sand');rect(30,83,26,2,'ochreDark')
  line(54,38,56,36,'cream');line(54,52,56,50,'cream');rect(54,59,2,10,'glass')
 end)
 layer(s,'04 Market life',function() stall(63,75,19,'red');rect(15,78,7,5,'ochreDark');rect(14,77,9,2,'cream');disk(18,72,5,5,'jade');disk(16,70,3,3,'leaf');dot(20,69,'leafHi') end)
end)

make('thao-dien',function(s)
 layer(s,'01 Riverside terrace',function()
  ground();poly({{8,79},{29,84},{80,74},{87,78},{79,86},{29,93},{8,86}},'river','ink');line(13,84,27,88,'riverLight');line(30,89,42,87,'riverLight');line(63,85,77,82,'riverLight');line(51,87,56,86,'aqua');poly({{11,75},{27,81},{81,71},{82,75},{27,85},{11,79}},'cream','ink')
 end)
 layer(s,'02 Garden and rear villa',function()
  tree(72,62,10);house(48,40,23,29,'cream');roof(45,40,29,8);window(52,46,7,9);window(62,46,6,9);box(56,58,8,11,'glass');rect(47,54,24,3,'ochre');line(72,42,76,38,'cream')
 end)
 layer(s,'03 Main villa and veranda',function()
  house(20,45,30,30,'cream');roof(17,45,36,11);window(25,50,8,10);window(38,50,8,10);box(30,63,10,12,'glass');rect(31,64,3,9,'aqua');rect(19,60,32,3,'ochreDark');rect(19,60,31,1,'cream');rect(22,64,2,13,'cream');rect(46,63,2,13,'cream');rect(19,76,31,3,'ochre');rect(18,79,33,2,'sand');line(21,77,48,77,'light')
  line(25,44,51,36,'tile');rect(31,29,5,9,'ochreDark');rect(30,28,7,2,'cream')
 end)
 layer(s,'04 Palms and riverside detail',function()
  palm(75,73,33);shrub(62,71);box(63,74,7,4,'ochre');rect(64,73,5,1,'leaf');rect(17,76,4,5,'ochre');palm(20,72,24);line(54,76,77,71,'ink');line(55,75,55,79,'ink');line(68,72,68,76,'ink');line(78,70,78,74,'ink')
 end)
end)

make('cho-lon',function(s)
 layer(s,'01 Trading courtyard',function() ground();line(23,81,77,73,'ochreDark') end)
 layer(s,'02 Market wings',function()
  house(12,52,62,26,'ochre');roof(9,52,68,13);for x=16,67,10 do arch(x,61,8,16,'glass');rect(x-1,57,9,2,'cream') end
  poly({{8,53},{14,47},{22,48},{70,44},{85,40},{81,49},{74,52}},'terra','ink');line(14,49,74,47,'tile');line(21,52,72,50,'brick')
 end)
 layer(s,'03 Tiled gateway',function()
  poly({{52,39},{61,34},{61,72},{52,80}},'ochreDark','ink');box(30,40,25,40,'cream');rect(33,51,19,9,'ochre');label('CHO',37,53,'brick');arch(35,64,15,16,'glass');arch(39,66,7,14,'ink');rect(29,79,27,3,'ochreDark');rect(28,82,29,2,'sand')
  poly({{22,42},{28,34},{34,35},{42,24},{54,34},{62,31},{59,41},{53,44},{31,44}},'terra','ink');line(27,39,55,39,'tile');line(33,36,54,36,'tile');line(36,32,49,32,'tile');line(40,28,45,28,'tile');line(26,42,55,42,'brick');line(28,34,30,36,'cream');line(58,33,60,31,'cream')
  poly({{34,25},{38,20},{47,20},{53,25},{49,28},{37,28}},'jade','ink');line(37,24,49,24,'leaf');rect(41,17,4,4,'terra');dot(42,16,'cream');rect(28,44,30,3,'ochreDark');line(30,44,55,44,'cream');rect(31,47,3,32,'ochre');rect(51,47,3,32,'ochre')
 end)
 layer(s,'04 Lanterns and wholesale goods',function()
  for _,x in ipairs({25,60}) do line(x,49,x,56,'ink');box(x-3,56,7,8,'red');rect(x-1,56,2,7,'tile');rect(x-2,55,5,1,'ochre');rect(x-2,64,5,1,'ochre');line(x,65,x,68,'ochreDark') end
  box(16,73,8,8,'ochre');line(17,75,22,79,'ochreDark');box(22,76,9,7,'ochreDark');line(23,77,29,77,'sand');box(66,74,9,6,'cream');rect(67,75,7,2,'brick');box(73,77,8,5,'ochre');rect(74,78,6,1,'cream')
 end)
end)

make('binh-thanh',function(s)
 layer(s,'01 Public market apron',function() ground();line(12,80,25,83,'cream');line(64,79,81,75,'cream') end)
 layer(s,'02 Ba Chieu inspired market hall',function()
  house(11,50,67,29,'ochre');roof(8,50,70,15);line(15,38,78,38,'tile');line(13,42,77,42,'tile');line(10,46,76,46,'tile')
  for x=15,70,11 do box(x,61,8,18,'glass');rect(x-1,58,10,2,'cream');rect(x+1,64,6,1,'aqua');rect(x+3,62,1,15,'ink') end
  rect(12,52,65,3,'cream');rect(12,56,65,2,'ochreDark');line(79,51,84,46,'cream')
 end)
 layer(s,'03 Stepped market pediment',function()
  poly({{24,53},{24,43},{30,43},{30,38},{35,38},{35,34},{51,34},{51,38},{58,38},{58,43},{64,43},{64,53}},'cream','ink')
  rect(26,49,36,4,'ochre');rect(28,44,32,2,'sand');rect(36,36,14,2,'light');label('BA CHIEU',27,46,'brick');rect(38,39,10,3,'terra');rect(40,39,6,1,'tile')
  rect(32,57,24,3,'cream');arch(36,61,16,18,'ink');rect(37,67,14,12,'glass');rect(41,66,5,13,'ink');rect(31,79,27,3,'cream');rect(30,82,28,2,'ochreDark')
 end)
 layer(s,'04 Produce awnings and scooter',function()
  stall(10,72,20,'jade');stall(62,72,22,'red');scooter(45,86);disk(14,74,2,2,'leafHi');disk(18,74,2,2,'ochre')
 end)
end)

make('phu-nhuan',function(s)
 layer(s,'01 Narrow neighborhood alley',function()
  ground();poly({{39,53},{49,52},{66,77},{45,83},{27,78}},'stone','ink');line(46,61,52,69,'cream');line(54,72,58,78,'cream');line(40,71,46,75,'sand')
 end)
 layer(s,'02 Rear houses and canopy',function()
  tree(67,50,12);house(35,29,17,31,'aqua');roof(32,29,22,8);window(39,34,8,9);box(41,47,7,13,'glass');rect(34,44,19,2,'cream');house(60,41,19,28,'cream');roof(58,41,23,9);window(65,47,8,8);box(65,58,8,12,'brick');rect(64,60,9,1,'ochre')
 end)
 layer(s,'03 Close alley houses and balconies',function()
  house(14,45,23,31,'ochre');roof(11,45,29,10);window(18,51,7,10);window(29,51,5,10);rect(13,60,25,3,'brick');rect(16,62,19,2,'cream');line(17,64,17,68,'ink');line(24,64,24,68,'ink');line(33,64,33,68,'ink');line(17,67,33,67,'ink');box(22,68,9,10,'glass');rect(18,77,18,3,'sand')
  house(59,59,19,21,'pinkLite');roof(57,59,23,9);window(64,64,8,7);box(66,73,7,8,'pinkDark');rect(61,72,16,2,'cream');rect(80,61,4,9,'glass');line(79,72,84,68,'cream')
 end)
 layer(s,'04 Alley greenery and daily life',function()
  tree(12,73,9);shrub(79,79);box(35,77,5,5,'ochreDark');disk(37,75,4,4,'leaf');disk(36,73,2,3,'leafHi');scooter(46,82)
  line(36,43,63,48,'ink');poly({{42,44},{47,45},{47,50},{42,49}},'cream');poly({{52,46},{57,47},{57,51},{53,51}},'terra');dot(43,43,'ink');dot(53,45,'ink')
 end)
end)

-- Fully editable atlas: preserve every asset's four original painting layers.
local atlas=Sprite(288,192,ColorMode.RGB);atlas:deleteLayer(atlas.layers[1]);atlas.gridBounds=Rectangle(0,0,96,96)
for n,a in ipairs(art) do local x=((n-1)%3)*96;local y=math.floor((n-1)/3)*96;for _,src in ipairs(a.sprite.layers) do local l=atlas:newLayer();l.name=a.name..' / '..src.name;local cel=src:cel(1);atlas:newCel(l,1,cel.image,Point(x,y)) end end
atlas.data='Vietnamtown neighborhood landmarks. Each 96x96 cell is a fictionalized original design, four editable paint layers. Row-major: tan-dinh, ben-thanh, thao-dien, cho-lon, binh-thanh, phu-nhuan.'
atlas:saveAs(OUT..'neighborhood-landmarks.aseprite');atlas:saveCopyAs(OUT..'neighborhood-landmarks.png')

-- Contact sheet is also drawn and exported directly by Aseprite, then scaled nearest-neighbor.
local sheet=Sprite(336,252,ColorMode.RGB);sheet:deleteLayer(sheet.layers[1]);I=Image(336,252,ColorMode.RGB);I:clear();rect(0,0,336,252,'cream');rect(0,0,336,18,'ink');label('VIETNAMTOWN - NEIGHBORHOOD LANDMARKS',12,7,'cream')
local names={'TAN DINH','BEN THANH','THAO DIEN','CHO LON','BINH THANH','PHU NHUAN'}
for n,a in ipairs(art) do local x=8+((n-1)%3)*110;local y=22+math.floor((n-1)/3)*113;box(x,y,100,109,'sand','ochre');rect(x+1,y+1,98,96,'cream');I:drawImage(a.image,Point(x+2,y+1));label(names[n],x+math.floor((100-textWidth(names[n]))/2),y+100,'ink') end
label('ORIGINAL PIXEL ART - ASEPRITE - NATIVE 96 X 96',18,245,'ochreDark');local sl=sheet:newLayer();sl.name='Presentation';sheet:newCel(sl,1,I,Point(0,0));sheet:saveAs(OUT..'contact-sheet.aseprite');sheet:resize(1008,756);sheet:saveCopyAs(OUT..'contact-sheet.png')

-- Small environment props, each transparent 48x48 with an editable source.
local props={['palm']=function() palm(25,39,24) end,['tree']=function() tree(24,35,12) end,['scooter']=function() scooter(17,37) end,['street-stall']=function() stall(10,26,27,'red') end}
for name,fn in pairs(props) do local s=Sprite(48,48,ColorMode.RGB);s:deleteLayer(s.layers[1]);I=Image(48,48,ColorMode.RGB);I:clear();fn();local l=s:newLayer();l.name='Original pixel artwork';s:newCel(l,1,I,Point(0,0));s:saveAs(OUT..name..'.aseprite');s:saveCopyAs(OUT..name..'.png') end
print('Created six layered landmarks, atlas, contact sheet and four props in '..OUT)
