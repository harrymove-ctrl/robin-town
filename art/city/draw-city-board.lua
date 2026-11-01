-- Vietnamtown: original native Aseprite pixel painting, not generated imagery.
-- Logical pixels are two screen pixels; full resolution keeps plot coordinates exact.
local OUT='/private/tmp/vietnamtown-v3-board/'
local W,H=1100,730
local palette={ink='344d48',deep='294340',edge='7e7a63',road='53625b',roadHi='616d62',roadDark='46564f',lane='c1bc8d',cream='eadfb7',light='f3e9c7',paving='c6bf9e',pavingHi='d7ceab',pavingShade='aaa98d',soil='96997c',stone='9aa088',earth='807b5e',jade='456f51',leaf='668856',leafHi='8da56c',leafLight='afb77b',water='527f79',waterLight='83a398',waterDark='3b6c69',roof='a97758',roofDark='865e4b',tile='bf8a65',brick='ba7056',ochre='c9a267',sand='dbbd80',glass='4d7974',aqua='8aaca0',wood='8a7654',pink='c68a83',white='eae5c8'}
local C={};for k,v in pairs(palette) do C[k]=app.pixelColor.rgba(tonumber(v:sub(1,2),16),tonumber(v:sub(3,4),16),tonumber(v:sub(5,6),16),255) end
C.shadow=app.pixelColor.rgba(39,60,47,70)
local I
local function p(x,y,c) x=math.floor(x);y=math.floor(y);if x>=0 and y>=0 and x<W and y<H then I:drawPixel(x,y,C[c] or c) end end
local function rect(x,y,w,h,c) for yy=math.floor(y),math.floor(y+h-1) do for xx=math.floor(x),math.floor(x+w-1) do p(xx,yy,c) end end end
local function disk(x,y,r,c,ry) ry=ry or r;for yy=y-ry,y+ry do for xx=x-r,x+r do if (xx-x)^2/(r*r)+(yy-y)^2/(ry*ry)<=1 then p(xx,yy,c) end end end end
local function line(x0,y0,x1,y1,c,width)
 width=width or 1;local dx=x1-x0;local dy=y1-y0;local steps=math.max(math.abs(dx),math.abs(dy));for n=0,steps do local x=math.floor(x0+dx*n/steps);local y=math.floor(y0+dy*n/steps);if width==1 then p(x,y,c) else disk(x,y,math.floor(width/2),c) end end
end
local function poly(a,c)
 local ymin,ymax=H,0;for _,v in ipairs(a) do ymin=math.min(ymin,v[2]);ymax=math.max(ymax,v[2]) end
 for y=math.floor(ymin),math.floor(ymax) do local t={};local j=#a;for i=1,#a do local u,v=a[i],a[j];if(u[2]<=y and v[2]>y)or(v[2]<=y and u[2]>y)then t[#t+1]=u[1]+(y-u[2])/(v[2]-u[2])*(v[1]-u[1])end;j=i end;table.sort(t);for k=1,#t-1,2 do for x=math.ceil(t[k]),math.floor(t[k+1]) do p(x,y,c) end end end
end
local function path(a,c,w) for n=1,#a-1 do line(a[n][1],a[n][2],a[n+1][1],a[n+1][2],c,w) end end
local function dashed(a,c,w,step,len)
 local d=0
 for n=1,#a-1 do local x,y=a[n][1],a[n][2];local dx,dy=a[n+1][1]-x,a[n+1][2]-y;local dist=math.sqrt(dx*dx+dy*dy);local ux,uy=dx/dist,dy/dist;local at=-d
 while at<dist do local s=math.max(0,at);local e=math.min(dist,at+len);if e>s then line(math.floor(x+ux*s),math.floor(y+uy*s),math.floor(x+ux*e),math.floor(y+uy*e),c,w) end;at=at+step end
 d=(d+dist)%step
 end
end
local function box(x,y,w,h,c,e)rect(x,y,w,h,e or 'ink');rect(x+2,y+2,w-4,h-4,c)end
local sprite=Sprite(W,H,ColorMode.RGB);sprite:deleteLayer(sprite.layers[1]);sprite.gridBounds=Rectangle(0,0,2,2)
local function layer(name,fn)local l=sprite:newLayer();l.name=name;I=Image(W,H,ColorMode.RGB);I:clear();fn();sprite:newCel(l,1,I,Point(0,0))end
local env={{85,100,232,174},{394,73,232,174},{735,125,232,174},{144,451,232,174},{454,400,232,174},{783,475,232,174}}
local main={{-30,355},{180,339},{333,331},{512,333},{684,348},{845,364},{990,390},{1130,421}}
local west={{30,-10},{30,85},{39,220},{48,285},{70,324},{90,352},{107,379},{111,420},{100,480},{96,580},{112,645},{165,685},{310,700},{506,699},{704,688},{876,683},{1039,676}}
local top={{-20,45},{355,40},{664,44},{861,55},{1090,70}}
local v1={{355,38},{348,134},{346,243},{333,331}}
local v2={{680,45},{681,172},{694,260},{684,348}}
local v3={{391,333},{402,409},{411,510},{414,604},{432,699}}
local v4={{729,353},{730,447},{734,549},{750,686}}
local east={{1024,65},{1020,200},{1030,305},{1046,402},{1047,499},{1040,588},{1039,676},{1052,745}}
local roadset={{p=west,w=23},{p=top,w=25},{p=v1,w=22},{p=v2,w=24},{p=v3,w=22},{p=v4,w=24},{p=east,w=19},{p=main,w=33}}
layer('01 Warm city earth',function()
 rect(0,0,W,H,'soil')
 -- Controlled two-pixel speckling to keep stone tactile, never photographic.
 for y=0,H-2,6 do for x=0,W-2,6 do local z=(x*17+y*23)%73;if z<9 then rect(x,y,2,2,'stone')elseif z>68 then rect(x,y,2,2,'pavingShade')end end end
end)
layer('02 Saigon river and promenade',function()
 poly({{1081,-5},{1066,88},{1086,192},{1073,303},{1089,407},{1070,516},{1083,606},{1062,734},{1101,734},{1101,-5}},'waterDark')
 poly({{1093,-5},{1078,88},{1098,192},{1085,303},{1101,407},{1082,516},{1095,606},{1074,734},{1101,734},{1101,-5}},'water')
 path({{1079,0},{1064,88},{1084,192},{1071,303},{1087,407},{1068,516},{1081,606},{1060,730}},'pavingHi',8)
 path({{1079,0},{1064,88},{1084,192},{1071,303},{1087,407},{1068,516},{1081,606},{1060,730}},'ink',2)
 for y=8,720,32 do local x=1089+((y*7)%19);line(x,y,x+13,y,'waterLight',2);line(x-2,y+4,x+5,y+4,'waterDark',2)end
 -- Stone mooring pier, and a small timber sampan, both deliberately low contrast.
 poly({{1058,264},{1095,274},{1092,283},{1058,279}},'wood');line(1060,269,1092,278,'sand',2)
 poly({{1085,334},{1091,317},{1098,334},{1094,356},{1087,350}},'ink');poly({{1087,334},{1091,323},{1095,336},{1092,349},{1089,346}},'ochre');line(1090,333,1092,341,'wood',2)
end)
layer('03 Irregular blocks and broad sidewalks',function()
 local blocks={
 {{56,65},{322,66},{329,219},{310,302},{93,310},{70,276}},
 {{374,60},{650,67},{662,206},{645,300},{450,312},{370,300},{367,178}},
 {{708,81},{998,86},{1007,273},{1018,343},{882,347},{721,321},{715,236}},
 {{131,395},{365,382},{377,445},{387,612},{346,660},{173,655},{123,616},{123,490}},
 {{433,374},{702,382},{709,556},{696,643},{465,668},{433,609},{434,482}},
 {{757,399},{1017,426},{1023,591},{1014,658},{796,660},{770,626},{756,513}}
 }
 for _,a in ipairs(blocks)do poly(a,'earth');local inner={};local cx,cy=0,0;for _,v in ipairs(a)do cx=cx+v[1];cy=cy+v[2]end;cx=cx/#a;cy=cy/#a;for _,v in ipairs(a)do inner[#inner+1]={v[1]+(cx-v[1])*0.025,v[2]+(cy-v[2])*0.025}end;poly(inner,'paving')end
 -- Paving joints make district edges look like a continuous city, not panels.
 for y=12,H,18 do for x=12,1047,34 do if(x*3+y*7)%13<3 then line(x,y,x+10,y,'pavingShade',1)end end end
end)
layer('04 Curved western pocket park',function()
 poly({{0,385},{38,371},{73,390},{82,434},{65,490},{65,565},{74,623},{58,658},{5,660},{0,613}},'earth')
 poly({{0,392},{34,381},{62,397},{71,432},{54,490},{54,568},{63,622},{52,647},{5,649},{0,611}},'jade')
 poly({{4,406},{28,394},{50,405},{55,436},{38,493},{40,566},{47,615},{39,630},{6,627}},'leaf')
 path({{4,418},{26,421},{37,441},{22,489},{22,549},{31,588},{20,627},{4,637}},'pavingShade',15)
 path({{4,418},{26,421},{37,441},{22,489},{22,549},{31,588},{20,627},{4,637}},'sand',10)
 disk(31,462,15,'waterDark',23);disk(29,459,12,'water',19);line(22,454,33,454,'waterLight',2);line(27,467,34,467,'waterLight',2)
 -- A triangular public garden above the southwest block.
 poly({{129,378},{207,366},{303,368},{359,387},{342,421},{235,431},{138,414}},'jade')
 poly({{139,383},{209,377},{301,379},{341,390},{330,408},{233,420},{145,406}},'leaf')
 path({{153,397},{222,397},{272,391},{315,397}},'sand',11)
 disk(216,397,17,'pavingHi');disk(216,397,11,'waterDark');disk(216,397,8,'water');disk(215,394,3,'waterLight')
end)
layer('05 Joined streets with stone kerbs',function()
 for _,r in ipairs(roadset)do path(r.p,'edge',r.w+17)end
 for _,r in ipairs(roadset)do path(r.p,'pavingHi',r.w+12)end
 for _,r in ipairs(roadset)do path(r.p,'roadDark',r.w+3)end
 for _,r in ipairs(roadset)do path(r.p,'road',r.w)end
 -- Road-worn light strips and discreet broken lane markings.
 for _,r in ipairs(roadset)do dashed(r.p,'lane',2,28,12)end
 -- Curbs remain visible while intersections share one continuous road surface.
end)
layer('06 Crossings and street details',function()
 local function crossing(x,y,rot)
  for i=-3,3 do if rot then rect(x-11,y+i*6-2,23,3,'cream')else rect(x+i*6-2,y-12,3,25,'cream')end end
 end
 crossing(316,303,true);crossing(368,334,false);crossing(428,338,false);crossing(670,319,true);crossing(734,391,true);crossing(1027,370,true);crossing(407,443,true);crossing(112,427,true);crossing(707,690,false)
 -- Pedestrian refuge and bus lay-by beside the eastern promenade.
 box(836,391,86,17,'pavingHi','edge');rect(842,396,74,5,'road');dashed({{842,398},{916,398}},'lane',1,13,6)
 box(873,414,39,14,'glass');rect(874,413,38,3,'aqua');rect(877,428,3,8,'ink');rect(907,428,3,8,'ink');rect(880,424,24,3,'ochre')
 -- Street drains, bollards, benches.
 for _,a in ipairs({{326,211},{373,280},{648,267},{710,220},{422,528},{713,601},{771,435},{994,659},{96,569}})do box(a[1],a[2],10,6,'roadDark','edge');for q=2,7,3 do rect(a[1]+q,a[2]+1,1,4,'road')end end
 for _,a in ipairs({{191,411},{273,411},{529,624},{986,412},{59,545}})do rect(a[1],a[2],20,5,'wood');rect(a[1],a[2]-3,20,2,'sand');rect(a[1]+2,a[2]+5,2,4,'ink');rect(a[1]+16,a[2]+5,2,4,'ink')end
 for y=111,233,24 do rect(1050,y,4,4,'edge');rect(1050,y-2,4,2,'cream')end
end)
local function roof(x,y,w,h,type)
 -- Top-down stepped shophouse roofs; the southeast eave casts a pixel shadow.
 poly({{x+4,y+5},{x+w+5,y+5},{x+w+5,y+h+6},{x+4,y+h+6}},'shadow')
 box(x,y,w,h,type=='flat'and'pavingShade'or'roof','roofDark')
 if type=='flat'then
  rect(x+4,y+4,w-8,h-8,'stone');rect(x+6,y+6,w-12,2,'pavingHi');box(x+w-15,y+7,9,8,'pavingHi','edge');rect(x+w-13,y+9,5,2,'stone')
  box(x+6,y+h-13,10,8,'glass','edge');line(x+8,y+h-11,x+13,y+h-11,'aqua',1)
 else
  for yy=y+5,y+h-4,6 do line(x+3,yy,x+w-4,yy,'tile',2)end
  for xx=x+7,x+w-4,9 do line(xx,y+3,xx,y+h-4,'roofDark',1)end
  rect(x+2,y+math.floor(h/2)-1,w-4,3,'sand');rect(x+2,y+math.floor(h/2)+2,w-4,1,'roofDark')
 end
end
layer('07 Nonplayable Saigon shophouse roof clusters',function()
 -- The blocks have real nonplayable roof/yard fragments around the reserved plots.
 roof(68,77,64,16);roof(140,75,54,18,'flat');roof(203,74,81,18)
 roof(66,115,13,78,'flat');roof(61,203,18,65);roof(99,285,58,21);roof(165,286,43,20,'flat');roof(222,286,57,21)
 roof(408,266,51,43);roof(467,266,36,28,'flat');roof(511,273,84,38);roof(611,264,32,33,'flat')
 roof(389,16,59,15);roof(461,13,87,19);roof(562,13,63,21,'flat')
 roof(750,92,66,23);roof(824,92,50,22,'flat');roof(886,97,62,20)
 roof(978,135,21,62,'flat');roof(978,211,24,71);roof(770,310,60,22);roof(842,315,49,25,'flat');roof(900,317,63,29)
 roof(145,636,53,18,'flat');roof(209,638,58,21);roof(275,634,62,18)
 roof(471,589,73,46);roof(554,590,50,27,'flat');roof(612,589,70,43)
 roof(554,626,45,23);roof(464,643,71,17,'flat');roof(613,640,61,17)
 roof(797,429,41,35,'flat');roof(846,438,77,26);roof(931,438,66,26)
 roof(171,716,70,15,'flat');roof(252,716,74,15);roof(460,715,48,17);roof(522,714,63,18,'flat');roof(788,704,65,23);roof(864,703,50,24,'flat');roof(924,701,90,24)
end)
local function tree(x,y,r)
 disk(x+4,y+5,r,'shadow',r-2);disk(x,y,r,'ink',r-2);disk(x-2,y-2,r-2,'jade',r-3);disk(x-4,y-4,r-4,'leaf',r-5);disk(x+4,y-3,r-5,'leafHi',r-6);rect(x-5,y-7,4,2,'leafLight');rect(x-1,y+2,3,3,'jade')
end
layer('08 Canopy clusters, courtyards, café umbrellas',function()
 for _,a in ipairs({{12,396,12},{56,404,13},{62,479,10},{49,528,13},{57,579,13},{45,638,13},{9,602,11},{14,568,8},{8,509,10},{25,391,10},{138,391,12},{164,376,11},{254,380,10},{320,383,12},{344,408,10},{133,637,10},{358,645,12},{691,618,11},{1023,628,8},{999,420,8},{706,104,9},{708,170,9},{708,238,9},{364,81,8},{64,247,7},{1038,133,7},{1045,227,7},{1059,466,7},{1058,551,7},{1049,641,7}})do tree(a[1],a[2],a[3])end
 -- Terracotta planters and little circular café parasols.
 for _,a in ipairs({{294,295},{647,290},{973,318},{434,386},{710,576}})do box(a[1]-4,a[2]+5,10,7,'roof','roofDark');tree(a[1],a[2],7)end
 for _,a in ipairs({{364,267},{367,286},{645,321},{650,304}})do
  disk(a[1]+2,a[2]+3,9,'shadow');disk(a[1],a[2],8,'roofDark');disk(a[1],a[2],6,'sand');line(a[1]-5,a[2]-4,a[1]+5,a[2]+4,'brick',2);line(a[1]+4,a[2]-5,a[1]-4,a[2]+5,'brick',2);rect(a[1]-1,a[2]-1,2,2,'cream')
 end
end)
layer('09 Exact gameplay plot envelopes — keep clear',function()
 for _,a in ipairs(env)do
  rect(a[1],a[2],a[3],a[4],'paving')
  -- Two-pixel weathering is quiet behind the separately rendered plot pieces.
  for y=a[2]+6,a[2]+a[4]-4,18 do for x=a[1]+7,a[1]+a[3]-4,22 do if (x+y)%5==0 then rect(x,y,3,1,'pavingShade')end end end
 end
end)
sprite.data='Original Vietnamtown city board, painted through native Aseprite Lua. 1100x730 pixels. Six clear gameplay envelopes supplied in layout.md. Streets and architecture fictionalized; Saigon city-life theme, not a geographic reconstruction. Layers separate terrain, river, sidewalks, park, streets, crossings, roofs, vegetation and clear plot zones.'
sprite:saveAs(OUT..'saigon-city-board.aseprite')
sprite:saveCopyAs(OUT..'saigon-city-board.png')
print('Saved original layered Aseprite board: '..OUT..'saigon-city-board.png')
