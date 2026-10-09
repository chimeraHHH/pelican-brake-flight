export const BRAKE_LIMIT = 6;
export const GATE_SPEED = 4.2;
export const LAUNCH_ANGLE = 40 * Math.PI / 180;
export function createChallenge() {
  return {phase:'ride', brakeTime:0, launchSpeed:0, passed:0, collisions:0, flight:null,
    gates:Array.from({length:24},(_,i)=>({x:55+i*52,passed:false,braked:0,blocked:false})), best:0};
}
export function launch(c,speed,distance,lane=0) {
  if(c.phase!=='ride')return false;
  c.phase='flight';c.brakeTime=BRAKE_LIMIT;c.launchSpeed=Math.max(0,speed);
  c.flight={start:distance,lane,x:0,y:.08,vx:c.launchSpeed*Math.cos(LAUNCH_ANGLE),vy:3+c.launchSpeed*Math.sin(LAUNCH_ANGLE),time:0,energy:100,cooldown:0,pulse:0,flaps:0,peak:.08};
  return true;
}
export function chargeBrake(c,held,dt,speed,distance,lane) {
  if(c.phase!=='ride'||!held||dt<=0)return false;
  c.brakeTime=Math.min(BRAKE_LIMIT,c.brakeTime+Math.min(dt,.05));
  return c.brakeTime>=BRAKE_LIMIT-1e-8&&launch(c,speed,distance,lane);
}
export function roadblocks(c,prev,distance,speed,held,dt) {
  const gate=c.gates.find(g=>!g.passed);const result={distance,speed,passed:false,blocked:false};
  if(!gate||c.phase!=='ride')return result;
  if(held&&gate.x-prev<28&&gate.x-prev>=0)gate.braked+=dt;
  if(distance>=gate.x-1.2){
    if(speed<=GATE_SPEED&&gate.braked>=.28){gate.passed=true;c.passed++;result.passed=true;}
    else{result.distance=gate.x-1.5;result.speed=0;if(!gate.blocked){gate.blocked=true;c.collisions++;result.blocked=true;}}
  }
  return result;
}
export function flap(c) {
  const f=c.flight;
  if(c.phase!=='flight'||f.cooldown>0||f.energy<12)return false;
  f.energy-=12;f.cooldown=.24;f.pulse=1;f.flaps++;
  f.vy=Math.min(15,f.vy+3.05);f.vx=Math.min(24,f.vx+1.05);return true;
}
export function fly(c,dt) {
  if(c.phase!=='flight'||dt<=0)return false;
  const f=c.flight;dt=Math.min(dt,.05);f.time+=dt;f.cooldown=Math.max(0,f.cooldown-dt);f.pulse=Math.max(0,f.pulse-dt*3.3);
  f.vy-=3.8*dt;f.vx*=Math.exp(-.012*dt);f.x+=f.vx*dt;f.y+=f.vy*dt;f.peak=Math.max(f.peak,f.y);
  if(f.y<=0&&f.time>.2){f.y=0;c.phase='result';return true;}return false;
}
export function score(c) {return Math.max(0,Math.round((c.flight?.x||0)*10)+c.passed*25-c.collisions*40);}
