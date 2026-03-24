import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CTA } from "../components/layout/CTA";
import { B, F, FF } from "../theme/tokens";
export function KnowledgePage({ st, I }){const go=useNavigate();
const[tab,setTab]=useState("incoterms");
const tabs=[["incoterms","Incoterms 2020"],["docs","Export Documents"],["fcl","FCL Ocean Freight"],["customs","Customs Clearance"],["containers","Container Guide"],["rates","Rate Components"]];

const incoterms=[
{code:"EXW",name:"Ex Works",risk:"Buyer bears all risk from seller's premises.",desc:"Seller makes goods available at their facility. Buyer handles everything: pickup, export clearance, freight, insurance, import clearance. Rarely used in Indian exports as seller can't control export compliance."},
{code:"FCA",name:"Free Carrier",risk:"Risk transfers when goods are handed to carrier.",desc:"Seller delivers goods cleared for export to the carrier nominated by buyer. Most flexible Incoterm. If delivery at seller's premises, seller loads. If elsewhere, seller delivers but unloading is buyer's responsibility."},
{code:"CPT",name:"Carriage Paid To",risk:"Risk transfers at origin, but seller pays freight to destination.",desc:"Seller pays freight to the named destination but risk transfers when goods are handed to the first carrier at origin. Buyer needs cargo insurance. Common in Indian export contracts."},
{code:"CIP",name:"Carriage & Insurance Paid To",risk:"Like CPT but seller must also arrange insurance.",desc:"Same as CPT but seller must obtain cargo insurance (minimum ICC-A coverage under Incoterms 2020). Cost is on seller. Risk still transfers at origin. Preferred when buyer wants insurance arranged by seller."},
{code:"DAP",name:"Delivered at Place",risk:"Seller bears risk until goods arrive at destination.",desc:"Seller delivers goods to a named destination, ready for unloading. Seller bears all transport risk and cost. Import clearance and duties are buyer's responsibility. Common for door-to-door contracts."},
{code:"DPU",name:"Delivered at Place Unloaded",risk:"Seller bears risk until goods are unloaded at destination.",desc:"Replaced DAT in Incoterms 2020. Seller delivers and unloads at the named destination. Only Incoterm where seller is responsible for unloading. Used for specific terminal/warehouse deliveries."},
{code:"DDP",name:"Delivered Duty Paid",risk:"Seller bears all risk and cost including import duties.",desc:"Maximum obligation on seller. Seller handles everything including import clearance and duties at destination. Most expensive for Indian exporters but simplifies life for foreign buyers. Be cautious of unknown import duty costs."},
{code:"FAS",name:"Free Alongside Ship",risk:"Risk transfers when goods are placed alongside the vessel.",desc:"Maritime only. Seller delivers goods alongside the vessel at the port of loading. Buyer handles loading, freight, insurance. Rarely used in Indian container trade; more common for bulk cargo."},
{code:"FOB",name:"Free on Board",risk:"Risk transfers when goods pass the ship's rail at loading port.",desc:"The most popular Incoterm in Indian exports. Seller delivers goods on board the vessel and handles export clearance. Buyer arranges and pays ocean freight and insurance. Clear risk transfer point at Indian port."},
{code:"CFR",name:"Cost and Freight",risk:"Risk transfers at loading port, but seller pays freight.",desc:"Seller pays ocean freight to destination port but risk transfers when goods are loaded on vessel at origin. Buyer should arrange cargo insurance. Very common in Indian textile and commodity exports."},
{code:"CIF",name:"Cost, Insurance & Freight",risk:"Like CFR but seller arranges marine insurance.",desc:"Seller pays freight and insurance to destination port. Under Incoterms 2020, minimum insurance is ICC-C (most basic). Risk still transfers at loading port. Popular in Indian export contracts but insurance coverage may be limited."},
];

const containers=[
{type:"20GP",name:"20' Standard",dim:"L: 5.9m × W: 2.35m × H: 2.39m",door:"W: 2.34m × H: 2.28m",cap:"33.2 CBM / 28,200 kg",desc:"Most common. Ideal for heavy cargo like steel, chemicals, machinery, rice bags. Max payload ~21.7 tonnes due to road weight limits in India.",cargo:"Rice, chemicals, steel coils, machinery parts, cement bags"},
{type:"40GP",name:"40' Standard",dim:"L: 12.03m × W: 2.35m × H: 2.39m",door:"W: 2.34m × H: 2.28m",cap:"67.7 CBM / 26,680 kg",desc:"Double the length of 20GP. Good for voluminous goods with moderate weight. Standard for most FCL shipments from India.",cargo:"Textiles, garments, furniture, auto parts, packaged food"},
{type:"40HC",name:"40' High Cube",dim:"L: 12.03m × W: 2.35m × H: 2.69m",door:"W: 2.34m × H: 2.58m",cap:"76.3 CBM / 26,460 kg",desc:"Extra 30cm height vs 40GP. Most popular for voluminous cargo. Slightly higher freight but much better cube utilization. The go-to container for Indian garment exporters.",cargo:"Garments on hangers, cotton bales, voluminous goods, furniture"},
{type:"20RF",name:"20' Reefer",dim:"L: 5.44m × W: 2.29m × H: 2.27m",door:"W: 2.29m × H: 2.26m",cap:"28.3 CBM / 27,400 kg",desc:"Temperature-controlled (-30°C to +30°C). Built-in refrigeration unit needs power (ship provides). Smaller internal dimensions due to insulation.",cargo:"Pharma products, frozen seafood, dairy, temperature-sensitive chemicals"},
{type:"40RH",name:"40' Reefer HC",dim:"L: 11.56m × W: 2.29m × H: 2.55m",door:"W: 2.29m × H: 2.44m",cap:"67.5 CBM / 26,280 kg",desc:"Large reefer with high-cube height. Standard for perishable Indian exports. Requires pre-cooling and temperature monitoring throughout transit.",cargo:"Fresh fruits (grapes, mangoes), frozen shrimp, meat, pharma, flowers"},
{type:"20OT",name:"20' Open Top",dim:"L: 5.9m × W: 2.35m × H: 2.35m",door:"W: 2.34m × H: 2.28m",cap:"32.5 CBM / 28,130 kg",desc:"Removable tarpaulin roof. Allows top-loading with crane. Used for tall cargo that won't fit through standard doors. Higher freight rates.",cargo:"Machinery, marble slabs, tall industrial equipment, project cargo"},
{type:"40OT",name:"40' Open Top",dim:"L: 12.03m × W: 2.35m × H: 2.35m",door:"W: 2.34m × H: 2.28m",cap:"65.9 CBM / 26,630 kg",desc:"Longer open-top for oversized cargo. Crane-loadable. May incur Over-Height surcharges if cargo extends above container wall.",cargo:"Large machinery, long pipes, wind turbine components"},
{type:"20FR",name:"20' Flat Rack",dim:"L: 5.62m × W: 2.24m × H: 2.23m",door:"Open sides",cap:"N/A / 31,250 kg",desc:"Collapsible end walls, no sides or roof. For heavy, oversized cargo. Can be stacked when empty. Requires special lashing and securing.",cargo:"Trucks, bulldozers, transformers, heavy machinery, boats"},
{type:"40FR",name:"40' Flat Rack",dim:"L: 12.08m × W: 2.42m × H: 2.10m",door:"Open sides",cap:"N/A / 39,200 kg",desc:"Large flat rack for very heavy project cargo. Often used with Over-Dimensional Cargo (ODC) surcharges. Popular for Indian engineering/infrastructure exports.",cargo:"Generators, heavy vehicles, construction equipment, large fabrications"},
{type:"ISO Tank",name:"ISO Tank Container",dim:"L: 6.06m × Ø: 1.52m",door:"Valve openings",cap:"21,000-26,000 litres",desc:"Stainless steel tank in ISO frame for liquid bulk. Can carry hazardous and non-hazardous liquids. Temperature control options available. Reusable.",cargo:"Chemicals, food-grade oils, wine, latex, pharmaceutical liquids"},
];

const rateComp=[
{name:"Ocean Freight (OF)",desc:"The base rate charged by the shipping line for transporting your container from origin port to destination port. Varies by trade lane, season, demand, and container type."},
{name:"Terminal Handling Charges – Origin (THC-O)",desc:"Charged at the Indian port (JNPT, Mundra, etc.) for receiving the container, yard handling, and loading onto the vessel. Quoted in INR but converted to USD in freight quotes."},
{name:"Terminal Handling Charges – Destination (THC-D)",desc:"Same as THC-O but at the destination port. Charged to the consignee/buyer in most cases. Varies significantly by country and port."},
{name:"Bill of Lading Fee (BL/DOC)",desc:"Shipping line's documentation fee for issuing the Bill of Lading. Some lines charge separately for surrender BL, telex release, or switch BL services."},
{name:"Container Freight Station (CFS) Charges",desc:"If your cargo goes through a CFS (common at JNPT), charges include: handling, storage, seal charges, and documentation at the CFS. Avoided if you do direct port delivery (DPD) or use ICD."},
{name:"Inland Haulage / Transport",desc:"Cost of moving the container from your factory/warehouse to the port, ICD, or CFS. Depends on distance, route, and vehicle type required."},
{name:"Customs Broker Fee",desc:"Your customs broker's professional fee for filing the Shipping Bill, managing customs examination, and ensuring compliance. Separate from ICEGATE filing fees."},
{name:"BAF/Bunker Adjustment Factor",desc:"Fuel surcharge to cover fluctuating bunker fuel costs. Applied as a fixed amount per container or as a percentage of ocean freight. Fluctuates monthly with oil prices. Currently a significant component of total freight."},
{name:"CAF/Currency Adjustment Factor",desc:"Protects the shipping line from currency exchange fluctuations. Applied as a percentage of OF. More common on trades where currencies are volatile."},
{name:"Peak Season Surcharge (PSS)",desc:"Applied during high-demand periods (typically Q3–Q4 for India-Europe/US trades). Lines announce PSS through GRI (General Rate Increase) notices."},
{name:"ISPS Surcharge",desc:"International Ship and Port Facility Security surcharge, mandated post-9/11. Applied at both origin and destination."},
{name:"Seal Charge",desc:"For the high-security bolt seal applied to the container. Mandatory for all export containers."},
{name:"Export Promotion Charges",desc:"Specific to Indian ports — charged by port authorities for export containers. Minimal amount but applies per container."},
];

return(
<div style={{paddingTop:68}}><Helmet><title>Export Knowledge Hub | Incoterms, FCL Guide, Container Types | Sattva Global Logistics</title><meta name="description" content="Comprehensive guides on Incoterms 2020, export documentation, FCL ocean freight process, customs clearance, container types, and freight rate components for Indian exporters." /><link rel="canonical" href="https://www.sattvaglobal.in/knowledge" /></Helmet>
<section style={{background:`linear-gradient(160deg,${B.primary}05,${B.w})`,padding:"clamp(56px,8vw,88px) 20px 48px"}}><div style={{maxWidth:1200,margin:"0 auto"}}>
<div style={{fontSize:12,fontWeight:600,color:B.primary,textTransform:"uppercase",letterSpacing:3,marginBottom:14}}>Knowledge Center</div>
<h1 style={{...st.h1,fontSize:"clamp(30px,4vw,44px)"}}>Export <span style={{color:B.primary}}>Knowledge</span> Hub</h1>
<p style={{...st.bd,fontSize:17,marginTop:20,maxWidth:640}}>Comprehensive guides on Incoterms, documentation, freight procedures, container types, and rate structures — tailored for Indian exporters.</p>
</div></section>
<div style={st.sec}>
<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:32}}>
{tabs.map(([id,lb])=><button key={id} onClick={()=>setTab(id)} style={{padding:"10px 20px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,fontFamily:F,background:tab===id?B.primary:"#fff",color:tab===id?"#fff":B.g5,boxShadow:tab===id?`0 2px 8px ${B.primary}33`:"0 1px 3px rgba(0,0,0,.06)"}}>{lb}</button>)}
</div>

{tab==="incoterms"&&(<div>
<h2 style={{...st.h2,textAlign:"left"}}>Incoterms® 2020 — Complete Guide</h2>
<p style={{...st.bd,marginTop:10,marginBottom:28}}>Incoterms define who pays for what, where risk transfers, and who handles documentation between seller and buyer. Published by the International Chamber of Commerce (ICC), the 2020 edition has 11 rules: 7 for any transport mode and 4 for sea/inland waterway only.</p>
<div style={{display:"grid",gap:16}}>
{incoterms.map((ic,i)=><div key={i} style={{...st.cd,borderLeft:`4px solid ${B.primary}`,padding:"20px 24px"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
<div><span style={{fontSize:20,fontWeight:800,color:B.primary,fontFamily:FF}}>{ic.code}</span><span style={{fontSize:15,fontWeight:600,color:B.dark,marginLeft:10}}>{ic.name}</span></div>
{null}
</div>
<p style={{fontSize:13,color:B.amber,fontWeight:600,margin:"4px 0 8px"}}>{ic.risk}</p>
<p style={{...st.bd,fontSize:13}}>{ic.desc}</p>
</div>)}
</div>
</div>)}

{tab==="docs"&&(<div>
<h2 style={{...st.h2,textAlign:"left"}}>Export Document Templates</h2>
<p style={{...st.bd,marginTop:10,marginBottom:28}}>Every export shipment requires a set of documents. We provide branded templates for your use. Download the XLSX templates, fill in your shipment details, and print.</p>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
{[["Commercial Invoice","The primary document for customs and payment. Lists goods, values, HS codes, buyer/seller details, Incoterms, and payment terms. Required for every export shipment.","commercial_invoice_sattva.xlsx"],
["Packing List","Details container contents: item descriptions, gross/net weights, dimensions, CBM, package counts. Used by customs and for cargo verification.","packing_list_sattva.xlsx"],
["Bill of Lading (BL Draft)","The title document for ocean cargo. Proves shipment, acts as receipt, and can be negotiable. Our draft template helps you verify BL details before finalization with the shipping line.","bl_draft_checker_sattva.xlsx"],
["Certificate of Origin","Certifies the country of manufacture. Required for preferential duty rates under trade agreements. Issued by local Chamber of Commerce or Export Promotion Council.","certificate_of_origin_sattva.xlsx"],
["MSDS (Material Safety Data Sheet)","Mandatory for chemical/hazardous cargo. Provides 16-section safety information. Must accompany IMO-classified goods. Our template follows GHS format.","msds_sattva.xlsx"],
["Phytosanitary Certificate","Required for agricultural products, food items, and plant-based materials. Issued by the Plant Quarantine Authority of India before export.","Issued by govt authority"],
["FSSAI Certificate","Required for food product exports. Ensures compliance with food safety standards. Applied for through FSSAI portal.","Issued by FSSAI"],
].map(([title,desc,file],i)=><div key={i} style={{...st.cd,borderTop:`3px solid ${B.primary}`}}>
<h3 style={{...st.h3,fontSize:16,marginBottom:8}}>{title}</h3>
<p style={{fontSize:13,color:B.g5,lineHeight:1.6,marginBottom:12}}>{desc}</p>
{file.endsWith(".xlsx")
  ? <a href={`/templates/${file}?v=20260325`} download style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:B.primary,fontWeight:600,textDecoration:"none",padding:"6px 12px",border:`1px solid ${B.primary}`,borderRadius:6,background:"#EEF2FF"}}>
      <span>📥</span> Download XLSX Template
    </a>
  : <div style={{fontSize:12,color:B.g5,fontWeight:600}}>📋 {file}</div>
}
</div>)}
</div>
</div>)}

{tab==="fcl"&&(<div>
<h2 style={{...st.h2,textAlign:"left"}}>How FCL Ocean Freight Works</h2>
<p style={{...st.bd,marginTop:10,marginBottom:28}}>Full Container Load (FCL) means your cargo exclusively occupies an entire container. It's the most common method for Indian exports above 15 CBM volume. Here's the complete process:</p>
<div style={{display:"grid",gap:16}}>
{[["1. Booking Confirmation","Exporter (or freight forwarder) books space with the shipping line. Booking confirmation includes: vessel name, voyage number, sailing date, cut-off dates (documentation and cargo), and empty container pickup location."],
["2. Empty Container Collection","Container is picked up from the shipping line's container yard or depot (typically near the port — JNPT has yards in Uran, Panvel, Bhiwandi). You receive empty equipment and a seal."],
["3. Factory/Warehouse Stuffing","Container is transported to your factory or warehouse. Goods are loaded (stuffed) into the container following proper weight distribution. Photos of stuffing are taken for documentation. Container is sealed with a bolt seal."],
["4. Transport to Port / ICD / CFS","Sealed container moves to the port (JNPT/Mundra), Inland Container Depot (ICD like Tumb, Khodiyar), or Container Freight Station (CFS). Must arrive before the cargo cut-off deadline (usually 24–48 hrs before sailing)."],
["5. Shipping Bill Filing","Customs broker files the Shipping Bill electronically through ICEGATE (Indian Customs EDI system). Documents include: Invoice, Packing List, IEC, AD Code, HS Classification, FOB value, buyer details."],
["6. Customs Examination","Customs may select the container for physical examination (based on risk management system) or grant Let Export Order (LEO) directly. If examined, container is opened at the port/CFS, cargo verified, and re-sealed."],
["7. Let Export Order (LEO)","Once customs is satisfied, LEO is granted. This authorizes the port to load the container onto the vessel. The Shipping Bill is stamped and EGM (Export General Manifest) is filed by the shipping line."],
["8. Vessel Loading","Container is loaded onto the designated vessel during the vessel's port call. Stowage position is determined by the vessel planner based on weight, destination, and cargo type (reefer, hazardous, etc.)."],
["9. Ocean Transit","Vessel sails from Indian port to destination. Transit times: Gulf (5–10 days), Far East (12–20 days), Europe (18–25 days), USA East (25–35 days). You receive container tracking updates throughout."],
["10. Destination Arrival & Delivery","Container is discharged at destination port. Consignee handles import clearance, pays duties, and collects the container for delivery to their warehouse (door delivery if arranged)."],
].map(([title,desc],i)=><div key={i} style={{...st.cd,display:"grid",gridTemplateColumns:"auto 1fr",gap:16,alignItems:"start"}}>
<div style={{width:40,height:40,borderRadius:10,background:`${B.primary}08`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:B.primary,fontSize:15,fontFamily:FF}}>{i+1}</div>
<div><h4 style={{fontSize:15,fontWeight:700,color:B.dark,marginBottom:6}}>{title.replace(/^\d+\.\s/,"")}</h4><p style={{fontSize:13,color:B.g5,lineHeight:1.7}}>{desc}</p></div>
</div>)}
</div>
</div>)}

{tab==="customs"&&(<div>
<h2 style={{...st.h2,textAlign:"left"}}>Export Customs Clearance in India</h2>
<p style={{...st.bd,marginTop:10,marginBottom:28}}>All goods leaving India must be cleared through Indian Customs. The process is electronic (paperless) through the ICEGATE system. Here's the step-by-step process:</p>
<div style={{display:"grid",gap:16}}>
{[["Prerequisites","IEC (Import Export Code) from DGFT, AD Code registered with your bank, GST registration, Authorized Dealer bank account. Your customs broker must be licensed (CHA license from CBIC)."],
["Shipping Bill Filing via ICEGATE","Your CHA files the Shipping Bill electronically. It includes: exporter IEC, HS Code classification, FOB value in INR, quantity/weight, buyer details, port codes, Incoterms, IGST payment details (if applicable), and MEIS/RoDTEP scheme codes."],
["Document Submission","Supporting documents uploaded to ICEGATE: Commercial Invoice, Packing List, Export Contract/PO, Letter of Credit (if applicable), ARE-1 (for excisable goods), any product-specific certificates (FSSAI, drug license, CPCB NOC for hazardous)."],
["Risk Management System (RMS)","Customs' automated system evaluates the Shipping Bill. Based on risk parameters, it assigns: GREEN channel (no examination, direct LEO), YELLOW channel (document check only), or RED channel (physical examination required). ~80% of export Shipping Bills get green channel."],
["Physical Examination (if RED)","Container is opened at the port/CFS under customs supervision. Cargo is verified against documents: correct goods, correct quantity, no prohibited items, proper marking. After verification, container is re-sealed with a new customs seal."],
["Let Export Order (LEO)","Once cleared, customs grants LEO. This is the official permission for the cargo to leave India. The Shipping Bill status updates on ICEGATE. Port/CFS can now accept the container for loading."],
["Drawback & Incentives","After LEO, you can claim duty drawback (refund of customs/excise duties on inputs). Filed through ICEGATE. Amount credited to your bank account. Also: IGST refund for zero-rated exports, RoDTEP benefits."],
["Export General Manifest (EGM)","Filed by the shipping line/airline after vessel departure. Lists all cargo on board. Must match Shipping Bill details. EGM filing triggers the DBK (drawback) processing cycle."],
].map(([title,desc],i)=><div key={i} style={{...st.cd,borderLeft:`4px solid ${i<3?B.primary:B.green}`}}>
<h4 style={{fontSize:15,fontWeight:700,color:B.dark,marginBottom:8}}>{title}</h4>
<p style={{fontSize:13,color:B.g5,lineHeight:1.7}}>{desc}</p>
</div>)}
</div>
</div>)}

{tab==="containers"&&(<div>
<h2 style={{...st.h2,textAlign:"left"}}>Container Type Guide — Dimensions & Specifications</h2>
<p style={{...st.bd,marginTop:10,marginBottom:28}}>Choosing the right container is critical for cost efficiency and cargo safety. Here's a detailed guide to every container type used in Indian export trade.</p>
<div style={{display:"grid",gap:20}}>
{containers.map((c,i)=><div key={i} style={{...st.cd,overflow:"hidden"}}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
<div><span style={{fontSize:11,padding:"4px 10px",borderRadius:4,background:B.primary,color:"#fff",fontWeight:700,marginRight:8}}>{c.type}</span><span style={{fontSize:17,fontWeight:700,color:B.dark,fontFamily:FF}}>{c.name}</span></div>
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:14}}>
<div style={{background:B.g1,padding:10,borderRadius:8}}><div style={{fontSize:10,fontWeight:600,color:B.g5,textTransform:"uppercase"}}>Internal Dimensions</div><div style={{fontSize:13,fontWeight:600,color:B.dark,marginTop:4}}>{c.dim}</div></div>
<div style={{background:B.g1,padding:10,borderRadius:8}}><div style={{fontSize:10,fontWeight:600,color:B.g5,textTransform:"uppercase"}}>Door Opening</div><div style={{fontSize:13,fontWeight:600,color:B.dark,marginTop:4}}>{c.door}</div></div>
<div style={{background:B.g1,padding:10,borderRadius:8}}><div style={{fontSize:10,fontWeight:600,color:B.g5,textTransform:"uppercase"}}>Capacity</div><div style={{fontSize:13,fontWeight:600,color:B.dark,marginTop:4}}>{c.cap}</div></div>
</div>
<p style={{fontSize:13,color:B.g5,lineHeight:1.7,marginBottom:8}}>{c.desc}</p>
<div style={{fontSize:12,color:B.primary,fontWeight:600}}>Common cargo: <span style={{color:B.g7,fontWeight:400}}>{c.cargo}</span></div>
</div>)}
</div>
</div>)}

{tab==="rates"&&(<div>
<h2 style={{...st.h2,textAlign:"left"}}>Freight Rate Components — Indian Export Context</h2>
<p style={{...st.bd,marginTop:10,marginBottom:28}}>Understanding what goes into a freight quote helps you compare rates accurately and avoid surprise charges. Here's every component explained in the Indian context with typical ranges.</p>
<div style={{display:"grid",gap:16}}>
{rateComp.map((r,i)=><div key={i} style={{...st.cd,borderLeft:`4px solid ${i<5?B.primary:B.g3}`}}>
<h4 style={{fontSize:15,fontWeight:700,color:B.dark,marginBottom:8}}>{r.name}</h4>
<p style={{fontSize:13,color:B.g5,lineHeight:1.7}}>{r.desc}</p>
</div>)}
</div>
</div>)}

<CTA headline="Have Questions? Our Experts Are Ready" st={st} I={I}/></div></div>);}



