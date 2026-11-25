'use client';
import {useEffect,useState} from 'react';
import {getActiveProducts} from '@/lib/api';
import {PRODUCT_TYPES} from '@/lib/config';

type ProductType=(typeof PRODUCT_TYPES)[number];

// One GET /products for the whole page (header, footer and home tiles share it)
let request:Promise<Set<string>>|null=null;
function activeTypes(){
  request??=getActiveProducts().then(list=>new Set(list.map(p=>p.product_type))).catch(e=>{request=null;throw e});
  return request;
}

// Product types that have at least one active product, in PRODUCT_TYPES order. null while loading;
// [] when the API cannot be reached (menus then simply show no product types).
export function useProductTypes():ProductType[]|null{
  const [types,setTypes]=useState<ProductType[]|null>(null);
  useEffect(()=>{
    let live=true;
    activeTypes().then(active=>{if(live)setTypes(PRODUCT_TYPES.filter(t=>active.has(t.api)))}).catch(()=>{if(live)setTypes([])});
    return()=>{live=false};
  },[]);
  return types;
}
