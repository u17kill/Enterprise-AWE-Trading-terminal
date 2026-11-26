"use client";
import {useEffect} from 'react';
import {usePathname,useRouter} from 'next/navigation';

const paths:Record<string,string>={news:'/news',wind:'/voices',research:'/research',calendar:'/calendar',holdings:'/holdings',portfolio:'/portfolio'};
// Reference-document bookmarks remain usable without replacing the site's routes.
export function IntelligenceHashRoute(){
 const pathname=usePathname(),router=useRouter();
 useEffect(()=>{
  function apply(){
   const key=location.hash.slice(1);
   if(!key)return;
   if(paths[key])router.replace(paths[key],{scroll:false});
   else if(pathname==='/'||Object.values(paths).includes(pathname))router.replace('/',{scroll:false});
  }
  apply();window.addEventListener('hashchange',apply);
  return()=>window.removeEventListener('hashchange',apply);
 },[pathname,router]);
 return null;
}
