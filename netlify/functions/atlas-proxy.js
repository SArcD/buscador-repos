'use strict';
// Atlas de Datos 8.1: proxy restrictivo de metadatos y endpoint de verificación.
const PROVIDERS={
 datacite:q=>['https://api.datacite.org/dois',{query:q,'resource-type-id':'dataset','page[size]':'12'}],
 dataverse:q=>['https://dataverse.harvard.edu/api/search',{q,type:'dataset',per_page:'12'}],
 zenodo:q=>['https://zenodo.org/api/records',{q,size:'12'}],
 openaire:q=>['https://api.openaire.eu/graph/v3/research-products',{search:q,type:'dataset',pageSize:'12'}],
 datagov:q=>['https://catalog.data.gov/api/3/action/package_search',{q,rows:'12'}],
 gbif:q=>['https://api.gbif.org/v1/dataset/search',{q,limit:'12'}],
 'dataverse-files':q=>['https://dataverse.harvard.edu/api/datasets/'+Number(q)+'/versions/:latest-published/files',{}],
};
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=120','Access-Control-Allow-Origin':'*'};
const send=(statusCode,object)=>({statusCode,headers,body:JSON.stringify(object)});
exports.handler=async (event)=>{
 if(event.httpMethod!=='GET')return send(405,{ok:false,error:'Solo se permite GET'});
 const p=event.queryStringParameters||{};const source=String(p.source||'').trim(),q=String(p.q||'').trim();
 if(source==='health')return send(200,{ok:true,service:'atlas-proxy',version:'8.1',sources:Object.keys(PROVIDERS).filter(x=>x!=='dataverse-files')});
 if(!Object.prototype.hasOwnProperty.call(PROVIDERS,source)||!q||q.length>180||(source==='dataverse-files'&&!/^[1-9]\d{0,12}$/.test(q)))
  return send(400,{ok:false,error:'Origen o búsqueda no válidos.'});
 const [base,params]=PROVIDERS[source](q);const url=new URL(base);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 try{
  const resp=await fetch(url,{headers:{Accept:'application/json','User-Agent':'AtlasDeDatos/8.1'},signal:AbortSignal.timeout(12000)});
  if(!resp.ok)return send(502,{ok:false,source,error:'El proveedor devolvió HTTP '+resp.status,upstreamStatus:resp.status});
  const raw=await resp.text();if(raw.length>3000000)return send(502,{ok:false,source,error:'La respuesta del proveedor excede el tamaño permitido'});
  try{JSON.parse(raw)}catch{return send(502,{ok:false,source,error:'El proveedor no devolvió JSON válido'})}
  return {statusCode:200,headers,body:raw};
 }catch(err){return send(502,{ok:false,source,error:err.name==='TimeoutError'?'La solicitud al proveedor agotó el tiempo de espera':`No se logró consultar ${source}`});}
};
