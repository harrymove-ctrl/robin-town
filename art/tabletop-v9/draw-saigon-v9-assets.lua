-- Original chiếu mat, miniature plot and Vietnamese tear-off calendar.
-- Native Aseprite pixel painting; no generated bitmap or third-party art.
local OUT='/private/tmp/saigon-v9-assets/'
local function col(h,a)return app.pixelColor.rgba(tonumber(h:sub(1,2),16),tonumber(h:sub(3,4),16),tonumber(h:sub(5,6),16),a or 255)end
local C={
 ink=col('254039'),jade=col('315847'),cream=col('f1e3b7'),light=col('faf0cf'),
 straw=col('c8ae77'),strawLight=col('d4bb86'),strawShine=col('dbc490'),strawShade=col('b59b68'),strawDeep=col('aa905f'),
 thread=col('bba572'),threadLight=col('d6c18d'),redWeave=col('b48263'),redHi=col('c79879'),redShade=col('9e765d'),greenWeave=col('929b6d'),greenHi=col('acb285'),greenShade=col('7e8963'),
 stone=col('c5bda0'),stoneHi=col('e3d7b5'),stoneShade=col('9d9c84'),stoneDeep=col('6c7869'),earth=col('d4c9a7'),earthHi=col('e3d7b5'),earthShade=col('bfb493'),road=col('405951'),roadDark=col('304b44'),lane=col('c6bd8e'),
 red=col('b94735'),redHi=col('d46947'),redDeep=col('833a2e'),redEdge=col('633a2e'),paper=col('f3e6be'),paperHi=col('fcf1ce'),paperShade=col('ded0a7'),paperEdge=col('ad9970'),brass=col('b8964e'),brassHi=col('efcf78'),brassDeep=col('79603a'),
 shadow=col('193b30',58),clear=col('000000',0)
}
local I
local function p(x,y,c)x=math.floor(x);y=math.floor(y);if x>=0 and y>=0 and x<I.width and y<I.height then I:drawPixel(x,y,C[c]or c)end end
local function rect(x,y,w,h,c)for yy=math.floor(y),math.floor(y+h-1)do for xx=math.floor(x),math.floor(x+w-1)do p(xx,yy,c)end end end
local function line(x0,y0,x1,y1,c,w)
 w=w or 1;local n=math.max(math.abs(x1-x0),math.abs(y1-y0));for k=0,n do rect(math.floor(x0+(x1-x0)*k/math.max(n,1)+.5),math.floor(y0+(y1-y0)*k/math.max(n,1)+.5),w,w,c)end
end
local function poly(a,c,edge)
 local miny,maxy=10000,-1;for _,v in ipairs(a)do miny=math.min(miny,v[2]);maxy=math.max(maxy,v[2])end
 for y=math.floor(miny),math.floor(maxy)do local nodes={};for i,u in ipairs(a)do local v=a[i%#a+1];if(u[2]<=y and v[2]>y)or(v[2]<=y and u[2]>y)then nodes[#nodes+1]=u[1]+(y-u[2])/(v[2]-u[2])*(v[1]-u[1])end end;table.sort(nodes);for k=1,#nodes-1,2 do for x=math.ceil(nodes[k]),math.floor(nodes[k+1])do p(x,y,c)end end end
 if edge then for k,u in ipairs(a)do local v=a[k%#a+1];line(u[1],u[2],v[1],v[2],edge)end end
end
local function ellipse(cx,cy,rx,ry,c)for yy=math.floor(cy-ry),math.ceil(cy+ry)do for xx=math.floor(cx-rx),math.ceil(cx+rx)do if(xx-cx)^2/(rx*rx)+(yy-cy)^2/(ry*ry)<=1 then p(xx,yy,c)end end end end
local function start(w,h,desc)local s=Sprite(w,h,ColorMode.RGB);s:deleteLayer(s.layers[1]);s.data=desc;s.gridBounds=Rectangle(0,0,1,1);return s end
local function layer(s,name,fn)local l=s:newLayer();l.name=name;I=Image(s.width,s.height,ColorMode.RGB);I:clear();fn();s:newCel(l,1,I,Point(0,0));return l end
local function save(s,name)s:saveAs(OUT..name..'.aseprite');s:saveCopyAs(OUT..name..'.png')end
local function resized(path,w,h)local s=app.open(path);s:resize(w,h);local im=Image(s);s:close();return im end

local mat=start(96,96,'Original seamless Vietnamese chiếu-inspired woven reed mat, 96x96. Small horizontal reeds, alternating cotton warp, restrained red and green dyed bands. Native Aseprite Lua.')
layer(mat,'01 Warm split-reed weft',function()
 for y=0,95 do
  local tone=({'strawLight','straw','straw','strawShade'})[(y%4)+1]
  rect(0,y,96,1,tone)
  -- Sparse broad highlights vary on a 24px repeat, preserving a quiet straw field.
  for x=0,95 do if(y%4==0 and (math.floor(x/12)+math.floor(y/4))%2==0)then p(x,y,'strawShine')end end
 end
end)
layer(mat,'02 Alternating warp threads',function()
 for x=5,95,12 do for y=0,95 do
  local cycle=math.floor(y/4)%2
  if cycle==0 then p(x,y,'thread');p(x+1,y,'threadLight')
  elseif y%4==3 then p(x,y,'strawDeep');p(x+1,y,'strawShade')end
 end end
end)
layer(mat,'03 Restrained dyed red and green longitudinal bands',function()
 for _,band in ipairs({{12,5,'redWeave','redHi','redShade'},{72,5,'greenWeave','greenHi','greenShade'}})do
  local x,w=band[1],band[2]
  for y=0,95 do
   local tone=y%4==0 and band[4]or(y%4==3 and band[5]or band[3])
   rect(x,y,w,1,tone)
   if math.floor(y/4)%2==0 then p(x+1,y,'threadLight')end
  end
 end
 -- One faint partner strand makes each dyed stripe read as a woven band, not a rule.
 for y=0,95 do if y%4~=3 then p(20,y,y%4==0 and 'redHi' or 'redWeave');p(80,y,y%4==0 and 'greenHi' or 'greenWeave')end end
end)
save(mat,'chieu-mat-tile')

local plot=start(64,64,'Original miniature address plot, 64x64 RGBA. Raised stone curb and small asphalt street edge. Number area x20,y16,width27,height20 intentionally blank. Native Aseprite Lua.')
layer(plot,'01 Small street edge and ground shadow',function()
 poly({{0,50},{62,39},{64,44},{64,64},{0,64}},'roadDark')
 poly({{0,53},{64,43},{64,64},{0,64}},'road')
 line(3,61,15,59,'lane',2);line(38,56,51,54,'lane',2)
 ellipse(33,53,27,6,'shadow')
end)
layer(plot,'02 Raised plot foundation and curb walls',function()
 poly({{7,7},{54,7},{61,44},{60,51},{13,58},{7,47},{3,14}},'stoneDeep')
 poly({{7,10},{12,47},{14,55},{8,47},{5,16}},'stoneShade')
 poly({{12,47},{59,41},{59,49},{14,56}},'stoneShade')
 line(15,51,57,45,'stoneHi');line(15,54,57,48,'stoneDeep')
 for x=23,52,10 do line(x,50-math.floor((x-13)/7),x,53-math.floor((x-13)/7),'stoneDeep')end
end)
layer(plot,'03 Paving top and quiet vacant earth',function()
 poly({{7,7},{53,7},{59,42},{13,49}},'stoneHi','stoneDeep')
 poly({{10,10},{50,10},{55,39},{16,45}},'stone')
 poly({{13,13},{48,13},{52,37},{18,41}},'earthShade')
 poly({{14,14},{47,14},{51,36},{18,40}},'earth')
 line(10,10,50,10,'light');line(10,12,15,43,'stoneHi')
 line(18,42,52,38,'stoneShade')
 -- Corner joints and weathering stay outside the number rectangle.
 line(12,8,12,11,'stoneShade');line(44,8,44,10,'stoneShade');line(55,25,57,25,'stoneShade')
 p(19,39,'earthHi');p(24,38,'earthHi');p(44,38,'earthShade');p(48,34,'earthHi')
end)
save(plot,'mini-vacant-plot')

local calendar=start(96,128,'Original Vietnamese tear-off wall calendar backing, 96x128 transparent RGBA. Brass hooks, vermilion binding and layered cream pages. Body x20,y43,w58,h61 intentionally blank for HTML year/zodiac. No baked text.')
layer(calendar,'01 Backboard and page-stack shadow',function()
 rect(14,15,73,108,'shadow');rect(9,14,77,107,'redEdge')
 rect(10,14,75,103,'redDeep');rect(12,14,71,101,'red')
 rect(11,18,2,95,'redHi');rect(12,115,71,3,'redDeep')
 -- Trim gives the backing the familiar red block-calendar silhouette.
 line(14,17,81,17,'brass');line(14,17,14,111,'redHi');line(81,17,81,111,'redDeep')
end)
layer(calendar,'02 Layered paper block and turned bottom corner',function()
 rect(14,34,69,83,'paperEdge');rect(15,34,67,82,'paperShade')
 line(16,110,81,110,'paperEdge');line(16,113,80,113,'paperHi');line(16,115,80,115,'paperEdge')
 poly({{14,33},{82,33},{82,103},{75,111},{14,111}},'paper')
 rect(16,37,64,71,'paperHi');rect(17,40,62,65,'paper')
 poly({{74,104},{81,102},{75,110}},'paperShade');line(74,104,75,110,'paperEdge');line(75,104,80,103,'paperHi')
 -- Subtle age marks appear only along the outer paper edges.
 rect(15,47,1,13,'paperShade');rect(16,89,1,12,'paperShade');rect(80,46,1,18,'paperShade')
 p(18,106,'paperEdge');p(20,108,'paperShade');p(77,40,'paperShade')
end)
layer(calendar,'03 Red tear-off binding and perforations',function()
 rect(12,20,72,18,'redDeep');rect(13,20,70,16,'red')
 rect(14,21,68,2,'redHi');line(15,35,81,35,'redEdge')
 -- Tiny uneven paper teeth, not text or UI decoration.
 for x=16,78,5 do rect(x,36,3,2,'paperHi');p(x+3,36,'paperShade')end
 line(17,32,79,32,'redDeep')
 for x=18,77,6 do rect(x,34,2,1,'paperShade')end
end)
layer(calendar,'04 Two brass hanging hooks',function()
 for _,x in ipairs({29,66})do
  ellipse(x+1,16,5,9,'shadow')
  ellipse(x,12,5,9,'brassDeep');ellipse(x,11,4,8,'brass');ellipse(x,11,2,5,'clear')
  line(x-2,5,x+1,4,'brassHi');line(x-4,7,x-4,12,'brassHi')
  rect(x-1,15,3,9,'brassDeep');rect(x-1,15,2,8,'brass');rect(x-1,16,1,5,'brassHi')
  rect(x-3,23,7,2,'redEdge');rect(x-2,23,4,1,'brass')
 end
end)
save(calendar,'tear-off-calendar')

-- Native Aseprite review contact sheet, including repeats and realistic small sizes.
local F={A={'010','101','111','101','101'},C={'011','100','100','100','011'},D={'110','101','101','101','110'},E={'111','100','110','100','111'},H={'101','101','111','101','101'},I={'111','010','010','010','111'},L={'100','100','100','100','111'},M={'101','111','111','101','101'},N={'101','111','111','111','101'},O={'010','101','101','101','010'},P={'110','101','110','100','100'},R={'110','101','110','101','101'},T={'111','010','010','010','010'},U={'101','101','101','101','111'},V={'101','101','101','101','010'},W={'101','101','111','111','101'},X={'101','101','010','101','101'},[' ']={'000','000','000','000','000'},['2']={'110','001','010','100','111'},['4']={'101','101','111','001','001'},['5']={'111','100','110','001','110'},['6']={'011','100','111','101','111'},['7']={'111','001','010','010','010'},['9']={'111','101','111','001','110'}}
local function txt(str,x,y,size,c)for ch in str:gmatch('.')do local g=F[ch]or F[' '];for r,row in ipairs(g)do for k=1,3 do if row:sub(k,k)=='1'then rect(x+(k-1)*size,y+(r-1)*size,size,size,c)end end end;x=x+4*size end end
local sheet=start(1100,620,'Review contact sheet: woven chiếu repeat, miniature plot and blank wall calendar')
layer(sheet,'01 Presentation field and labels',function()
 rect(0,0,1100,620,'jade');txt('CHIEU MAT',32,28,4,'cream');txt('MINI PLOT',448,28,4,'cream');txt('CALENDAR',790,28,4,'cream')
 rect(31,75,386,386,'ink');rect(439,75,294,386,'ink');rect(761,75,306,386,'ink')
 txt('2 X 2 REPEAT',32,492,3,'cream');txt('44',474,550,3,'cream');txt('56',594,550,3,'cream');txt('72',826,550,3,'cream');txt('96',956,550,3,'cream')
end)
local mat192=resized(OUT..'chieu-mat-tile.png',192,192)
local plot256=resized(OUT..'mini-vacant-plot.png',256,256)
local cal288=resized(OUT..'tear-off-calendar.png',288,384)
local plot44=resized(OUT..'mini-vacant-plot.png',44,44);local plot56=resized(OUT..'mini-vacant-plot.png',56,56)
local cal72=resized(OUT..'tear-off-calendar.png',72,96);local cal96=resized(OUT..'tear-off-calendar.png',96,128)
layer(sheet,'02 Repeated mat and artwork',function()
 for y=0,1 do for x=0,1 do I:drawImage(mat192,Point(32+x*192,76+y*192))end end
 I:drawImage(plot256,Point(458,130));I:drawImage(cal288,Point(770,75))
 I:drawImage(plot44,Point(470,486));I:drawImage(plot56,Point(585,474))
 I:drawImage(cal72,Point(800,446));I:drawImage(cal96,Point(930,420))
end)
save(sheet,'v9-contact-sheet')
print('Saved original v9 mat, mini plot, calendar and contact sheet to '..OUT)
