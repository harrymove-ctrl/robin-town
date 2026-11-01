-- Six original sign pictograms painted with native Aseprite Lua pixel primitives.
-- One warm-cream ink only, transparent background and transparent negative space.
local OUT='/private/tmp/saigon-v6-art/icons/'
local W,H=32,32
local cream=app.pixelColor.rgba(241,225,183,255)
local clear=app.pixelColor.rgba(0,0,0,0)
local I
local function p(x,y,c)x=math.floor(x);y=math.floor(y);if x>=0 and y>=0 and x<W and y<H then I:drawPixel(x,y,c or cream)end end
local function rect(x,y,w,h,c)for yy=y,y+h-1 do for xx=x,x+w-1 do p(xx,yy,c)end end end
local function disk(x,y,r,c)for yy=y-r,y+r do for xx=x-r,x+r do if(xx-x)^2+(yy-y)^2<=r*r then p(xx,yy,c)end end end end
local function line(x0,y0,x1,y1,c,w)
 w=w or 1;local steps=math.max(math.abs(x1-x0),math.abs(y1-y0));if steps==0 then p(x0,y0,c);return end
 for n=0,steps do rect(math.floor(x0+(x1-x0)*n/steps),math.floor(y0+(y1-y0)*n/steps),w,w,c)end
end
local function poly(a,c)
 local ymin,ymax=H,0;for _,v in ipairs(a)do ymin=math.min(ymin,v[2]);ymax=math.max(ymax,v[2])end
 for y=math.floor(ymin),math.floor(ymax)do local t={};local j=#a;for i=1,#a do local u,v=a[i],a[j];if(u[2]<=y and v[2]>y)or(v[2]<=y and u[2]>y)then t[#t+1]=u[1]+(y-u[2])/(v[2]-u[2])*(v[1]-u[1])end;j=i end;table.sort(t);for k=1,#t-1,2 do for x=math.ceil(t[k]),math.floor(t[k+1])do p(x,y,c)end end end
end
local defs={
 {'tan-dinh',function()
  rect(15,2,2,7);rect(13,4,6,2)
  poly({{10,13},{16,7},{22,13}});rect(11,13,10,15)
  poly({{4,20},{8,15},{12,20}});rect(5,20,6,8)
  poly({{20,20},{24,15},{28,20}});rect(21,20,6,8)
  rect(15,13,2,4,clear);rect(14,22,4,6,clear)
  rect(7,22,2,3,clear);rect(23,22,2,3,clear)
  rect(4,28,24,2)
 end},
 {'ben-thanh',function()
  poly({{10,11},{16,5},{22,11}});rect(12,10,9,19)
  poly({{2,22},{6,17},{12,17},{12,22}});poly({{21,17},{26,17},{30,22},{21,22}})
  rect(4,22,24,7);rect(7,24,3,5,clear);rect(23,24,3,5,clear)
  disk(16,15,4,clear);disk(16,15,3);disk(16,15,2,clear)
  line(16,13,16,15);line(16,15,18,15)
  rect(14,24,5,5,clear);rect(3,29,26,1)
 end},
 {'thao-dien',function()
  poly({{3,6},{9,6},{13,10},{12,15},{7,16},{3,12}})
  line(5,8,10,13,clear);rect(7,15,2,9)
  poly({{13,15},{21,8},{29,15}});rect(15,15,12,10)
  rect(18,18,3,4,clear);rect(23,19,2,6,clear)
  rect(2,27,8,2);rect(11,28,8,2);rect(20,27,10,2)
 end},
 {'cho-lon',function()
  poly({{8,7},{12,7},{14,4},{18,4},{20,7},{24,7},{22,10},{10,10}})
  poly({{2,12},{6,13},{10,10},{22,10},{26,13},{30,12},{27,17},{5,17}})
  rect(6,17,4,12);rect(22,17,4,12)
  rect(9,19,14,3);rect(11,22,2,7);rect(19,22,2,7)
  rect(4,28,7,2);rect(21,28,7,2)
 end},
 {'binh-thanh',function()
  rect(13,5,6,4);poly({{2,16},{10,9},{22,9},{30,16}})
  rect(4,17,24,3);rect(5,20,3,8);rect(13,20,3,8);rect(24,20,3,8)
  rect(19,20,2,8);rect(3,28,26,2)
  rect(14,11,4,2,clear)
 end},
 {'phu-nhuan',function()
  disk(9,11,6);disk(6,15,4);disk(13,15,5)
  rect(9,17,3,8);rect(11,20,4,2);rect(14,18,2,4)
  poly({{18,15},{24,10},{30,15}});rect(20,16,8,13)
  rect(23,18,2,3,clear);rect(23,25,3,4,clear)
  poly({{9,29},{14,24},{18,24},{14,29}})
  rect(2,28,6,2)
 end}
}
local images={}
for _,def in ipairs(defs)do
 local s=Sprite(W,H,ColorMode.RGB);s.layers[1].name='Warm cream silhouette'
 I=Image(W,H,ColorMode.RGB);I:clear();def[2]();s:newCel(s.layers[1],1,I,Point(0,0))
 s.data='Original monochrome district sign pictogram. Native Aseprite Lua. 32x32 RGBA, warm cream #f1e1b7 only; all negative space is transparent.'
 s:saveAs(OUT..def[1]..'-v6.aseprite');s:saveCopyAs(OUT..def[1]..'-v6.png');images[#images+1]=Image(I)
end
-- Review atlas: actual icons remain fully transparent around their silhouettes.
local sheet=Sprite(240,56,ColorMode.RGB);sheet.layers[1].name='Green sign preview only'
local canvas=Image(240,56,ColorMode.RGB);canvas:clear(app.pixelColor.rgba(27,65,48,255))
for n,img in ipairs(images)do canvas:drawImage(img,Point((n-1)*40+4,12))end
sheet:newCel(sheet.layers[1],1,canvas,Point(0,0));sheet:saveAs(OUT..'district-sign-icons-preview-v6.aseprite');sheet:resize(960,224);sheet:saveCopyAs(OUT..'district-sign-icons-preview-v6.png')
print('Six 32x32 transparent monochrome district icons saved under '..OUT)
