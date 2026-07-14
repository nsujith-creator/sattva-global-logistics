import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { B, F } from "../../theme/tokens";

export function Nav({ st }) {
  const go = useNavigate();
  const loc = useLocation();
  const page = loc.pathname.replace("/", "") || "home";
  const [sc, setSc] = useState(false);
  const [open, setOpen] = useState(false);
  const