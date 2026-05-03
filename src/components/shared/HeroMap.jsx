import { useEffect, useRef } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";

const GEO_BOUNDS = { type:"Feature", geometry:{ type:"Polygon",
  coordinates:[[[20,-42],[92,-42],[92,62],[20,62],[20,-42]]] } };

const HOME_PORTS = [
  { n:"JNPT",    lon:72.95, lat:18.95, dx:8,  dy:-12, a:"start" },
  { n:"Mundra",  lon:69.71, lat:22.84, dx:-8, dy:-12, a:"end"   },
  { n:"Chennai", lon:80.30, lat:13.09, dx:9,  dy:5,   a:"start" },
  { n:"Cochin",  lon:76.26, lat:9.93,  dx:-9, dy:5,   a:"end"   },
];
const DEST_PORTS = [
  {lon:55.03,lat:24.99,c:"#00C9A7"},{lon:56.34,lat:25.12,c:"#00C9A7"},
  {lon:54.02,lat:16.93,c:"#00C9A7"},{lon:56.73,lat:24.35,c:"#00C9A7"},
  {lon:39.17,lat:21.54,c:"#F5A623"},{lon:43.14,lat:11.59,c:"#F5A623"},
  {lon:39.67,lat:-4.05,c:"#5CB6F9"},{lon:39.28,lat:-6.82,c:"#5CB6F9"},
  {lon:31.03,lat:-29.88,c:"#5CB6F9"},{lon:18.42,lat:-33.92,c:"#5CB6F9"},
  {lon:3.39,lat:6.45,c:"#00C9A7"},{lon:9.99,lat:53.55,c:"#5CB6F9"},
  {lon:-1.40,lat:50.90,c:"#5CB6F9"},{lon:0.11,lat:49.49,c:"#5CB6F9"},
  {lon:-9.14,lat:38.72,c:"#5CB6F9"},{lon:-0.38,lat:39.47,c:"#5CB6F9"},
  {lon:28.98,lat:41.01,c:"#5CB6F9"},
];
const CALLOUTS = [
  {label:"GULF",        lon:63, lat:22,  c:"#00C9A7", delay:1350},
  {label:"RED SEA",     lon:50, lat:13,  c:"#F5A623", delay:2250},
  {label:"EAST AFRICA", lon:56, lat:-1,  c:"#5CB6F9", delay:2850},
  {label:"SOUTH AFRICA",lon:50, lat:-22, c:"#5CB6F9", delay:3300},
  {label:"WEST AFRICA", lon:6,  lat:-14, c:"#00C9A7", delay:3750},
  {label:"EUROPE",      lon:24, lat:37,  c:"#5CB6F9", delay:4000},
];
const ROUTES = [
  {c:"#00C9A7",delay:300, ship:1,dur:14000,pts:[[72.95,18.95],[68,21],[62,23],[55.03,24.99]]},
  {c:"#00C9A7",delay:600, pts:[[69.71,22.84],[63,23.5],[56.73,24.35],[56.34,25.12]]},
  {c:"#00C9A7",delay:900, pts:[[76.26,9.93],[66,13],[54.02,16.93]]},
  {c:"#F5A623",delay:1200,ship:1,dur:13000,pts:[[72.95,18.95],[63,15],[52,12],[43.14,11.59]]},
  {c:"#F5A623",delay:1500,pts:[[43.14,11.59],[41,17],[39.17,21.54]]},
  {c:"#5CB6F9",delay:1800,ship:1,dur:16500,pts:[[76.26,9.93],[60,2],[48,0],[39.67,-4.05]]},
  {c:"#5CB6F9",delay:2060,pts:[[39.67,-4.05],[39.28,-6.82]]},
  {c:"#5CB6F9",delay:2250,ship:1,dur:19000,pts:[[72.95,18.95],[65,5],[55,-15],[42,-28],[31.03,-29.88]]},
  {c:"#5CB6F9",delay:2480,pts:[[31.03,-29.88],[24,-34],[18.42,-33.92]]},
  {c:"#00C9A7",delay:2700,pts:[[18.42,-33.92],[10,-20],[3.39,6.45]]},
  {c:"#5CB6F9",delay:2900,ship:1,dur:15000,
    pts:[[43.14,11.59],[39.17,21.54],[33,27],[32.5,29.5],[32.3,31.2],[30,34],[28.98,41.01]]},
  {c:"#5CB6F9",delay:3100,pts:[[28.98,41.01],[20,40],[14,40],[9.99,53.55]]},
  {c:"#5CB6F9",delay:3220,pts:[[9.99,53.55],[3,51.5],[-1.40,50.90],[0.11,49.49]]},
  {c:"#5CB6F9",delay:3360,pts:[[0.11,49.49],[-0.38,39.47],[-9.14,38.72]]},
];

export function HeroMap({ bg = false }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  useEffect(() => {
    let destroyed = false;

    if (!document.querySelector("#sattva-map-fonts")) {
      const lk = document.createElement("link");
      lk.id = "sattva-map-fonts"; lk.rel = "stylesheet";
      lk.href = "https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&display=swap";
      document.head.appendChild(lk);
    }

    async function init() {
      if (destroyed || !containerRef.current || !svgRef.current) return;
      let world;
      try { world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"); }
      catch { return; }
      if (destroyed) return;

      const W = containerRef.current.clientWidth;
      const H = containerRef.current.clientHeight;
      const svg = d3.select(svgRef.current).attr("width",W).attr("height",H);
      const defs = svg.append("defs");

      const og = defs.append("radialGradient").attr("id","hm-og").attr("cx","58%").attr("cy","42%").attr("r","62%");
      og.append("stop").attr("offset","0%").attr("stop-color","#091540");
      og.append("stop").attr("offset","100%").attr("stop-color","#02040e");
      defs.append("clipPath").attr("id","hm-clip").append("rect").attr("width",W).attr("height",H);

      const proj = d3.geoNaturalEarth1();
      proj.fitExtent([[0,0],[W,H]], GEO_BOUNDS);
      const gp = d3.geoPath().projection(proj);

      svg.append("rect").attr("width",W).attr("height",H).attr("fill","url(#hm-og)");
      svg.append("path").datum(d3.geoGraticule()()).attr("d",gp)
        .attr("fill","none").attr("stroke","rgba(255,255,255,0.09)").attr("stroke-width",.6)
        .attr("clip-path","url(#hm-clip)");
      svg.append("g").attr("clip-path","url(#hm-clip)").selectAll("path")
        .data(topojson.feature(world,world.objects.countries).features)
        .join("path").attr("d",gp).attr("fill","#1a2f6b").attr("stroke","#2d4fa8").attr("stroke-width",.5);

      const rG = svg.append("g").attr("clip-path","url(#hm-clip)");
      const cG = svg.append("g").attr("clip-path","url(#hm-clip)");
      const pG = svg.append("g").attr("clip-path","url(#hm-clip)");
      const sG = svg.append("g").attr("clip-path","url(#hm-clip)");

      function spawnShip(pathNode, color, dur) {
        const g = sG.append("g");
        g.append("circle").attr("r",5).attr("fill",color).attr("opacity",.16);
        g.append("polygon").attr("points","0,-5.5 3.5,4 -3.5,4")
          .attr("fill",color).attr("stroke","#fff").attr("stroke-width",.7);
        let t0 = null;
        (function step(ts) {
          if (destroyed) return;
          if (!t0) t0 = ts;
          const t = ((ts-t0)%dur)/dur, tl = pathNode.getTotalLength();
          const p1 = pathNode.getPointAtLength(t*tl);
          const p2 = pathNode.getPointAtLength(Math.min(t*tl+2,tl-.1));
          g.attr("transform",`translate(${p1.x},${p1.y}) rotate(${Math.atan2(p2.y-p1.y,p2.x-p1.x)*180/Math.PI})`);
          requestAnimationFrame(step);
        })(performance.now());
      }

      function addParticles(pathNode, color, count, dur) {
        for (let i = 0; i < count; i++) {
          const offset = i/count;
          const dot = sG.append("circle").attr("r",1.8).attr("fill",color).attr("opacity",.45);
          const speed = dur*(.85+Math.random()*.3);
          let t0 = null;
          (function step(ts) {
            if (destroyed) return;
            if (!t0) t0 = ts - offset*speed;
            const p = pathNode.getPointAtLength(((ts-t0)%speed)/speed*pathNode.getTotalLength());
            dot.attr("cx",p.x).attr("cy",p.y);
            requestAnimationFrame(step);
          })(performance.now());
        }
      }

      /* draw routes */
      ROUTES.forEach(rd => {
        const feat = {type:"LineString", coordinates:rd.pts};
        const glow = rG.append("path").datum(feat).attr("d",gp)
          .attr("fill","none").attr("stroke",rd.c).attr("stroke-width",8).attr("opacity",0).attr("stroke-linecap","round");
        const line = rG.append("path").datum(feat).attr("d",gp)
          .attr("fill","none").attr("stroke",rd.c).attr("stroke-width",2.5).attr("opacity",1).attr("stroke-linecap","round");
        const len = line.node().getTotalLength();
        line.attr("stroke-dasharray",`${len} ${len}`).attr("stroke-dashoffset",len);
        glow.attr("stroke-dasharray",`${len} ${len}`).attr("stroke-dashoffset",len);
        line.transition().delay(rd.delay).duration(950).ease(d3.easeLinear)
          .attr("stroke-dashoffset",0)
          .on("end",function(){
            d3.select(this).attr("stroke-dasharray","5 4").attr("stroke-dashoffset","0");
            if (rd.ship) spawnShip(this, rd.c, rd.dur||13000);
            addParticles(this, rd.c, rd.ship?2:3, 22000+Math.random()*10000);
          });
        glow.transition().delay(rd.delay).duration(950).ease(d3.easeLinear)
          .attr("stroke-dashoffset",0).attr("opacity",.28)
          .on("end",function(){ d3.select(this).attr("stroke-dasharray","5 4").attr("stroke-dashoffset","0"); });
      });

      /* callout pills — desktop only */
      if (!isMobile) CALLOUTS.forEach(co => {
        const pr = proj([co.lon,co.lat]); if (!pr) return;
        const [x,y] = pr;
        if (x<-30||x>W+30||y<-30||y>H+30) return;
        const rw = co.label.length*7.5+16, rh = 20;
        const g = cG.append("g").attr("transform",`translate(${x},${y})`).attr("opacity",0);
        g.append("rect").attr("x",-rw/2).attr("y",-rh/2).attr("width",rw).attr("height",rh).attr("rx",3)
          .attr("fill",co.c).attr("fill-opacity",.22).attr("stroke",co.c).attr("stroke-width",1).attr("stroke-opacity",.8);
        g.append("text").attr("text-anchor","middle").attr("dy","0.35em")
          .style("font-family","'Oswald',sans-serif").style("font-size","9px")
          .style("font-weight","600").style("fill",co.c).style("letter-spacing","1.5px").text(co.label);
        g.transition().delay(co.delay).duration(500).attr("opacity",1)
          .on("end",function(){ d3.select(this).transition().delay(5000).duration(800).attr("opacity",.4); });
      }); // end isMobile gate

      /* destination dots */
      DEST_PORTS.forEach(p => {
        const pr = proj([p.lon,p.lat]); if (!pr) return;
        const [x,y] = pr;
        if (x<-15||x>W+15||y<-15||y>H+15) return;
        pG.append("circle").attr("cx",x).attr("cy",y).attr("r",2.5)
          .attr("fill",p.c).attr("stroke","#fff").attr("stroke-width",.6).attr("opacity",0)
          .transition().delay(3900).duration(400).attr("opacity",1);
      });

      /* home port labels + pulse rings */
      const visibleDest = DEST_PORTS.map(p => {
        const pr = proj([p.lon,p.lat]); if (!pr) return null;
        const [x,y] = pr; if (x<0||x>W||y<0||y>H) return null;
        return {x,y,c:p.c};
      }).filter(Boolean);

      setTimeout(() => {
        if (destroyed) return;
        HOME_PORTS.forEach((p,i) => {
          const pr = proj([p.lon,p.lat]); if (!pr) return;
          const [x,y] = pr;
          const g = pG.append("g").attr("transform",`translate(${x},${y})`).attr("opacity",0);
          const ring = g.append("circle").attr("r",5).attr("fill","none")
            .attr("stroke","#F5A623").attr("stroke-width",1).attr("opacity",0);
          (function pulse(){ if(destroyed)return;
            ring.attr("r",5).attr("opacity",.8).transition().duration(1900).ease(d3.easeSinOut)
              .attr("r",18).attr("opacity",0).on("end",pulse);
          })();
          g.append("circle").attr("r",4.5).attr("fill","#F5A623").attr("stroke","#fff").attr("stroke-width",1);
          g.append("text").attr("dx",p.dx).attr("dy",p.dy).attr("text-anchor",p.a)
            .style("font-family","'Oswald',sans-serif").style("font-size","11px")
            .style("font-weight","700").style("fill","#F5A623").style("letter-spacing","1px").text(p.n);
          g.transition().delay(i*80).duration(400).attr("opacity",1);
        });

        /* random port activity pulses */
        function randomPulse(){ if(destroyed||!visibleDest.length)return;
          const p = visibleDest[Math.floor(Math.random()*visibleDest.length)];
          const ring = pG.append("circle").attr("cx",p.x).attr("cy",p.y).attr("r",3)
            .attr("fill","none").attr("stroke",p.c).attr("stroke-width",1.2).attr("opacity",.9);
          ring.transition().duration(1400).ease(d3.easeSinOut).attr("r",18).attr("opacity",0)
            .on("end",function(){ d3.select(this).remove(); });
          setTimeout(randomPulse, 1200+Math.random()*2800);
        }
        setTimeout(randomPulse, 2000);
      }, 3900);
    }

    init().catch(() => {});
    return () => {
      destroyed = true;
      if (svgRef.current) d3.select(svgRef.current).selectAll("*").remove();
    };
  }, []);

  return bg ? (
    <div ref={containerRef} style={{ position:"absolute", inset:0, zIndex:0, overflow:"hidden" }}>
      <svg ref={svgRef} style={{ display:"block", width:"100%", height:"100%" }} />
    </div>
  ) : (
    <section style={{ background:"#050A30", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:14, left:0, right:0, textAlign:"center", zIndex:10, pointerEvents:"none" }}>
        <span style={{ fontSize:9, fontWeight:700, letterSpacing:"3.5px", textTransform:"uppercase", color:"#F5A623", fontFamily:"Lato, sans-serif" }}>
          Our Trade Network
        </span>
      </div>
      <div ref={containerRef} style={{ width:"100%", height:"clamp(380px,52vh,560px)" }}>
        <svg ref={svgRef} style={{ display:"block", width:"100%", height:"100%" }} />
      </div>
    </section>
  );
}
