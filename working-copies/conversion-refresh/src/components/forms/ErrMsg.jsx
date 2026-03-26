import { B } from "../../theme/tokens";

export function ErrMsg({msg}){return msg?<div style={{fontSize:11,color:B.red,marginTop:4}}>{msg}</div>:null;}
