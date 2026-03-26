import { B, F, FF } from '../theme/tokens';

export const st={
sec:{padding:"clamp(40px,6vw,72px) clamp(16px,4vw,24px)",maxWidth:1200,margin:"0 auto",boxSizing:"border-box",width:"100%"},
h1:{fontSize:"clamp(28px,6vw,52px)",fontWeight:700,color:B.dark,lineHeight:1.12,fontFamily:FF,margin:0},
h2:{fontSize:"clamp(24px,3.5vw,38px)",fontWeight:700,color:B.dark,lineHeight:1.2,fontFamily:FF,margin:0,textAlign:"center"},
h3:{fontSize:20,fontWeight:600,color:B.dark,fontFamily:F,margin:0},
bd:{fontSize:15,lineHeight:1.7,color:B.g5,fontFamily:F},
sub:{fontSize:16,lineHeight:1.7,color:B.g5,maxWidth:620,margin:"14px auto 0",textAlign:"center",fontFamily:F},
bp:{display:"inline-flex",alignItems:"center",gap:8,padding:"13px 24px",background:B.primary,color:"#fff",borderRadius:8,fontWeight:600,fontSize:14,border:"none",cursor:"pointer",fontFamily:F,boxShadow:`0 4px 14px ${B.primary}40`,transition:"all .2s"},
bs:{display:"inline-flex",alignItems:"center",gap:8,padding:"13px 24px",background:"transparent",color:B.primary,borderRadius:8,fontWeight:600,fontSize:14,border:`2px solid ${B.primary}`,cursor:"pointer",fontFamily:F,transition:"all .2s"},
cd:{background:"#fff",borderRadius:14,padding:28,boxShadow:"0 1px 3px rgba(0,0,0,.05), 0 6px 20px rgba(0,0,0,.03)"},
inp:{width:"100%",padding:"11px 14px",border:`1.5px solid ${B.g3}`,borderRadius:8,fontSize:14,fontFamily:F,outline:"none",boxSizing:"border-box",background:"#fff"},
lb:{fontSize:12,fontWeight:600,color:B.g7,marginBottom:5,display:"block",fontFamily:F},
};

