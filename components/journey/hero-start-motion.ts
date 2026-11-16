const clamp=(value:number)=>Math.max(0,Math.min(1,value));

/** CSS cubic-bezier timing, including the x-axis inversion. */
function bezier(x1:number,y1:number,x2:number,y2:number) {
  const axis=(t:number,a:number,b:number)=>3*(1-t)**2*t*a+3*(1-t)*t*t*b+t**3;
  return (value:number)=>{
    const x=clamp(value);if(x===0||x===1)return x;
    let low=0,high=1;
    for(let i=0;i<16;i++){const t=(low+high)/2;if(axis(t,x1,x2)<x)low=t;else high=t;}
    return axis((low+high)/2,y1,y2);
  };
}

const out=bezier(.23,1,.32,1);
const travel=bezier(.77,0,.175,1);
const contact=bezier(.55,0,.85,.35);
const cloudReturn=bezier(.42,0,.25,1);
const phase=(units:number,start:number,end:number)=>clamp((units-start)/(end-start));

/** The cap has its own clock; the subsequent camera-space story follows scroll. */
export function createStartMotion() {
  let mode:"idle"|"pressing"|"pressed"|"releasing"="idle";
  let elapsed=0,cap=0,releaseFrom=0,units=0,initialized=false,requested=false;
  let fallStarted=false,fallElapsed=0;
  return {
    activate(){requested=true;},
    update(rawUnits:number,dt:number,ready:boolean,reduced:boolean,review=false){
      if(!initialized&&ready){initialized=true;if(rawUnits>1||(review&&rawUnits>.015)){mode="pressed";cap=1;elapsed=.65;units=rawUnits;if(rawUnits>2.12){fallStarted=true;fallElapsed=1.24;}}}
      if(ready&&mode==="idle"&&(rawUnits>.015||requested)){mode="pressing";elapsed=0;requested=false;}
      if(mode==="pressing"){
        elapsed+=dt;
        // Load the spring, snap into contact, hold the impact, then one damped recoil.
        cap=reduced?clamp(elapsed/.18):elapsed<.09?-.045*out(elapsed/.09):elapsed<.19?-.045+1.065*contact((elapsed-.09)/.10):elapsed<.225?1.02:elapsed<.32?1.02-.065*out((elapsed-.225)/.095):.955+.045*out((elapsed-.32)/.18);
        if(elapsed>=.50){cap=1;mode="pressed";}
      }else if(mode==="pressed"){
        elapsed+=dt;
        if(rawUnits<.004&&!requested&&!review){
        mode="releasing";elapsed=0;releaseFrom=cap;}
      }else if(mode==="releasing"){
        elapsed+=dt;cap=releaseFrom*(1-out(elapsed/.20));
        if(elapsed>=.20){mode="idle";cap=0;requested=false;}
      }
      const destination=mode==="pressed"?rawUnits:Math.min(rawUnits,.20);
      units=reduced||review?destination:units+(destination-units)*(1-Math.exp(-dt/.12));
      const lift=travel(phase(units,.25,1.15));
      if(!fallStarted&&units>=1.38&&mode==="pressed")fallStarted=true;
      if(fallStarted){
        if(units<1.30){fallElapsed=Math.max(0,fallElapsed-dt*1.6);if(fallElapsed===0)fallStarted=false;}
        else fallElapsed=Math.min(1.24,fallElapsed+dt);
      }
      // y = 1/2 g t²: scroll starts the fall; gravity supplies its speed.
      const fallTime=review?phase(units,1.38,2.12):clamp(fallElapsed/.76);
      const drop=fallTime*fallTime;
      const clearing=Math.max(travel(phase(units,.40,1.70)),review?fallTime:clamp(fallElapsed/.45));
      const returning=cloudReturn(phase(units,5.45,6.85));
      const contentIn=out(review?phase(units,2.16,2.60):clamp((fallElapsed-.88)/.36));
      const contentOut=travel(phase(units,5.45,6.12));
      return {units,cap,lift,drop,fallTime,impact:(mode==="pressing"||mode==="pressed")&&elapsed>=.19&&elapsed<.65?(elapsed-.19)/.46:-1,cloudCoverage:(1-clearing)*(1-returning)+returning,
        cloudArrival:returning,whiteout:travel(phase(units,6.3,6.96)),
        titleOpacity:1-out(phase(units,.23,.85)),
        contentOpacity:contentIn*(1-contentOut),contentY:24*(1-contentIn)-18*contentOut,
        impulse:mode==="pressing"&&!reduced&&elapsed>.19?.085*Math.sin(Math.min(1,(elapsed-.19)/.31)*Math.PI)*Math.exp(-5*(elapsed-.19)):0,
        mode,stage:units<.25?mode:units<1.15?"lift":units<1.38?"suspend":drop<1?"fall":units<5.45?"content":"cloud-return",
        active:(fallStarted&&(fallElapsed<1.24||units<1.30))||mode==="pressing"||(mode==="pressed"&&elapsed<.65)||mode==="releasing"||Math.abs(destination-units)>.0001};
    },
  };
}


