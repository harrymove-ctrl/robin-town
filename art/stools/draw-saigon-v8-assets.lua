-- Saigon Town: original stool markers and branded assets, authored in native Aseprite.
-- Reference is used only for stool structure, not sampled or traced into the artwork.
local OUT='/private/tmp/saigon-v8-assets/'
local ROOT='/Users/thohong/Projects/vietnamtown/'
local function color(hex,a)
 hex=hex:gsub('#','');return app.pixelColor.rgba(tonumber(hex:sub(1,2),16),tonumber(hex:sub(3,4),16),tonumber(hex:sub(5,6),16),a or 255)
end
local function shade(hex,f)
 local vals={};hex=hex:gsub('#','');for j=1,5,2 do vals[#vals+1]=math.min(255,math.floor(tonumber(hex:sub(j,j+1),16)*f+0.5))end
 return app.pixelColor.rgba(vals[1],vals[2],vals[3],255)
end
local function tint(hex,t)
 local vals={};for j=1,5,2 do local n=tonumber(hex:sub(j,j+1),16);vals[#vals+1]=math.floor(n+(255-n)*t)end
 return app.pixelColor.rgba(vals[1],vals[2],vals[3],255)
end
local CLEAR=app.pixelColor.rgba(0,0,0,0)
local JADE=color('143f33');local INK=color('0c2b24');local CREAM=color('f4e4bc');local GOLD=color('eec353');local MUTED=color('8eaa88')
local I
local function px(x,y,c)x=math.floor(x);y=math.floor(y);if x>=0 and y>=0 and x<I.width and y<I.height then I:drawPixel(x,y,c)end end
local function rect(x,y,w,h,c)for yy=math.floor(y),math.floor(y+h-1)do for xx=math.floor(x),math.floor(x+w-1)do px(xx,yy,c)end end end
local function line(x0,y0,x1,y1,c,w)
 w=w or 1;local n=math.max(math.abs(x1-x0),math.abs(y1-y0));for k=0,n do local x=math.floor(x0+(x1-x0)*k/math.max(n,1)+.5);local y=math.floor(y0+(y1-y0)*k/math.max(n,1)+.5);rect(x,y,w,w,c)end
end
local function poly(a,c,edge)
 local miny,maxy=9999,-1;for _,p in ipairs(a)do miny=math.min(miny,p[2]);maxy=math.max(maxy,p[2])end
 for y=math.floor(miny),math.floor(maxy)do local xs={};for j,p in ipairs(a)do local q=a[j%#a+1];if(p[2]<=y and q[2]>y)or(q[2]<=y and p[2]>y)then xs[#xs+1]=p[1]+(y-p[2])/(q[2]-p[2])*(q[1]-p[1])end end;table.sort(xs);for j=1,#xs-1,2 do for x=math.ceil(xs[j]),math.floor(xs[j+1])do px(x,y,c)end end end
 if edge then for j,p in ipairs(a)do local q=a[j%#a+1];line(p[1],p[2],q[1],q[2],edge)end end
end
local function ellipse(cx,cy,rx,ry,c)
 for yy=math.floor(cy-ry),math.ceil(cy+ry)do for xx=math.floor(cx-rx),math.ceil(cx+rx)do if(xx-cx)^2/(rx*rx)+(yy-cy)^2/(ry*ry)<=1 then px(xx,yy,c)end end end
end
local function start(w,h,name)
 local s=Sprite(w,h,ColorMode.RGB);s:deleteLayer(s.layers[1]);s.data=name;s.gridBounds=Rectangle(0,0,1,1);return s
end
local function layer(s,name,fn)
 local l=s:newLayer();l.name=name;I=Image(s.width,s.height,ColorMode.RGB);I:clear();fn();s:newCel(l,1,I,Point(0,0));return l
end
local function save(s,name)s:saveAs(OUT..name..'.aseprite');s:saveCopyAs(OUT..name..'.png')end
local function loadResized(path,w,h)
 local s=app.open(path);if w then s:resize(w,h or w)end;local im=Image(s);s:close();return im
end
local stools={}
local bases={'39a883','eec353','dc6f57','7fb5cf'}
for n,base in ipairs(bases)do
 local c={ink=shade(base,.35),dark=shade(base,.51),side=shade(base,.69),rib=shade(base,.83),face=color(base),top=tint(base,.17),rim=tint(base,.32),glint=tint(base,.57)}
 local s=start(64,64,'Original Vietnamese low molded-plastic stool. Four ownership colors. Native 64px with broad open arches, square ribbed seat and flared legs; authored with Aseprite Lua.')
 layer(s,'01 Rear leg and inner frame',function()
  poly({{38,19},{44,18},{47,43},{43,46},{39,45}},c.ink)
  poly({{39,22},{42,21},{44,43},{42,43}},c.dark)
  poly({{12,20},{17,22},{14,48},{9,48}},c.ink)
  poly({{13,25},{15,25},{12,46},{10,46}},c.side)
  line(14,43,43,36,c.ink,3);line(15,42,42,36,c.dark,2)
 end)
 layer(s,'02 Left molded face with open side arch',function()
  poly({{10,14},{24,22},{20,58},{16,60},{5,52},{8,35}},c.ink)
  poly({{11,18},{22,24},{18,56},{16,57},{7,50},{10,34}},c.side)
  poly({{11,26},{13,24},{17,27},{19,31},{16,44},{9,39}},CLEAR)
  poly({{9,43},{17,47},{17,51},{8,46}},c.dark)
  line(9,43,17,47,c.rib);line(10,24,8,41,c.rim)
  line(8,47,7,50,c.rib,2);line(8,50,16,55,c.face)
  line(19,26,16,57,c.dark)
 end)
 layer(s,'03 Front body with broad arches and flared feet',function()
  poly({{22,22},{54,14},{61,53},{59,55},{51,57},{47,43},{30,47},{28,61},{25,63},{16,59}},c.ink)
  poly({{24,24},{52,17},{58,52},{52,54},{48,39},{29,44},{26,59},{19,57}},c.face)
  -- Large rounded upper aperture, left open to reveal the rear support naturally.
  poly({{30,31},{32,27},{43,24},{47,26},{50,36},{29,42}},CLEAR)
  -- Aperture under the lower cross brace: clearly separates the two front feet.
  poly({{29,48},{48,43},{52,57},{28,62}},CLEAR)
  poly({{29,43},{48,38},{49,42},{29,47}},c.side)
  line(30,43,47,39,c.rim);line(29,47,48,42,c.dark)
  line(24,26,20,56,c.rim,2);line(22,55,25,56,c.glint)
  line(51,20,57,51,c.rib,2);line(52,49,54,52,c.top)
  line(19,57,26,59,c.dark,2);line(52,54,59,52,c.dark,2)
  -- Small plain molded maker inset, without any real brand or borrowed logo.
  poly({{32,25},{43,22},{43,24},{32,27}},c.rib)
  line(34,25,41,23,c.rim)
 end)
 layer(s,'04 Square rounded seat and raised outer lip',function()
  poly({{9,13},{13,10},{40,4},{45,5},{54,10},{56,14},{54,19},{25,27},{21,26},{10,19}},c.ink)
  poly({{11,14},{14,12},{41,6},{45,7},{52,12},{54,14},{52,17},{24,25},{21,24},{12,18}},c.face)
  poly({{13,13},{40,7},{45,8},{51,12},{51,15},{23,23},{14,17}},c.top)
  line(13,13,40,7,c.rim);line(14,12,40,6,c.glint)
  line(13,17,23,23,c.rim);line(24,24,51,16,c.rib)
  line(25,26,52,18,c.dark)
 end)
 layer(s,'05 Seat ribs and central molded hole',function()
  -- Five slanted ribs follow the seat perspective. Strong seat outline survives 24px use.
  line(18,13,25,18,c.rib);line(22,12,29,17,c.rib);line(27,11,34,16,c.rib);line(32,10,39,15,c.rib);line(38,9,45,14,c.rib)
  line(18,14,24,18,c.rim);line(28,12,33,15,c.rim);line(38,10,43,13,c.rim)
  poly({{30,15},{33,14},{35,15},{32,16}},c.dark)
  px(31,15,c.ink);line(15,18,20,21,c.glint)
 end)
 save(s,'stool-'..(n-1));stools[n]=Image(s)
end

-- A small original bitmap alphabet. All branding text is native Aseprite pixels.
local FONT={
 A={'01110','11011','11011','11111','11011','11011','11011'},
 B={'11110','11011','11011','11110','11011','11011','11110'},
 C={'01111','11000','11000','11000','11000','11000','01111'},
 D={'11110','11011','11011','11011','11011','11011','11110'},
 E={'11111','11000','11000','11110','11000','11000','11111'},
 F={'11111','11000','11000','11110','11000','11000','11000'},
 G={'01111','11000','11000','11011','11011','11011','01111'},
 H={'11011','11011','11011','11111','11011','11011','11011'},
 I={'11111','01110','01110','01110','01110','01110','11111'},
 J={'00111','00011','00011','00011','11011','11011','01110'},
 K={'11011','11011','11110','11100','11110','11011','11011'},
 L={'11000','11000','11000','11000','11000','11000','11111'},
 M={'11011','11111','11111','11011','11011','11011','11011'},
 N={'11011','11111','11111','11111','11011','11011','11011'},
 O={'01110','11011','11011','11011','11011','11011','01110'},
 P={'11110','11011','11011','11110','11000','11000','11000'},
 Q={'01110','11011','11011','11011','11111','01110','00011'},
 R={'11110','11011','11011','11110','11100','11010','11011'},
 S={'01111','11000','11000','01110','00011','00011','11110'},
 T={'11111','01110','01110','01110','01110','01110','01110'},
 U={'11011','11011','11011','11011','11011','11011','01110'},
 V={'11011','11011','11011','11011','11011','01110','00100'},
 W={'11011','11011','11011','11011','11111','11111','11011'},
 X={'11011','11011','01110','00100','01110','11011','11011'},
 Y={'11011','11011','11011','01110','01110','01110','01110'},
 Z={'11111','00011','00110','01100','11000','11000','11111'},
 ['.']={'00000','00000','00000','00000','00000','01100','01100'},
 ['-']={'00000','00000','00000','11111','00000','00000','00000'},
 [' ']={'00000','00000','00000','00000','00000','00000','00000'},
 ['2']={'11110','00011','00011','01110','11000','11000','11111'},
 ['3']={'11110','00011','00011','01110','00011','00011','11110'},
 ['4']={'11011','11011','11011','11111','00011','00011','00011'},
 ['6']={'01111','11000','11000','11110','11011','11011','01110'}
}
local function text(t,x,y,scale,c,gap)
 gap=gap or 1;for ch in t:gmatch('.')do local g=FONT[ch]or FONT[' '];for yy,row in ipairs(g)do for xx=1,5 do if row:sub(xx,xx)=='1'then rect(x+(xx-1)*scale,y+(yy-1)*scale,scale,scale,c)end end end;x=x+(5+gap)*scale end
end
local function cornerFrame(x,y,w,h,c,thick)
 thick=thick or 2;local k=12
 rect(x+k,y,w-2*k,thick,c);rect(x+k,y+h-thick,w-2*k,thick,c)
 rect(x,y+k,thick,h-2*k,c);rect(x+w-thick,y+k,thick,h-2*k,c)
 -- Four stepped corners.
 line(x,y+k,x+k,y,c,thick);line(x+w-k,y,x+w-thick,y+k,c,thick);line(x,y+h-k,x+k,y+h-thick,c,thick);line(x+w-k,y+h-thick,x+w-thick,y+h-k,c,thick)
end

-- Home-screen icon: one unmistakable gold plastic stool, safe breathing room, jade field.
local icon=start(512,512,'Saigon Town app icon. Original gold stool on dark jade. Native Aseprite composition, no external font/image generation.')
layer(icon,'01 Dark jade field',function()
 rect(0,0,512,512,JADE)
 for y=16,496,16 do for x=16,496,16 do if(x+y)%48==0 then rect(x,y,2,2,color('204b3b'))end end end
 -- Deliberately subtle frame; operating systems can apply their own rounded mask.
 rect(40,30,432,3,color('35644a'));rect(40,479,432,3,color('35644a'))
 rect(30,40,3,432,color('35644a'));rect(479,40,3,432,color('35644a'))
end)
layer(icon,'02 Grounded stool shadow',function()ellipse(259,426,143,21,color('061e19',105))end)
local goldLarge=loadResized(OUT..'stool-1.png',384,384)
layer(icon,'03 Gold stool emblem',function()I:drawImage(goldLarge,Point(62,45))end)
save(icon,'app-icon-512')
for _,size in ipairs({192,180})do
 local copy=app.open(OUT..'app-icon-512.aseprite');copy:resize(size,size);copy:saveCopyAs(OUT..'app-icon-'..size..'.png');copy:close()
end

-- Open Graph art: large native lettering, a physical city-board vignette, and recognisable shops.
local og=start(1200,630,'SAIGON TOWN original social share artwork. Native Aseprite bitmap lettering and original game art.')
layer(og,'01 Jade cloth and warm brand frame',function()
 rect(0,0,1200,630,JADE)
 for y=5,625,8 do for x=5,1195,8 do if(x*13+y*7)%31<3 then rect(x,y,2,2,color('1a4638'))end end end
 rect(28,28,1144,2,color('729265'));rect(28,600,1144,2,color('729265'))
 rect(28,28,2,574,color('729265'));rect(1170,28,2,574,color('729265'))
 -- Small stitched-corner motifs repeat the board game's physical materials.
 for _,p in ipairs({{41,41},{1152,41},{41,581},{1152,581}})do rect(p[1],p[2],7,7,GOLD)end
end)
local board=loadResized(ROOT..'public/assets/city/saigon-city-board-v6.png')
local crop=Image(504,502,ColorMode.RGB);crop:clear();crop:drawImage(board,Point(-375,-175))
layer(og,'02 Cropped original city board and wooden rim',function()
 rect(640,63,521,520,color('071f19',150));rect(636,55,520,520,color('8c6941'))
 rect(643,62,506,506,color('e5c991'));I:drawImage(crop,Point(644,64))
 -- Wash keeps the physical board scenery secondary to the large shops.
 rect(638,57,516,3,color('cbab6c'));rect(638,570,516,4,color('573e28'))
end)
layer(og,'02b Subtle jade wash on the board',function()rect(644,64,504,502,color('174437',42))end)
layer(og,'03 Title shadow and main brand',function()
 text('A VIETNAMESE TRADING GAME',64,74,2,MUTED)
 text('SAIGON',69,157,12,INK)
 text('SAIGON',64,151,12,CREAM)
 text('TOWN',68,270,15,INK)
 text('TOWN',64,264,15,GOLD)
 rect(64,396,48,3,GOLD);rect(120,396,390,1,color('4e7654'))
 text('BUILD. BARGAIN. BELONG.',64,425,3,CREAM)
 text('PULL UP A STOOL.',64,520,3,MUTED)
end)
local coffee=loadResized(ROOT..'public/assets/shops/coffee.png',276,276)
local banhmi=loadResized(ROOT..'public/assets/shops/banhmi.png',250,250)
local pho=loadResized(ROOT..'public/assets/shops/pho.png',244,244)
layer(og,'04 Three neighbourhood shops',function()
 I:drawImage(coffee,Point(770,112));I:drawImage(banhmi,Point(613,262));I:drawImage(pho,Point(936,286))
end)
local stoolLarge={};for n=1,4 do stoolLarge[n]=loadResized(OUT..'stool-'..(n-1)..'.png',96,96)end
layer(og,'05 Four colourful ownership stools',function()
 I:drawImage(stoolLarge[1],Point(728,458));I:drawImage(stoolLarge[2],Point(825,475));I:drawImage(stoolLarge[3],Point(935,466));I:drawImage(stoolLarge[4],Point(1040,475))
end)
save(og,'saigon-town-og')

-- Review sheet: big silhouettes and their real UI sizes on both map stone and jade.
local sheet=start(1200,420,'Review sheet for original stool marker sprites and app identity')
layer(sheet,'01 Review backgrounds and captions',function()
 rect(0,0,1200,420,JADE);rect(24,68,890,314,color('d1c6ac'));rect(938,68,238,314,color('1b4b3b'))
 text('SAIGON TOWN - PLASTIC STOOLS',26,25,3,CREAM)
 text('APP ICON',959,349,3,CREAM)
end)
layer(sheet,'02 Marker size review',function()
 for n=1,4 do
  local x=36+(n-1)*219
  local large=loadResized(OUT..'stool-'..(n-1)..'.png',192,192);I:drawImage(large,Point(x,83))
  local small32=loadResized(OUT..'stool-'..(n-1)..'.png',32,32);local small24=loadResized(OUT..'stool-'..(n-1)..'.png',24,24)
  I:drawImage(small32,Point(x+54,301));I:drawImage(small24,Point(x+112,309))
  text('32',x+57,349,2,JADE);text('24',x+109,349,2,JADE)
 end
 local appImage=loadResized(OUT..'app-icon-192.png');I:drawImage(appImage,Point(960,104))
end)
save(sheet,'stool-contact-sheet')
print('Saved four stools, app icons, original OG image and contact sheet to '..OUT)
