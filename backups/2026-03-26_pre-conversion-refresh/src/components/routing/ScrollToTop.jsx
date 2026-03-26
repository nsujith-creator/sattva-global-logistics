import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop(){const{pathname}=useLocation();useEffect(()=>{if("scrollRestoration" in history)history.scrollRestoration="manual";window.scrollTo({top:0,behavior:"instant"});},[pathname]);return null;}
