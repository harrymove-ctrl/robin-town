-- Vietnam Town: original pixel drawings, authored and rendered in Aseprite.
-- All marks are integer-coordinate pixels; no imported/generated raster artwork.
local out = '/private/tmp/vietnamtown-shops/'
local P = {
 ink='343d39', edge='4b5143', dark='254e4d', teal='367b78', aqua='62a89a', mint='a3c7ae',
 cream='fff0cf', wall='ebcd91', shade='c4a36c', ochre='dba65e', gold='efbf69', straw='f7d990',
 roof='cb7054', roofhi='ec976a', roofdark='995341', red='bb5149', pink='e38e89', rose='f2b6ad',
 brown='815a43', wood='a8774f', lightwood='d2a571', deep='5b4a3c', white='fff9e8',
 steel='92aba4', steeldark='62817e', blue='518db1', bluehi='8cbac3',
 green='5e8b57', leaf='8aae64', leafhi='bbca78', soil='7c6748', amber='eba450',
 yellow='f4d06e', lavender='a99bc6', shadow='5d62504b',
}
for k,h in pairs(P) do
 local r,g,b=tonumber(h:sub(1,2),16),tonumber(h:sub(3,4),16),tonumber(h:sub(5,6),16)
 P[k]=app.pixelColor.rgba(r,g,b,#h==8 and tonumber(h:sub(7,8),16) or 255)
end
local S, I
local function px(x,y,c) if x>=0 and x<I.width and y>=0 and y<I.height then I:drawPixel(math.floor(x),math.floor(y),P[c] or c) end end
local function rect(x,y,w,h,c) for j=y,y+h-1 do for i=x,x+w-1 do px(i,j,c) end end end
local function line(x0,y0,x1,y1,c)
 local dx=math.abs(x1-x0);local sx=x0<x1 and 1 or -1;local dy=-math.abs(y1-y0);local sy=y0<y1 and 1 or -1;local err=dx+dy
 while true do px(x0,y0,c);if x0==x1 and y0==y1 then break end;local e=2*err;if e>=dy then err=err+dy;x0=x0+sx end;if e<=dx then err=err+dx;y0=y0+sy end end
end
local function poly(pts,c,edge)
 local miny,maxy=10000,-1;for _,p in ipairs(pts) do miny=math.min(miny,p[2]);maxy=math.max(maxy,p[2]) end
 for y=miny,maxy do
  local xs={};for n,p in ipairs(pts) do local q=pts[n%#pts+1];if (p[2]<=y and q[2]>y) or (q[2]<=y and p[2]>y) then xs[#xs+1]=p[1]+(y-p[2])/(q[2]-p[2])*(q[1]-p[1]) end end
  table.sort(xs);for n=1,#xs-1,2 do line(math.ceil(xs[n]),y,math.floor(xs[n+1]),y,c) end
 end
 if edge then for n,p in ipairs(pts) do local q=pts[n%#pts+1];line(p[1],p[2],q[1],q[2],edge) end end
end
local function box(x,y,w,h,c,e) rect(x,y,w,h,e or 'ink');rect(x+1,y+1,w-2,h-2,c) end
local function ellipse(cx,cy,rx,ry,c)
 for y=-ry,ry do for x=-rx,rx do if x*x/(rx*rx)+y*y/(ry*ry)<=1 then px(cx+x,cy+y,c) end end end
end
local function layer(name)
 local L=S:newLayer();L.name=name;I=Image(S.width,S.height,ColorMode.RGB);I:clear();S:newCel(L,1,I,Point(0,0));I=L:cel(1).image
end
local function start(name)
 S=Sprite(96,96,ColorMode.RGB);S:deleteLayer(S.layers[1]);S.data='Original Vietnam Town shop sprite. Drawn in Aseprite with draw-shops.lua. '..name
end
local function ground()
 layer('01 • Ground and cast shadow')
 poly({{17,74},{73,72},{91,81},{82,88},{17,89},{7,83}},'shadow')
 poly({{17,72},{72,71},{86,77},{78,84},{15,84},{9,80}},'shade')
 poly({{17,72},{72,71},{85,76},{77,81},{14,81},{9,79}},'wall')
 line(14,82,76,82,'ochre');line(19,75,72,74,'cream')
 line(30,76,27,80,'shade');line(57,75,57,80,'shade')
 px(15,79,'cream');rect(73,79,5,1,'cream')
end
local function walls(x,y,w,h,wall)
 layer('02 • Plaster and timber')
 poly({{x+w-1,y},{x+w+8,y-5},{x+w+8,y+h-7},{x+w-1,y+h}},'shade','ink')
 line(x+w+1,y+2,x+w+1,y+h-4,'ochre')
 box(x,y,w,h,wall or 'wall');rect(x+2,y+2,w-4,2,'cream')
 rect(x+1,y+h-6,w-2,5,'ochre');rect(x+3,y+h-3,w-6,1,'shade')
 rect(x+2,y+5,2,h-12,'gold');rect(x+w-4,y+6,2,h-13,'shade')
end
local function roof(y,col)
 layer('03 • Tiled roof')
 local rc=col or 'roof';local hi=rc=='gold' and 'straw' or 'roofhi';local dk=rc=='gold' and 'ochre' or 'roofdark'
 poly({{29,y},{70,y},{85,y+13},{87,y+19},{79,y+21},{17,y+21},{15,y+18}},dk,'ink')
 poly({{29,y},{69,y},{79,y+17},{17,y+17}},rc,'ink')
 line(29,y+1,68,y+1,hi);line(18,y+16,78,y+16,hi)
 for row=1,3 do
  local yy=y+row*4;local l=29-math.floor(row*2.8);local r=69+row*2
  line(l,yy,r,yy,dk);line(l+1,yy+1,r,yy+1,hi)
  for xx=l+3,r-2,8 do line(xx,yy-2,xx-1,yy,dk) end
 end
 for xx=19,77,6 do line(xx,y+17,xx,y+19,dk);px(xx+1,y+18,hi) end
 rect(17,y+20,62,2,'deep');rect(20,y+22,56,2,'brown')
 line(70,y+2,82,y+13,hi);line(80,y+15,84,y+16,dk)
end
local F={
 A={'010','101','111','101','101'},B={'110','101','110','101','110'},C={'011','100','100','100','011'},D={'110','101','101','101','110'},E={'111','100','110','100','111'},F={'111','100','110','100','100'},G={'011','100','101','101','011'},H={'101','101','111','101','101'},I={'111','010','010','010','111'},J={'001','001','001','101','010'},K={'101','101','110','101','101'},L={'100','100','100','100','111'},M={'101','111','111','101','101'},N={'101','111','111','111','101'},O={'010','101','101','101','010'},P={'110','101','110','100','100'},Q={'010','101','101','111','011'},R={'110','101','110','101','101'},S={'011','100','010','001','110'},T={'111','010','010','010','010'},U={'101','101','101','101','111'},V={'101','101','101','101','010'},W={'101','101','111','111','101'},X={'101','101','010','101','101'},Y={'101','101','010','010','010'},Z={'111','001','010','100','111'},[' ']={'000','000','000','000','000'},['-']={'000','000','111','000','000'}
}
local function txt(str,x,y,c)
 for ch in str:gmatch('.') do local g=F[ch] or F[' '];for j,row in ipairs(g) do for k=1,3 do if row:sub(k,k)=='1' then px(x+k-1,y+j-1,c) end end end;x=x+4 end
end
local function sign(str,x,y,w,c)
 box(x,y,w,12,c or 'teal');line(x+1,y+1,x+w-2,y+1,'aqua');txt(str,x+math.floor((w-(#str*4-1))/2),y+4,'cream')
end
local function door(x,y,w,h)
 box(x,y,w,h,'dark');rect(x+2,y+2,w-4,h-3,'teal');rect(x+3,y+3,w-6,h-6,'dark');rect(x+w-4,y+h-9,1,2,'gold');line(x+2,y+h-2,x+w-2,y+h-2,'mint')
end
local function window(x,y,w,h)
 box(x,y,w,h,'teal');rect(x+2,y+2,w-4,h-4,'dark');line(x+3,y+2,x+3,y+h-4,'aqua');rect(x+4,y+3,w-7,2,'steeldark');rect(x+2,y+h-3,w-4,1,'gold')
end
local function stool(x,y,c)
 rect(x-4,y+2,2,5,'ink');rect(x+3,y+2,2,5,'ink');rect(x-3,y+2,1,4,c);rect(x+3,y+2,1,4,c)
 box(x-5,y-2,11,5,c);line(x-3,y-1,x+3,y-1,c=='blue' and 'bluehi' or 'roofhi');px(x-4,y+1,c)
end
local function tableTop(x,y)
 rect(x-1,y+2,2,8,'deep');line(x-4,y+9,x+4,y+9,'brown');ellipse(x,y,9,3,'ink');ellipse(x,y-1,8,2,'lightwood');line(x-5,y-2,x+5,y-2,'straw')
end
local function cup(x,y,phin)
 rect(x-3,y,6,5,'dark');rect(x-2,y+1,4,3,'cream');rect(x+3,y+1,2,2,'cream');rect(x-3,y+5,7,1,'steel')
 if phin then box(x-3,y-5,6,5,'steel');rect(x-4,y-2,8,1,'white');rect(x-4,y-6,8,2,'steeldark');rect(x-3,y-6,6,1,'white');px(x,y-7,'steel') else rect(x-2,y,4,1,'brown') end
end
local function steam(x,y)
 line(x,y,x-1,y-2,'cream');line(x-1,y-3,x+1,y-5,'cream');px(x+1,y-6,'cream')
end
local function pot(x,y,sz)
 sz=sz or 1;box(x-3,y,7,7,'roof');line(x-4,y,x+4,y,'ink');line(x-3,y+1,x+3,y+1,'roofhi');line(x-2,y+5,x+2,y+5,'roofdark')
end
local function plant(x,y)
 pot(x,y);line(x,y-1,x,y-10,'green');line(x,y-5,x-4,y-8,'green');line(x,y-3,x+4,y-6,'green');rect(x-6,y-9,4,3,'leaf');rect(x+2,y-7,4,3,'green');rect(x-1,y-12,3,4,'leaf');px(x-5,y-9,'leafhi')
end
local function lamp(x,y,c)
 line(x,y-4,x,y-1,'deep');rect(x-2,y-1,5,1,'ink');ellipse(x,y+3,4,4,c or 'red');line(x-1,y,x-1,y+6,'roofhi');rect(x-2,y+7,5,1,'deep');line(x,y+8,x,y+10,'gold')
end
local function finish(name)
 S:saveAs(out..name..'.aseprite');S:saveCopyAs(out..name..'.png');print(name..': '..#S.layers..' layers, '..S.width..' x '..S.height)
end

-- CÀ PHÊ — open serving window, phin filter, tiny blue pavement stools.
start('Cà phê');ground();walls(22,34,53,43);roof(14)
layer('04 • Cafe shutters and signs');sign('CA PHE',30,39,37,'teal');px(41,40,'cream');px(42,41,'cream');px(58,40,'cream');px(57,41,'cream');px(59,41,'cream')
window(26,53,27,17);door(57,52,14,24)
rect(25,68,30,3,'brown');rect(25,68,30,1,'straw');rect(25,54,3,13,'teal');rect(51,54,3,13,'aqua')
for yy=55,64,3 do line(25,yy,28,yy,'dark');line(51,yy,53,yy,'teal') end
lamp(21,42,'red');lamp(77,41,'red')
layer('05 • Coffee service and street furniture');tableTop(50,76);cup(49,70,true);stool(35,78,'blue');stool(65,81,'blue');plant(18,72)
cup(35,62,true);cup(46,64,false);rect(31,57,3,3,'gold');rect(44,57,3,3,'cream');line(29,62,48,62,'wood')
layer('06 • Light, steam and little details');steam(36,49);px(61,57,'aqua');rect(27,74,8,1,'cream');rect(80,49,1,8,'ochre')
finish('coffee')

-- BÁNH MÌ — striped canopy, glass bakery cart, baguettes and herb jars.
start('Bánh mì');ground();walls(26,33,44,42);roof(15,'gold')
layer('04 • Bakery and folding canopy');window(30,43,16,20);door(51,42,15,32)
poly({{18,39},{66,39},{74,51},{13,51}},'cream','ink')
for x=20,64,12 do poly({{x,40},{x+5,40},{x+7,50},{x-2,50}},'roof') end
rect(13,51,61,4,'roof');for x=15,68,12 do rect(x,52,6,2,'cream') end
line(15,52,15,74,'deep');line(72,52,72,74,'deep');line(16,53,16,73,'gold')
layer('05 • Baguette glass cart');box(19,56,45,22,'teal');rect(21,58,41,9,'bluehi');rect(22,58,16,8,'mint');rect(41,58,20,8,'aqua');line(40,57,40,68,'steel')
line(23,58,27,58,'white');line(22,59,22,62,'white');line(46,58,50,58,'white')
-- Individually cut crusts, each bread angled one pixel.
for n=0,3 do local x=23+n*9;poly({{x,64},{x+2,59},{x+4,58},{x+6,59},{x+4,65},{x+2,66}},'amber','brown');line(x+2,61,x+4,62,'straw');px(x+2,64,'straw') end
rect(19,68,45,2,'cream');rect(20,70,43,7,'gold');txt('BANH MI',27,71,'deep');rect(24,78,2,3,'deep');rect(58,78,2,3,'deep');ellipse(25,81,3,3,'ink');ellipse(25,81,1,1,'steel');ellipse(59,81,3,3,'ink');ellipse(59,81,1,1,'steel')
rect(63,70,6,2,'deep');rect(69,69,2,4,'steel')
layer('06 • Fresh ingredients');box(70,66,10,13,'wood');rect(71,65,8,3,'leaf');rect(72,63,3,4,'green');rect(76,62,2,5,'leafhi');line(72,72,77,72,'straw');line(72,75,77,75,'deep');box(10,68,7,10,'steel');rect(11,67,5,2,'red');rect(12,72,3,3,'cream')
finish('banhmi')

-- PHỞ — simmering stockpot, bowls and chopsticks at the open kitchen.
start('Phở');ground();walls(22,34,53,43)
layer('03a • Chimney');box(67,11,8,16,'steel');rect(66,9,10,3,'steeldark');rect(68,10,6,1,'white');line(70,8,69,5,'cream');line(69,4,71,2,'cream')
roof(15)
layer('04 • Noodle kitchen joinery');sign('PHO',34,40,26,'red');px(50,41,'cream');px(51,42,'cream');px(50,43,'cream');px(52,43,'cream');px(53,42,'cream')
window(26,54,45,20);rect(28,56,19,16,'deep');rect(50,56,19,16,'dark');rect(47,54,3,19,'wood');rect(25,72,47,3,'wood');line(25,72,71,72,'straw')
rect(26,76,47,2,'shade');lamp(77,42,'red')
layer('05 • Stockpot and serving counter');rect(28,68,17,5,'ink');rect(31,71,4,2,'roofhi');rect(37,71,4,2,'red');box(28,59,18,11,'steel');rect(30,61,3,7,'mint');rect(32,60,9,1,'white');rect(44,61,2,7,'steeldark');ellipse(37,59,9,3,'steeldark');ellipse(37,58,8,2,'steel');line(33,57,41,57,'white');rect(34,55,6,2,'dark');line(25,61,27,61,'steel');line(46,61,48,61,'steel')
local function bowl(x,y)
 ellipse(x,y,7,2,'ink');ellipse(x,y,6,1,'gold');poly({{x-7,y+1},{x+7,y+1},{x+4,y+6},{x-4,y+6}},'cream','ink');line(x-4,y+3,x+4,y+3,'blue');rect(x-2,y+6,5,1,'steel');px(x-2,y,'green');px(x+2,y-1,'green');line(x+1,y-2,x+6,y-7,'brown');line(x+3,y-2,x+8,y-7,'brown')
end
bowl(59,65);tableTop(37,78);bowl(37,73);stool(20,79,'red');stool(58,82,'red');plant(79,71)
layer('06 • Broth steam and garnish');steam(34,53);steam(42,51);box(65,69,4,5,'red');rect(66,67,2,2,'cream');rect(49,71,5,1,'green')
finish('pho')

-- TIỆM HOA — flowers grouped into buckets beneath a sunny roof.
start('Tiệm hoa');ground();walls(22,34,53,43);roof(14,'gold')
layer('04 • Flower shop front');sign('TIEM HOA',27,40,44,'teal');door(44,54,15,23);window(26,54,14,18);window(62,54,10,17)
rect(24,70,18,3,'brown');rect(63,68,8,2,'wood');line(30,55,37,55,'aqua')
layer('05 • Vine and flower buckets')
line(77,33,77,66,'green');for y=36,61,5 do rect(74,y,4,3,'green');rect(78,y+2,4,3,'leaf');px(74,y,'leafhi') end
local function blossom(x,y,c)
 rect(x-2,y-3,4,7,c);rect(x-3,y-2,7,4,c);px(x,y,'yellow');px(x-2,y-2,c=='pink' and 'rose' or 'cream');px(x+1,y+2,c=='rose' and 'pink' or 'gold')
end
local function bouquet(x,y,c)
 poly({{x-5,y},{x+5,y},{x+3,y+10},{x-3,y+10}},'steeldark','ink');line(x-3,y+2,x-2,y+8,'mint');rect(x-4,y,9,2,'steel')
 line(x,y,x-3,y-9,'green');line(x,y,x+4,y-10,'green');line(x,y,x,y-13,'green');rect(x-5,y-4,4,2,'leaf');rect(x+1,y-6,4,2,'leafhi')
 blossom(x-4,y-9,c);blossom(x+4,y-10,c);blossom(x,y-15,c)
end
bouquet(18,69,'pink');bouquet(31,73,'yellow');bouquet(65,73,'rose');bouquet(78,68,'lavender');pot(47,75);rect(44,73,7,4,'green');blossom(47,70,'pink');blossom(43,72,'cream');blossom(51,72,'yellow')
layer('06 • Hanging posy');line(22,40,22,51,'deep');pot(22,50);rect(18,46,8,6,'green');blossom(22,45,'rose');rect(64,35,8,2,'green');rect(68,37,7,2,'leaf')
finish('flowers')

-- TIỆM MAY — narrow old-town tailor, silk áo dài, machine and dress form.
start('Tiệm may');ground();walls(26,28,44,48);roof(8,'gold')
layer('04 • Tailor sign and balcony');window(31,33,14,12);window(50,33,14,12);line(37,34,37,43,'gold');line(56,34,56,43,'gold');rect(29,43,38,2,'teal');for x=30,65,5 do rect(x,44,1,4,'dark') end;line(28,47,67,47,'aqua')
sign('TIEM MAY',26,49,44,'teal');door(47,62,19,14);window(29,63,15,12)
layer('05 • Silk and sewing tools')
-- Hung áo dài, closed collar and slit tunic panels, pale trousers beneath.
line(69,48,82,48,'deep');line(76,48,76,53,'deep');poly({{76,51},{71,54},{81,54}},'cream','deep')
poly({{74,53},{78,53},{80,56},{83,64},{80,65},{78,59},{79,68},{81,76},{76,75},{74,68},{73,76},{69,76},{72,62},{69,66},{67,64},{71,55}},'pink','ink');line(75,54,75,67,'rose');rect(72,77,3,3,'cream');rect(77,77,3,3,'cream');px(77,58,'gold');px(78,61,'gold');px(76,65,'gold')
-- Window sewing machine: flywheel, arm, needle and wooden workbench.
rect(30,72,14,2,'lightwood');rect(32,65,9,3,'ink');rect(32,67,3,4,'ink');rect(40,65,3,7,'ink');ellipse(42,66,2,2,'steel');ellipse(42,66,1,1,'ink');rect(35,68,5,3,'cream');line(36,68,36,71,'steel');rect(36,64,1,1,'red')
-- Dress form outside, feet at shared pavement baseline.
line(21,71,21,81,'deep');line(17,82,25,82,'deep');rect(20,57,3,4,'wood');poly({{18,61},{24,61},{26,65},{24,70},{25,73},{17,73},{18,70},{16,65}},'cream','ink');line(21,62,21,72,'lightwood');line(18,68,24,68,'roof')
-- Rolls of fabric stand next to the door.
box(50,68,4,13,'blue');rect(51,69,1,10,'bluehi');ellipse(52,68,2,1,'cream');box(55,71,5,10,'red');rect(56,72,1,7,'pink');ellipse(57,71,2,1,'cream')
layer('06 • Tailor finishing details');lamp(25,42,'red');line(57,53,60,56,'cream');line(57,56,60,53,'cream');px(57,56,'gold');rect(30,77,9,1,'cream')
finish('tailor')

-- TẠP HÓA — a densely stocked neighborhood grocer with sacks and crates.
start('Tạp hóa');ground();walls(21,35,55,41);roof(15)
layer('04 • Grocer awning and shelves');sign('TAP HOA',28,40,42,'cream');rect(29,41,40,10,'gold');txt('TAP HOA',35,44,'deep')
poly({{22,51},{73,51},{79,59},{17,59}},'teal','ink');for x=25,70,10 do poly({{x,52},{x+4,52},{x+3,58},{x-2,58}},'mint') end
rect(17,59,63,3,'dark');for x=19,75,10 do rect(x,60,4,2,'aqua') end
window(25,63,25,13);door(55,63,15,14);line(27,69,48,69,'lightwood');rect(24,75,49,2,'wood');line(24,75,72,75,'straw')
layer('05 • Bottles tins and hanging packets')
for n=0,4 do local x=28+n*4;local c=({'red','gold','blue','cream','green'})[n+1];rect(x,64,3,4,c);px(x+1,63,'straw');rect(x,66,2,1,'cream') end
for n=0,3 do box(28+n*5,71,4,4,({'gold','pink','mint','blue'})[n+1]) end
for n=0,2 do local y=63+n*4;box(72,y,5,4,({'red','gold','mint'})[n+1]);px(74,y+1,'cream') end
local function crate(x,y)
 box(x,y,15,10,'wood');line(x+2,y+3,x+12,y+3,'straw');line(x+2,y+6,x+12,y+6,'deep');rect(x+1,y+1,2,8,'lightwood');rect(x+12,y+1,2,8,'lightwood')
end
crate(58,77);for n=0,3 do ellipse(61+n*3,76,2,2,n%2==0 and 'amber' or 'yellow');px(61+n*3,74,'green') end
crate(74,72);for n=0,2 do ellipse(77+n*3,71,2,3,'green');px(77+n*3,69,'leaf') end
-- Two rice sacks, one open with visible grain pixels.
poly({{13,68},{21,68},{24,76},{23,82},{11,82},{10,76}},'wall','ink');ellipse(17,68,5,2,'brown');ellipse(17,67,4,1,'cream');rect(13,73,7,4,'gold');px(15,68,'straw');px(18,67,'shade');line(14,75,19,75,'brown')
poly({{30,74},{37,73},{40,78},{39,84},{27,84},{26,80}},'straw','ink');ellipse(33,74,4,1,'cream');line(30,79,36,79,'wood');px(30,75,'shade');px(34,74,'shade')
layer('06 • Corner grocer details');box(46,73,8,10,'red');rect(48,74,4,2,'cream');rect(48,78,4,3,'gold');rect(47,72,6,2,'steel');line(80,47,80,64,'brown');rect(79,45,3,3,'roofhi')
finish('grocery')

-- Aseprite-made proof sheet, enlarged with exact nearest-neighbor pixels.
local names={'coffee','banhmi','pho','flowers','tailor','grocery'}
local sheet=Sprite(312,224,ColorMode.RGB);sheet:deleteLayer(sheet.layers[1]);S=sheet
layer('Paper');rect(0,0,312,224,'cream')
layer('Original sprites and pixel labels')
for n,name in ipairs(names) do
 local sx=((n-1)%3)*104+4;local sy=math.floor((n-1)/3)*110+1
 local img=Image{fromFile=out..name..'.png'};I:drawImage(img,Point(sx,sy));txt(({'CA PHE','BANH MI','PHO','TIEM HOA','TIEM MAY','TAP HOA'})[n],sx+29,sy+98,'dark')
end
sheet:saveAs(out..'contact-sheet.aseprite');sheet:resize(1248,896);sheet:saveCopyAs(out..'contact-sheet.png')
print('Created 6 transparent sprites and native layered sources; proof sheet ready.')
