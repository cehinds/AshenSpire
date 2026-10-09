// Visual data only: card names, rules, costs and identities remain bound to game data.
export const CARD_STYLE_KEYS=new Set(['color','background','backgroundColor','border','borderRadius','boxShadow','textShadow','filter','opacity','clipPath','fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','textTransform','lineHeight','textAlign','padding','gap','width','height','minHeight','maxHeight','maxWidth','left','right','top','bottom','inset','position','display','alignItems','justifyContent','WebkitTextStroke','paintOrder']);
export function validateCardAppearance(doc){
  const asset=href=>{if(href!=null&&href!==''&&(!/^assets\/[\w/.-]+\.(png|webp|svg|jpg|jpeg)$/.test(href)||href.includes('..')))throw Error('Use an image path under assets/: '+href);};
  const style=s=>{for(const [key,value] of Object.entries(s||{}))if(!CARD_STYLE_KEYS.has(key)||typeof value!=='string'||value.length>1000||/[<>;{}]|url\s*\(/i.test(value))throw Error('Invalid visual style: '+key);};
  const visual=v=>{
    if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid component appearance');
    asset(v.href);style(v.style);for(const decoration of v.decorations||[])style(decoration.style);
    if(v.fit&&!['fill','contain','cover'].includes(v.fit))throw Error('Invalid image fit');
    if(v.text)for(const key of ['fontSize','minFontSize','maxFontSize'])if(v.text[key]!=null&&(!Number.isFinite(v.text[key])||v.text[key]<=0||v.text[key]>200))throw Error('Invalid text size');
    if(v.svg){
      for(const key of ['fill','stroke','stroke-width','stroke-linecap','stroke-linejoin'])if(v.svg[key]!=null&&(typeof v.svg[key]!=='string'||!/^[-#\w.,% ()]+$/.test(v.svg[key])||/url\s*\(/i.test(v.svg[key])))throw Error('Invalid symbol style');
      if(!/^[\d.\s-]+$/.test(v.svg.viewBox)||typeof v.svg.body!=='string'||v.svg.body.length>20000)throw Error('Invalid symbol geometry');
      // Only inert vector shapes, never scripts, links, embedded HTML or events.
      const body=v.svg.body.replace(/<\/?(?:path|circle|rect|polygon|polyline|line|ellipse|g)(?:\s+(?:d|cx|cy|r|x|y|rx|ry|x1|x2|y1|y2|width|height|points|fill|fill-rule|stroke|stroke-width|stroke-linecap|stroke-linejoin|opacity|transform)="[^"<>]*")*\s*\/?\s*>/g,'').trim();
      if(body||/url\s*\(|javascript:/i.test(v.svg.body))throw Error('Symbols must contain inert SVG shapes only');
    }
    if(v.imageRect&&['x','y','w','h'].some(k=>!Number.isFinite(v.imageRect[k])))throw Error('Invalid image rectangle');
  };
  for(const [id,v] of Object.entries(doc.components||{})){visual(v);if(/^(title|rules|rank-text|action-text|.*-value|rank-group|tag-rail|footer-band)$/.test(id)&&(v.href||v.svg||v.decorations?.length))throw Error('Use text/style settings for '+id+'; its content is supplied by the card.');}
  for(const catalog of Object.values(doc.symbols||{}))for(const v of Object.values(catalog))visual(v);
  return doc;
}
