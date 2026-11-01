local OUT='/private/tmp/saigon-v9-assets/'
local mat=Image{fromFile=OUT..'chieu-mat-tile.png'}
local plot=Image{fromFile=OUT..'mini-vacant-plot.png'}
local calendar=Image{fromFile=OUT..'tear-off-calendar.png'}
assert(mat.width==96 and mat.height==96)
assert(plot.width==64 and plot.height==64)
assert(calendar.width==96 and calendar.height==128)
for y=0,95 do for x=0,95 do assert(app.pixelColor.rgbaA(mat:getPixel(x,y))==255,'Mat must be opaque')end end
local function quiet(im,x,y,w,h)
 local c=im:getPixel(x,y)
 for yy=y,y+h-1 do for xx=x,x+w-1 do assert(im:getPixel(xx,yy)==c,'Quiet rectangle contains nonuniform art: '..xx..','..yy)end end
end
quiet(plot,20,16,27,20);quiet(calendar,20,43,58,61)
assert(app.pixelColor.rgbaA(plot:getPixel(0,0))==0)
assert(app.pixelColor.rgbaA(calendar:getPixel(0,0))==0)
print('PASS: dimensions, mat opacity, plot/calendar transparency, and exact quiet overlay rectangles')
