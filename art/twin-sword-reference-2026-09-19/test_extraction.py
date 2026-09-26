"""Regression: full weapons and feet survive inaccurate atlas grid spacing."""
import unittest
import numpy as np
from PIL import Image, ImageDraw
from atlas_components import extract_figures


class ExtractionTests(unittest.TestCase):
    def test_cross_grid_weapons_and_glow_bridges(self):
        image=Image.new('RGBA',(800,800));draw=ImageDraw.Draw(image)
        colors=[]
        for i in range(16):
            x=i%4*200+50;y=i//4*200+40;color=(10+i*10,80,120,255);colors.append(color)
            draw.rectangle((x,y,x+80,y+145),fill=color)
            # Feet cross the nominal horizontal quarter boundary.
            draw.rectangle((x,y+140,x+95,y+170),fill=color)
            # A sword crosses the nominal vertical boundary, still attached.
            draw.line((x+70,y+70,x+165,y+110),fill=color,width=4)
        draw.line((90,205,90,250),fill=(255,180,30,10),width=3)
        draw.point((799,799),fill=(255,255,255,1))
        crops,meta=extract_figures(image, count=16)
        self.assertEqual(len(crops),16)
        source=np.asarray(image)
        for crop,color in zip(crops,colors):
            pixels=np.asarray(crop)
            original=((source==color).all(axis=2)).sum()
            retained=((pixels==color).all(axis=2)).sum()
            self.assertEqual(original,retained,'a whole figure must remain in its own reading-order pose')
            opaque=pixels[pixels[:,:,3]==255]
            self.assertTrue((opaque==color).all(),'neighboring figures must not leak into a pose')
            self.assertLess(crop.width,195,'remote near-transparent noise must not inflate the crop')
        self.assertEqual(meta['method'],'connected-alpha-reading-order')


if __name__=='__main__':unittest.main()
